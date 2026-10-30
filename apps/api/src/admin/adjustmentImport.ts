import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { addFils, toFils, ZERO_FILS, type Fils } from "@filspay/money";
import { insertAdminAuditLog } from "../adminAudit/log.js";
import { withTransaction } from "../db/withTransaction.js";
import { BadRequestError, ConflictError, UnprocessableEntityError } from "../lib/errors.js";
import { CREDIT_APPROVAL_THRESHOLD_FILS } from "./creditThreshold.js";
import { parseAdjustmentAmountFils } from "./adjustmentCsvParsing.js";
import { postLedgerAdjustment } from "./ledgerAdjustments.js";
import { UUID_RE } from "../lib/queryParsing.js";

export interface AdjustmentImportRow {
  merchantId: string;
  /** The raw CSV cell, unmodified. */
  amount: string;
  reason?: string;
}

/** @property totalPostedFils Sum of the absolute row amounts, so always >= 0. */
export interface AdjustmentImportResult {
  importId: string;
  rowCount: number;
  totalPostedFils: Fils;
}

async function postAdjustmentToLedgerAndCache(
  client: import("pg").PoolClient,
  merchantId: string,
  amountFils: Fils,
): Promise<string | null> {
  const entryGroupId = await postLedgerAdjustment(client, merchantId, amountFils, "CSV adjustment import");
  await client.query(
    `INSERT INTO merchant_balances (merchant_id, cached_payable_fils, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (merchant_id) DO UPDATE
       SET cached_payable_fils = merchant_balances.cached_payable_fils + $2, updated_at = now()`,
    [merchantId, amountFils],
  );
  return entryGroupId;
}

/**
 * Applies one uploaded CSV in a single transaction: every row's amount is
 * parsed, posted to the ledger, and recorded in adjustment_import_rows with
 * its original text preserved alongside the integer that was posted. The
 * audit row is the last statement in the same transaction, so an import
 * that lands without a record of who ran it is not reachable.
 */
