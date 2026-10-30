/**
 * E64: a batch that goes closed -> paid after its batch_closed event was applied
 * must show status 'paid' and paid_at in merchant_payout_trends once the
 * settlement.paid event is consumed. Requires DATABASE_URL (migrated Postgres).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { enqueueEvent } from "@filspay/events";
import { runConsumerPass } from "./runConsumerPass.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("runConsumerPass.e64.test.ts requires DATABASE_URL to point at a real, migrated Postgres (run `npm run migrate` first)");
}
const pool = new Pool({ connectionString: databaseUrl, max: 5 });
const config = { consumerBatchLimit: 500 };
test.after(async () => { await pool.end(); });

test("E64: settlement.paid after batch_closed marks the payout trend row paid", async () => {
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`E64 Test Merchant ${randomUUID()}`],
  );
  const merchantId = m.rows[0]!.id;
  const b = await pool.query<{ id: string }>(
    `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, closed_at)
     VALUES ($1, '2026-03-01', 'closed', 10000, 250, 9750, now()) RETURNING id`,
    [merchantId],
  );
  const batchId = b.rows[0]!.id;

  // Close time: CloseBatch's exact payload shape (scheme_export.go buildBatchClosedPayload).
  await enqueueEvent(pool, {
    eventType: "settlement.batch_closed", aggregateType: "settlement_batch", aggregateId: batchId,
    payload: { merchantId, batchId, batchDate: "2026-03-01", grossFils: 10000, feeFils: 250, netPayoutFils: 9750 },
  });
  await runConsumerPass(pool, config);
  const closed = await pool.query(`SELECT status FROM merchant_payout_trends WHERE settlement_batch_id = $1`, [batchId]);
  assert.equal(closed.rows[0]?.status, "closed", "precondition: trend row written as closed");

  // Payout: PayoutBatch (batch.go:428) then EnqueuePayoutNotifications' exact payload (payout_notify.go:92-97).
  await pool.query(`UPDATE settlement_batches SET status = 'paid', paid_at = now() WHERE id = $1`, [batchId]);
  await enqueueEvent(pool, {
    eventType: "settlement.paid", aggregateType: "settlement_batch", aggregateId: batchId,
    payload: { merchantId, batchId, batchDate: "2026-03-01", netPayoutFils: 9750 },
  });
  await runConsumerPass(pool, config);

  const r = await pool.query<{ status: string; paid_at: Date | null }>(
    `SELECT status, paid_at FROM merchant_payout_trends WHERE merchant_id = $1 AND settlement_batch_id = $2`,
    [merchantId, batchId],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.status, "paid");
  assert.ok(r.rows[0]!.paid_at instanceof Date, "paid_at is set");
});
