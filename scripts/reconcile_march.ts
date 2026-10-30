#!/usr/bin/env -S npx tsx
/**
 * One-off March 2026 reconciliation sweep. Finance wants the scheme
 * rounding residue (the gap between what gets journaled at capture and
 * what the scheme export can actually carry at 2 decimal places) written
 * off for March before the books close on it. Run manually, once — see
 * scripts/out/reconcile-2026-03.log for the last real run's output.
 *
 * Usage: DATABASE_URL=postgres://... npx tsx scripts/reconcile_march.ts
 */
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { formatBhd, toFils } from "@filspay/money";

// E16: Bahrain months (UTC+3, no DST), as HANDOVER.md:31-32 asked; the
// UTC bounds moved the first and last 3 hours of each month.
const BAHRAIN_OFFSET_MS = 3 * 60 * 60 * 1000;
export function monthBounds(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - BAHRAIN_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - BAHRAIN_OFFSET_MS),
  };
}

export interface ResidueRow {
  merchantId: string;
  /** Residue of ONE scheme line: its capture slice minus the truncated scheme amount. */
  residueFils: number;
}

/** The fils truncated away when a captured amount is quantized down to the
 *  scheme export's 2-decimal-place granularity. */
// MK: % 10 on a non-negative int. correct.
export function computeResidueFils(capturedFils: number): number {
  return capturedFils % 10;
}

interface MerchantResidue {
  merchantId: string;
  lineCount: number;
  residueFils: number;
  posted?: boolean;
}

/**
 * E72: the residue is per scheme line, not per transaction. The scheme file
 * truncates each capture SLICE of a batch (settlement batch.go), so a
 * transaction captured as 1005 + 1005 in two batches loses 10 fils, while
 * captured_fils % 10 on its 2010 total said 0. Each line's residue is the
 * capture events of that transaction in that batch minus the line's
 * truncated amount. The month is chosen by batch_date, the Bahrain business
 * day of the events (event time), not by the authorization time
 * (transactions.occurred_at). Batches whose residue settlement already
 * journaled at close (E73, a scheme_rounding_residue row carrying the batch
 * id) are skipped, so nothing is posted twice.
 */
async function fetchResidueRows(client: Client, year: number, month: number): Promise<ResidueRow[]> {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const result = await client.query<{ merchant_id: string; residue_fils: string }>(
    `SELECT sb.merchant_id, (ev.slice - sel.amount_fils)::text AS residue_fils
       FROM scheme_export_lines sel
       JOIN settlement_batches sb ON sb.id = sel.settlement_batch_id
       JOIN LATERAL (SELECT COALESCE(SUM(te.amount_fils), 0) AS slice
                       FROM transaction_events te
                      WHERE te.transaction_id = sel.transaction_id
                        AND te.settlement_batch_id = sel.settlement_batch_id
                        AND te.event_type IN ('captured', 'partially_captured')) ev ON true
      WHERE sb.batch_date >= $1::date AND sb.batch_date < $2::date
        AND ev.slice - sel.amount_fils > 0
        AND NOT EXISTS (SELECT 1 FROM ledger_entries l
                         WHERE l.settlement_batch_id = sb.id AND l.account_id = 'scheme_rounding_residue')
      ORDER BY sb.merchant_id, sb.batch_date, sel.line_sequence`,
    [first, next],
  );
  return result.rows.map((r) => ({ merchantId: r.merchant_id, residueFils: Number(r.residue_fils) }));
}

/** One correction group per merchant; lineCount is the number of scheme lines with a residue. */
function groupByMerchant(rows: ResidueRow[]): MerchantResidue[] {
  const byMerchant = new Map<string, MerchantResidue>();
  for (const row of rows) {
    const existing = byMerchant.get(row.merchantId);
    if (existing) {
      existing.lineCount += 1;
      existing.residueFils += row.residueFils;
    } else {
      byMerchant.set(row.merchantId, { merchantId: row.merchantId, lineCount: 1, residueFils: row.residueFils });
    }
  }
  return [...byMerchant.values()];
}

// am: re-running is safe, entry_group_id dedupes it
// E16: it was not (a new random group id every run). A merchant that already
// has a sweep row for this period is skipped; matching on the description
// also catches runs made before this fix.
const SWEEP_DESCRIPTION = "March 2026 scheme rounding residue sweep — manual recon per finance";

async function postResidueCorrection(client: Client, merchant: MerchantResidue, now: Date): Promise<boolean> {
  if (merchant.residueFils <= 0) return false;
  const already = await client.query(
    `SELECT 1 FROM ledger_entries
      WHERE merchant_id = $1 AND account_id = 'scheme_rounding_residue' AND description = $2
      LIMIT 1`,
    [merchant.merchantId, SWEEP_DESCRIPTION],
  );
  if ((already.rowCount ?? 0) > 0) return false;
  const entryGroupId = randomUUID();
  const description = SWEEP_DESCRIPTION;
  await client.query(
    `INSERT INTO ledger_entries (entry_group_id, merchant_id, account_id, direction, amount_fils, occurred_at, description)
     VALUES ($1, $2, 'card_scheme_clearing', 'credit', $3, $4, $5),
            ($1, $2, 'scheme_rounding_residue', 'debit', $3, $4, $5)`, // E75: ADR-0002 legs (it debited merchant_payable)
    [entryGroupId, merchant.merchantId, merchant.residueFils, now.toISOString(), description],
  );
  return true;
}

/** Posts the residue correction for one month; returns what it posted. */
export async function runSweep(
  client: Client,
  year: number,
  month: number,
  now: Date,
): Promise<{ rows: ResidueRow[]; merchants: MerchantResidue[]; totalResidueFils: number }> {
  const rows = await fetchResidueRows(client, year, month);
  const merchantResidues = groupByMerchant(rows);
  await client.query("BEGIN");
  try {
    // E16: one sweep at a time; a second run waits, then sees the first one's rows.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('reconcile_march_sweep'))`);
    for (const merchant of merchantResidues) {
      merchant.posted = await postResidueCorrection(client, merchant, now);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
  const totalResidueFils = merchantResidues.filter((m) => m.posted).reduce((sum, m) => sum + m.residueFils, 0);
  return { rows, merchants: merchantResidues, totalResidueFils };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("reconcile_march: DATABASE_URL environment variable is not set");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  // FH: the log says 'run at ...+03:00' but toISOString is always Z?? MK: different node version
  const now = new Date();

  try {
    const { rows, merchants, totalResidueFils } = await runSweep(client, 2026, 3, now);

    const { start, end } = monthBounds(2026, 3);
    console.log("=== March 2026 reconciliation sweep ===");
    console.log(`run at: ${now.toISOString()}`);
    console.log(`window: ${start.toISOString()} .. ${end.toISOString()} (Bahrain 2026-03-01 00:00 .. 2026-04-01 00:00)`);
    console.log("");
    for (const merchant of merchants) {
      console.log(
        `merchant ${merchant.merchantId}: ${merchant.lineCount} line(s), residue ${formatBhd(toFils(merchant.residueFils))} BD (${merchant.residueFils} fils)${merchant.posted ? "" : " — skipped (already swept or zero)"}`,
      );
    }
    console.log("---");
    console.log(`total lines matched: ${rows.length}`);
    console.log(`total residue swept: ${formatBhd(toFils(totalResidueFils))} BD (${totalResidueFils} fils)`);
    console.log("");
    console.log("reconciliation applied successfully");
  } finally {
    await client.end();
  }
}

const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
