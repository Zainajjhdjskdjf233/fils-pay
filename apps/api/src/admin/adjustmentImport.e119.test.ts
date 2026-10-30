/**
 * E119 [deep review]: the CSV adjustment import must not bypass the
 * two-person rule for credits above 50 BD (creditThreshold.ts). One admin
 * could post any amount, either sign, with no second approver.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { applyAdjustmentImport } from "./adjustmentImport.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("adjustmentImport.e119.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
test.after(async () => {
  await pool.end();
});

test("testE119_largeImportsNeedTheTwoPersonFlow", async () => {
  const admin = await pool.query<{ id: string }>(
    `INSERT INTO admin_users (email, password_hash, display_name, role) VALUES ($1, 'x', 'E119', 'finance') RETURNING id`,
    [`e119-${randomUUID()}@admin.test`],
  );
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, status, test_mode) VALUES ($1, 250, 'active', false) RETURNING id`,
    [`E119 ${randomUUID()}`],
  );
  const merchantId = m.rows[0]!.id;
  const run = (rows: Array<{ merchantId: string; amount: string; reason?: string }>) =>
    applyAdjustmentImport(pool, { adminUserId: admin.rows[0]!.id, originalFilename: `${randomUUID()}.csv`, rows });

  for (const rows of [
    [{ merchantId, amount: "1000000" }],                                   // one huge credit
    [{ merchantId, amount: "-75.000" }],                                   // one large debit
    [{ merchantId, amount: "30" }, { merchantId, amount: "30", reason: "b" }], // split to dodge the limit
  ]) {
    await assert.rejects(run(rows), (err: { statusCode?: number }) => err.statusCode === 422, JSON.stringify(rows));
  }
  const legs = await pool.query(`SELECT 1 FROM ledger_entries WHERE merchant_id = $1`, [merchantId]);
  assert.equal(legs.rowCount, 0, "nothing posted");

  const ok = await run([{ merchantId, amount: "50.000" }]);
  assert.equal(Number(ok.totalPostedFils), 50_000, "up to the threshold still works");
});