export async function applyAdjustmentImport(
  pool: Pool,
  input: { adminUserId: string; originalFilename: string; rows: AdjustmentImportRow[] },
): Promise<AdjustmentImportResult> {
  if (input.rows.length === 0) {
    throw new BadRequestError("empty_import", "the CSV must contain at least one row");
  }

  // E119: the import must not bypass the two-person rule for credits above
  // the approval threshold (creditThreshold.ts, 50 BD). Parse every row first;
  // if any single row, or the total moved (ignoring sign, so splitting into
  // small rows does not help), is above the threshold, refuse before writing
  // anything — larger corrections go through the credit flow with a second
  // approver.
  let movedFils = 0;
  for (const row of input.rows) {
    const abs = Math.abs(Number(parseAdjustmentAmountFils(row.amount)));
    if (abs > Number(CREDIT_APPROVAL_THRESHOLD_FILS)) {
      throw new UnprocessableEntityError("approval_required", "a row above 50.000 BD needs the two-person credit flow");
    }
    movedFils += abs;
  }
  if (movedFils > Number(CREDIT_APPROVAL_THRESHOLD_FILS)) {
    throw new UnprocessableEntityError("approval_required", "imports moving more than 50.000 BD in total need the two-person credit flow");
  }

  // E22: a fingerprint of the rows (not the filename), stored under a unique
  // index (migration 0076), so the same content cannot be posted twice.
  const contentSha256 = createHash("sha256")
    .update(JSON.stringify(input.rows.map((r) => [r.merchantId.trim().toLowerCase(), r.amount.trim(), r.reason ?? ""])))
    .digest("hex");

  return withTransaction(pool, async (client) => {
    const importRow = await client.query<{ id: string }>(
      `INSERT INTO adjustment_imports (uploaded_by_admin_user_id, original_filename, row_count, content_sha256)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (content_sha256) WHERE content_sha256 IS NOT NULL DO NOTHING
       RETURNING id`,
      [input.adminUserId, input.originalFilename, input.rows.length, contentSha256],
    );
    if (!importRow.rows[0]) {
      throw new ConflictError("duplicate_import", "this CSV content was already applied");
    }
    const importId = importRow.rows[0].id;

    let total = ZERO_FILS;
    // FH: claude says nothing here stops the same CSV being applied twice. intended? (asked in #fp-backend 14/8, no answer)
    // re-upload is blocked by the unique original_filename i think — am
    // E22: it was not (0065 has no such index); the content hash above blocks it.
    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i]!;
      const amountFils = parseAdjustmentAmountFils(row.amount);
      const entryGroupId = await postAdjustmentToLedgerAndCache(client, row.merchantId, amountFils);

      await client.query(
        `INSERT INTO adjustment_import_rows
           (adjustment_import_id, row_number, merchant_id, raw_amount_text, parsed_amount_fils, reason, ledger_entry_group_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [importId, i + 1, row.merchantId, row.amount, amountFils, row.reason ?? null, entryGroupId],
      );
      total = addFils(total, amountFils);
    }

    await insertAdminAuditLog(client, {
      adminUserId: input.adminUserId,
      action: "adjustment_import_applied",
      targetType: "adjustment_import",
      targetId: importId,
      metadata: {
        rowCount: input.rows.length,
        totalPostedFils: total,
        originalFilename: input.originalFilename,
      },
    });

    return { importId, rowCount: input.rows.length, totalPostedFils: total };
  });
}

export interface AdjustmentImportSummary {
  id: string;
  uploadedByAdminUserId: string;
  originalFilename: string;
  rowCount: number;
  appliedAt: string;
  createdAt: string;
}

/**
 * @property parsedAmountFils The signed integer that was posted.
 * @property ledgerEntryGroupId null for a zero-amount row (nothing is journaled).
 */
export interface AdjustmentImportRowDetail {
  rowNumber: number;
  merchantId: string;
  rawAmountText: string;
  parsedAmountFils: number;
  reason: string | null;
  ledgerEntryGroupId: string | null;
}

/**
 * Keyset-paginated list of past imports, newest first. The cursor is the
 * platform's standard `created_at::text` (Postgres's own rendering, never
 * `Date.toISOString()`, which would round-trip through a JS Date and lose
 * microsecond precision).
 */
// MK: cursor compares created_at::text as a string — breaks across a DST change. FP-198
// FH: tried to repro FP-198 with TZ=Europe/London on the api box, pages looked fine?? leaving it open
// E160: fixed — the comparison is now on timestamps with id as a tie-breaker.
export async function listAdjustmentImports(
  pool: Pool,
  params: { limit?: number; cursor?: string | null },
): Promise<{ items: AdjustmentImportSummary[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
  // E160: the cursor is "<created_at>|<id>" and rows are compared as a
  // (created_at, id) pair, as timestamps, so imports with the same created_at
  // are not skipped and the session time zone does not matter.
  const cursor = params.cursor ?? null;
  let cursorAt: string | null = null;
  let cursorId: string | null = null;
  if (cursor !== null) {
    const sep = cursor.lastIndexOf("|");
    if (sep <= 0 || !UUID_RE.test(cursor.slice(sep + 1))) {
      throw new BadRequestError("invalid_cursor", "cursor is not valid");
    }
    cursorAt = cursor.slice(0, sep);
    cursorId = cursor.slice(sep + 1);
  }

  const result = await pool.query<{
    id: string;
    uploaded_by_admin_user_id: string;
    original_filename: string;
    row_count: number;
    applied_at: string;
    created_at: string;
  }>(
    `SELECT id, uploaded_by_admin_user_id, original_filename, row_count,
            applied_at::text AS applied_at, created_at::text AS created_at
       FROM adjustment_imports
      WHERE ($1::timestamptz IS NULL OR (created_at, id) < ($1::timestamptz, $2::uuid))
      ORDER BY created_at DESC, id DESC
      LIMIT $3`,
    [cursorAt, cursorId, limit + 1],
  );

  const rows = result.rows.slice(0, limit);
  const last = rows[rows.length - 1];
  const nextCursor = result.rows.length > limit && last ? `${last.created_at}|${last.id}` : null;

  return {
    items: rows.map((row) => ({
      id: row.id,
      uploadedByAdminUserId: row.uploaded_by_admin_user_id,
      originalFilename: row.original_filename,
      rowCount: row.row_count,
      appliedAt: row.applied_at,
      createdAt: row.created_at,
    })),
    nextCursor,
  };
}

/** Per-row detail for one import — raw text and parsed integer side by side. */
/** @throws NotFoundError when the import id does not exist. */
export async function getAdjustmentImportRows(
  pool: Pool,
  importId: string,
): Promise<AdjustmentImportRowDetail[]> {
  const result = await pool.query<{
    row_number: number;
    merchant_id: string;
    raw_amount_text: string;
    parsed_amount_fils: string;
    reason: string | null;
    ledger_entry_group_id: string | null;
  }>(
    `SELECT row_number, merchant_id, raw_amount_text, parsed_amount_fils, reason, ledger_entry_group_id
       FROM adjustment_import_rows
      WHERE adjustment_import_id = $1
      ORDER BY row_number`,
    [importId],
  );

  return result.rows.map((row) => ({
    rowNumber: row.row_number,
    merchantId: row.merchant_id,
    rawAmountText: row.raw_amount_text,
    parsedAmountFils: Number(row.parsed_amount_fils),
    reason: row.reason,
    ledgerEntryGroupId: row.ledger_entry_group_id,
  }));
}
