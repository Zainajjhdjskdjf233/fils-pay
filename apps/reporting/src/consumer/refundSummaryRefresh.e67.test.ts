/**
 * E67 (rest): nothing refreshed refund_merchant_summary, so in real use the
 * view stayed empty. A consumer pass that applies a refund.succeeded event
 * now refreshes it. Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { enqueueEvent } from "@filspay/events";
import { runConsumerPass } from "./runConsumerPass.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("refundSummaryRefresh.e67.test.ts requires DATABASE_URL");
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
test.after(async () => { await pool.end(); });

test("testE67_refundEventRefreshesTheSummaryView", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E67 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const t = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, refunded_fils, acquirer_reference)
     VALUES ($1, 'partially_refunded', 10000, 10000, 1500, $2) RETURNING id`,
    [merchantId, `acq-${randomUUID()}`],
  );
  await pool.query(
    `INSERT INTO refunds (transaction_id, merchant_id, amount_fils, fee_reversed_fils, status, acquirer_reference, created_by_type, created_by_id)
     VALUES ($1, $2, 1500, 37, 'succeeded', $3, 'merchant_api_key', $4)`,
    [t.rows[0]!.id, merchantId, `acqr-${randomUUID()}`, randomUUID()],
  );
  await enqueueEvent(pool, { eventType: "refund.succeeded", aggregateType: "transaction", aggregateId: t.rows[0]!.id, payload: { merchantId, amountFils: 1500 } });
  for (let i = 0; i < 20; i++) {
    const { processedCount } = await runConsumerPass(pool, { consumerBatchLimit: 500 });
    if (processedCount === 0) break;
  }
  const r = await pool.query(`SELECT total_refunded_fils FROM refund_merchant_summary WHERE merchant_id = $1`, [merchantId]);
  assert.equal(r.rowCount, 1, "the view holds the refund without a manual REFRESH");
  assert.equal(Number(r.rows[0].total_refunded_fils), 1500);
});
