/**
 * E53: a malformed event before a good one must not block the good one.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { enqueueEvent } from "@filspay/events";
import { runConsumerPass } from "./runConsumerPass.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("runConsumerPass.e53.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
test.after(async () => {
  await pool.end();
});

test("testE53_poisonEventBeforeGoodEventDoesNotBlockIt", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E53 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  await enqueueEvent(pool, { eventType: "transaction.captured", aggregateType: "transaction", aggregateId: randomUUID(), payload: {} });
  await enqueueEvent(pool, {
    eventType: "transaction.captured", aggregateType: "transaction", aggregateId: randomUUID(),
    payload: { merchantId, amountCapturedFils: 2_500, feeFils: 63, newStatus: "captured", capturedTotalFils: 2_500 },
  });

  for (let i = 0; i < 20; i++) {
    const { processedCount } = await runConsumerPass(pool, { consumerBatchLimit: 500 });
    if (processedCount === 0) break;
  }
  const r = await pool.query(`SELECT captured_gross_fils FROM merchant_daily_volume WHERE merchant_id = $1`, [merchantId]);
  assert.equal(r.rowCount, 1, "the good event after the poison one is applied");
  assert.equal(Number(r.rows[0].captured_gross_fils), 2_500);
});
