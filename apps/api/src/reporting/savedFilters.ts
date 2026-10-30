import type { Pool } from "pg";
import { withTransaction } from "../db/withTransaction.js";
import { ConflictError } from "../lib/errors.js";

/** E171: most saved filters one merchant may keep (value for Zainab to review). */
export const MAX_SAVED_FILTERS = 50;

export interface SavedFilterDto {
  id: string;
  name: string;
  filter: Record<string, unknown>;
  createdAt: string;
}

interface SavedFilterRow {
  id: string;
  name: string;
  filter_json: Record<string, unknown>;
  created_at: Date;
}

// am: result.rows[0]! below will throw a TypeError not a 500 if insert returns nothing? same thing really. ignore
function serialize(row: SavedFilterRow): SavedFilterDto {
  return { id: row.id, name: row.name, filter: row.filter_json, createdAt: row.created_at.toISOString() };
}

/**
 * Stores a named filter for reuse. The filter body is opaque JSONB here,
 * never interpreted or executed at write time — there is nothing for this
 * function to validate beyond "is it a JSON object." Interpretation
 * happens only later, at report-run time
 * (reporting/transactionsReportQuery.ts), scoped by that endpoint's own
 * auth context, not by anything persisted here.
 */
export async function createSavedFilter(
  pool: Pool,
  input: { merchantId: string; name: string; filter: Record<string, unknown> },
): Promise<SavedFilterDto> {
  // E171: count and insert under one per-merchant lock, so parallel saves
  // cannot all read "49" and pass the cap together.
  return withTransaction(pool, async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('saved_filters:' || $1))`, [input.merchantId]);
    const count = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM reporting_saved_filters WHERE merchant_id = $1`,
      [input.merchantId],
    );
    if (count.rows[0]!.n >= MAX_SAVED_FILTERS) {
      throw new ConflictError("too_many_saved_filters", `a merchant can keep at most ${MAX_SAVED_FILTERS} saved filters`);
    }
    const result = await client.query<SavedFilterRow>(
      `INSERT INTO reporting_saved_filters (merchant_id, name, filter_json)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id, name, filter_json, created_at`,
      [input.merchantId, input.name, JSON.stringify(input.filter)],
    );
    return serialize(result.rows[0]!);
  });
}

/**
 * Lists a merchant's saved filters, newest first. Scoped by merchant_id;
 * there is no pagination because createSavedFilter caps a merchant at
 * MAX_SAVED_FILTERS (E171: the old comment named a CHECK in "0061" that
 * never existed; the table is in 0069 and has no such CHECK).
 */
export async function listSavedFilters(pool: Pool, input: { merchantId: string }): Promise<SavedFilterDto[]> {
  const result = await pool.query<SavedFilterRow>(
    `SELECT id, name, filter_json, created_at FROM reporting_saved_filters
      WHERE merchant_id = $1
      ORDER BY created_at DESC`,
    [input.merchantId],
  );
  return result.rows.map(serialize);
}
