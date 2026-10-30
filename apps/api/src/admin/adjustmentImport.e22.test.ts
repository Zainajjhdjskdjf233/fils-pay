/**
 * E22: the same adjustment CSV must not be applied twice.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { applyAdjustmentImport } from "./adjustmentImport.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("adjustmentImport.e22.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
test.after(async () => {
  await pool.end();
});

test("testE22_sameFileTwiceIsRejected", async () => {
  const admin = await pool.query<{ id: string }>(
    `INSERT INTO admin_users (email, password_hash, display_name, role) VALUES ($1, 'x', 'E22', 'finance') RETURNING id`,
    [`e22-${randomUUID()}@admin.test`],
  );
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, status, test_mode) VALUES ($1, 250, 'active', false) RETURNING id`,
    [`E22 ${randomUUID()}`],
  );
  const merchantId = m.rows[0]!.id;
  const rows = [{ merchantId, amount: "4.750", reason: "statement correction" }];
  await applyAdjustmentImport(pool, { adminUserId: admin.rows[0]!.id, originalFilename: "march.csv", rows });

  await assert.rejects(
    applyAdjustmentImport(pool, { adminUserId: admin.rows[0]!.id, originalFilename: "march (1).csv", rows }),
    (err: { statusCode?: number }) => err.statusCode === 409,
  );
  const legs = await pool.query(`SELECT 1 FROM ledger_entries WHERE merchant_id = $1 AND account_id = 'merchant_payable'`, [merchantId]);
  assert.equal(legs.rowCount, 1, "posted once");
});
