/**
 * E110 [second review]: the streaming export paged on occurred_at alone
 * (`occurred_at > cursor`), so rows sharing a timestamp at a page boundary
 * were skipped. Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { streamTransactionsExportCsv } from "./exportCsv.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("exportCsv.e110.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
test.after(async () => { await pool.end(); });

test("testE110_streamingExportKeepsRowsWithTheSameTimestamp", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E110 ${randomUUID()}`]);
  for (let i = 0; i < 3; i++) {
    await pool.query(
      `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference, reference, occurred_at)
       VALUES ($1, 'captured', 1000, 1000, $2, $3, '2026-03-01T10:00:00Z')`,
      [m.rows[0]!.id, `acq_${randomUUID()}`, `e110-${i}`],
    );
  }
  let csv = "";
  await streamTransactionsExportCsv(pool, { merchantId: m.rows[0]!.id }, (c) => { csv += c; }, 2);
  const rows = csv.trim().split("\n").slice(1);
  assert.equal(rows.length, 3, `all three rows exported:\n${csv}`);
});
