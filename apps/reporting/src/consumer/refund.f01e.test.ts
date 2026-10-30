/**
 * F01e: the reporting worker counts refunds in the daily report.
 * Calls applyEvent directly (like applyEvent.test.ts), so poison events
 * other suites leave in a shared DB (E53) cannot block it.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { applyEvent, type OutboxEventRow } from "./applyEvent.js";
import { REPORTING_EVENT_TYPES } from "./runConsumerPass.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("refund.f01e.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
test.after(async () => {
  await pool.end();
});

test("testF01e_workerSubscribesToRefunds", () => {
  assert.ok(REPORTING_EVENT_TYPES.includes("refund.succeeded"));
});

test("testF01e_refundRolledUpOnTheBahrainDate", async () => {
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`F01e reporting ${randomUUID()}`],
  );
  const merchantId = m.rows[0]!.id;
  // 22:30 UTC on 1 May is 01:30 on 2 May in Bahrain.
  const row = (amountFils: number): OutboxEventRow => ({
    id: 1,
    event_type: "refund.succeeded",
    aggregate_id: randomUUID(),
    payload: { merchantId, refundId: randomUUID(), amountFils, feeReversedFils: 31, refundedTotalFils: amountFils, newStatus: "partially_refunded" },
    created_at: new Date("2026-05-01T22:30:00Z"),
  });

  const client = await pool.connect();
  try {
    await applyEvent(client, row(1_250));
    await applyEvent(client, row(500));
  } finally {
    client.release();
  }

  const r = await pool.query<{ volume_date: string; refund_count: number; refund_gross_fils: string; captured_count: number }>(
    `SELECT to_char(volume_date, 'YYYY-MM-DD') AS volume_date, refund_count, refund_gross_fils, captured_count
       FROM merchant_daily_volume WHERE merchant_id = $1`,
    [merchantId],
  );
  assert.equal(r.rowCount, 1);
  assert.equal(r.rows[0]!.volume_date, "2026-05-02");
  assert.equal(r.rows[0]!.refund_count, 2);
  assert.equal(Number(r.rows[0]!.refund_gross_fils), 1_750);
  assert.equal(r.rows[0]!.captured_count, 0);
});
