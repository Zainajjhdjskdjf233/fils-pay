/**
 * E62: two consumer passes at the same moment (worker + `reporting catch-up`)
 * must apply each outbox event once, not once per pass.
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
  throw new Error("runConsumerPass.e62.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const APP = `e62-${randomUUID().slice(0, 8)}`;
// Two pools = two "processes" (worker and catch-up), same consumer name.
const poolA = new Pool({ connectionString: databaseUrl, max: 2, application_name: APP });
const poolB = new Pool({ connectionString: databaseUrl, max: 2, application_name: APP });
const admin = new Pool({ connectionString: databaseUrl, max: 2 });
test.after(async () => {
  await Promise.all([poolA.end(), poolB.end(), admin.end()]);
});

async function drain(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    const { processedCount } = await runConsumerPass(admin, { consumerBatchLimit: 500 });
    if (processedCount === 0) return;
  }
}

async function waitForBlocked(n: number): Promise<number> {
  let blocked = 0;
  for (let i = 0; i < 100; i++) {
    const r = await admin.query<{ c: string }>(
      `SELECT count(*) AS c FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock'`,
      [APP],
    );
    blocked = Number(r.rows[0]!.c);
    if (blocked >= n) return blocked;
    await new Promise((res) => setTimeout(res, 50));
  }
  return blocked;
}

test("testE62_twoConcurrentPassesCountEachEventOnce", async () => {
  await drain(); // cursor at the head, so the next passes only see our event
  const m = await admin.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E62 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  await enqueueEvent(admin, {
    eventType: "transaction.captured", aggregateType: "transaction", aggregateId: randomUUID(),
    payload: { merchantId, amountCapturedFils: 1_000, feeFils: 0, newStatus: "captured", capturedTotalFils: 1_000 },
  });

  // Blocker: lock the merchant row. The rollup INSERT's foreign-key check (KEY SHARE)
  // must wait for it, so both passes are held AFTER reading the cursor and the events.
  const blocker = await admin.connect();
  let passes: Promise<unknown> | undefined;
  try {
    await blocker.query("BEGIN");
    await blocker.query(`SELECT 1 FROM merchants WHERE id = $1 FOR UPDATE`, [merchantId]);
    passes = Promise.all([
      runConsumerPass(poolA, { consumerBatchLimit: 500 }),
      runConsumerPass(poolB, { consumerBatchLimit: 500 }),
    ]);
    // Before fix: both wait on the merchant row. After fix: one waits there, one on the cursor row.
    const blocked = await waitForBlocked(2);
    assert.equal(blocked, 2, "both passes should be waiting on a lock");
    await blocker.query("COMMIT");
  } finally {
    blocker.release();
  }
  await passes;

  const r = await admin.query(`SELECT captured_count, captured_gross_fils FROM merchant_daily_volume WHERE merchant_id = $1`, [merchantId]);
  assert.equal(r.rows[0]?.captured_count, 1, `each event counted once; got ${JSON.stringify(r.rows)}`);
  assert.equal(Number(r.rows[0]?.captured_gross_fils), 1_000);
});
