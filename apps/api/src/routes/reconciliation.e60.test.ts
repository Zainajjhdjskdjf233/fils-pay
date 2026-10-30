/**
 * E60: a batch paid out on the next business day must not show up as an
 * unexplained gap in that next day's reconciliation.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { issueApiKey } from "../apiKeys/issue.js";
import { recordKycReview } from "../onboarding/review.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("reconciliation.e60.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl, NODE_ENV: "test", ACQUIRER_FAILURE_RATE: "0", ACQUIRER_LATENCY_MIN_MS: "0", ACQUIRER_LATENCY_MAX_MS: "1",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 6).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE60_nextDayPayoutIsNotAGap", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E60 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `e60-${randomUUID()}@example.test`],
  );
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label: "e60" });
  const h = { authorization: `Bearer ${rawKey}` };
  const a = await app.inject({
    method: "POST", url: "/v1/transactions", headers: { ...h, "idempotency-key": randomUUID() },
    payload: { amountFils: 10_000, card: { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" } },
  });
  const txId = (a.json() as { id: string }).id;
  await app.inject({ method: "POST", url: `/v1/transactions/${txId}/capture`, headers: { ...h, "idempotency-key": randomUUID() }, payload: {} });

  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1);
  const tomorrow = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() + 1);
  const dayAfter = d.toISOString().slice(0, 10);

  // Today's batch closes; the daemon pays it out tomorrow at noon (as in production).
  const b = await pool.query<{ id: string }>(
    `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, closed_at, paid_at)
     VALUES ($1, $2, 'paid', 10000, 250, 9750, now(), $3) RETURNING id`,
    [merchantId, today, new Date(`${tomorrow}T12:00:00+03:00`)],
  );
  await pool.query(`UPDATE transaction_events SET settlement_batch_id = $2 WHERE transaction_id = $1 AND event_type = 'captured'`, [txId, b.rows[0]!.id]);
  await pool.query(
    `INSERT INTO ledger_entries (entry_group_id, merchant_id, settlement_batch_id, account_id, direction, amount_fils, occurred_at, description)
     VALUES ($1, $2, $3, 'merchant_payable', 'debit', 9750, $4, 'settlement payout: batch paid'),
            ($1, $2, $3, 'platform_cash', 'credit', 9750, $4, 'settlement payout: batch paid')`,
    [randomUUID(), merchantId, b.rows[0]!.id, new Date(`${tomorrow}T12:00:00+03:00`)],
  );

  for (const [from, to] of [[today, tomorrow], [tomorrow, dayAfter], [today, dayAfter]]) {
    const res = await app.inject({ method: "GET", url: `/v1/settlement/reconciliation?from=${from}&to=${to}`, headers: h });
    assert.equal((res.json() as { gapFils: number }).gapFils, 0, `${from}..${to}: ${res.body}`);
  }
});
