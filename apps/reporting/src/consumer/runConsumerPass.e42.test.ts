/**
 * E42: an outbox event whose transaction commits AFTER a later event was
 * already processed must still be applied (not skipped by the cursor).
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
  throw new Error("runConsumerPass.e42.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
test.after(async () => {
  await pool.end();
});

async function drain(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    const { processedCount } = await runConsumerPass(pool, { consumerBatchLimit: 500 });
    if (processedCount === 0) return;
  }
}

test("testE42_lateCommittingLowerIdIsNotSkipped", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E42 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const payload = (fils: number) => ({ merchantId, amountCapturedFils: fils, feeFils: 0, newStatus: "captured", capturedTotalFils: fils });

  // Slow transaction: takes the LOWER id first, commits last.
  const slow = await pool.connect();
  try {
    await slow.query("BEGIN");
    await enqueueEvent(slow, { eventType: "transaction.captured", aggregateType: "transaction", aggregateId: randomUUID(), payload: payload(1_000) });
    // Fast transaction: higher id, commits now.
    await enqueueEvent(pool, { eventType: "transaction.captured", aggregateType: "transaction", aggregateId: randomUUID(), payload: payload(2_000) });
    await drain();
    await slow.query("COMMIT");
  } finally {
    slow.release();
  }
  await drain();

  const r = await pool.query(`SELECT captured_count, captured_gross_fils FROM merchant_daily_volume WHERE merchant_id = $1`, [merchantId]);
  assert.equal(r.rows[0]?.captured_count, 2, `both events applied; got ${JSON.stringify(r.rows)}`);
  assert.equal(Number(r.rows[0]?.captured_gross_fils), 3_000);
});
