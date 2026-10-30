/**
 * E138 [coverage, a weak spot in my own E39 fix]: the 50,000-row cap still let
 * several exports run at once; each builds its CSV in memory (~120 MB at the
 * cap), and 4 at once ran the 384 MB heap out. Only one export may run at a
 * time per process; a second one at the same moment gets 503 (retry).
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildTransactionsExportCsv } from "./exportCsv.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("exportCsv.e138.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
test.after(async () => {
  await pool.end();
});

test("testE138_onlyOneExportRunsAtATime", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E138 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  await pool.query(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference)
     SELECT $1, 'captured', 1000, 1000, 'acq_' || g FROM generate_series(1, 50) g`,
    [merchantId],
  );
  const results = await Promise.allSettled([
    buildTransactionsExportCsv(pool, { merchantId }),
    buildTransactionsExportCsv(pool, { merchantId }),
  ]);
  const ok = results.filter((r) => r.status === "fulfilled");
  const busy = results.filter((r) => r.status === "rejected" && (r.reason as { statusCode?: number }).statusCode === 503);
  assert.equal(ok.length, 1, "one export runs");
  assert.equal(busy.length, 1, `the second export at the same moment must get 503; got ${JSON.stringify(results.map((r) => r.status))}`);
  // The slot is released afterwards: a later export works.
  const csv = await buildTransactionsExportCsv(pool, { merchantId });
  assert.equal(csv.trim().split("\n").length, 51, "header + 50 rows");
});
