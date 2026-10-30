/**
 * E30: one settlement batch gets one payout disbursement, even when the
 * settlement.paid webhook has several delivery rows (one per endpoint).
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { recordPayoutDisbursementEffect } from "./payoutDisbursement.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("payoutDisbursement.e30.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
test.after(async () => {
  await pool.end();
});

test("testE30_oneDisbursementPerBatch", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E30 ${randomUUID()}`]);
  const b = await pool.query<{ id: string }>(
    `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, closed_at, paid_at)
     VALUES ($1, '2025-02-01', 'paid', 1000, 25, 975, now(), now()) RETURNING id`,
    [m.rows[0]!.id],
  );
  const batchId = b.rows[0]!.id;
  // Two endpoints' deliveries at the same moment, then a third later.
  await Promise.all([recordPayoutDisbursementEffect(pool, batchId, 975), recordPayoutDisbursementEffect(pool, batchId, 975)]);
  await recordPayoutDisbursementEffect(pool, batchId, 975);

  const r = await pool.query(`SELECT 1 FROM settlement_payout_disbursements WHERE settlement_batch_id = $1`, [batchId]);
  assert.equal(r.rowCount, 1, "one payout instruction per batch");
});
