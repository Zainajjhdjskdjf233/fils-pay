/**
 * F01e: refunds show up right in reports and reconciliation.
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
import { refreshAnalyticsRollups } from "../admin/reportingRebuild.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("refundReports.f01e.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  ACQUIRER_FAILURE_RATE: "0",
  ACQUIRER_LATENCY_MIN_MS: "0",
  ACQUIRER_LATENCY_MAX_MS: "1",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 5 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

const CARD = { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" };

function todayBahrain(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A merchant with one 10.000 BD capture and one 1.250 BD refund made today through the API. */
async function merchantWithRefund(label: string) {
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`F01e ${label} ${randomUUID()}`],
  );
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `f01e-${randomUUID()}@example.test`],
  );
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label });
  const headers = { authorization: `Bearer ${rawKey}` };
  const auth = await app.inject({
    method: "POST", url: "/v1/transactions", headers: { ...headers, "idempotency-key": randomUUID() },
    payload: { amountFils: 10_000, card: CARD },
  });
  assert.equal(auth.statusCode, 201, auth.body);
  const transactionId = (auth.json() as { id: string }).id;
  const cap = await app.inject({
    method: "POST", url: `/v1/transactions/${transactionId}/capture`, headers: { ...headers, "idempotency-key": randomUUID() }, payload: {},
  });
  assert.equal(cap.statusCode, 200, cap.body);
  const ref = await app.inject({
    method: "POST", url: `/v1/merchants/${merchantId}/refunds`, headers: { ...headers, "idempotency-key": randomUUID() },
    payload: { transactionId, amountFils: 1_250, reason: "f01e" },
  });
  assert.equal(ref.statusCode, 200, ref.body);
  const refundId = (ref.json() as { id: string }).id;
  return { merchantId, headers, transactionId, refundId };
}

async function reconcile(headers: Record<string, string>, from: string, to: string) {
  const res = await app.inject({ method: "GET", url: `/v1/settlement/reconciliation?from=${from}&to=${to}`, headers });
  assert.equal(res.statusCode, 200, res.body);
  return res.json() as { gapFils: number; explained: boolean; ledgerMerchantPayableNetFils: number; settlementNetPayoutFils: number };
}

/** A closed batch (not paid: payout legs would land in the next day's window). */
async function closedBatch(merchantId: string, date: string, f: { gross: number; fee: number; refund: number; feeReversed: number }) {
  const net = f.gross - f.fee - f.refund + f.feeReversed;
  const r = await pool.query<{ id: string }>(
    `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, refund_fils, fee_reversed_fils, net_payout_fils, closed_at)
     VALUES ($1, $2, 'closed', $3, $4, $5, $6, $7, now()) RETURNING id`,
    [merchantId, date, f.gross, f.fee, f.refund, f.feeReversed, net],
  );
  return r.rows[0]!.id;
}

test("testF01e_unbatchedRefundIsExplained", async () => {
  const { headers } = await merchantWithRefund("pending");
  const today = todayBahrain();
  const report = await reconcile(headers, today, addDays(today, 1));
  assert.equal(report.ledgerMerchantPayableNetFils, 10_000 - 250 - 1_250 + 31);
  assert.equal(report.gapFils, 0, JSON.stringify(report));
  assert.equal(report.explained, true);
});

test("testF01e_refundCarriedToNextDayIsExplainedOnBothDays", async () => {
  const { merchantId, headers, transactionId, refundId } = await merchantWithRefund("carry");
  const today = todayBahrain();
  const tomorrow = addDays(today, 1);

  // Day 1 batch took the capture only; the refund carried over.
  const day1 = await closedBatch(merchantId, today, { gross: 10_000, fee: 250, refund: 0, feeReversed: 0 });
  await pool.query(
    `UPDATE transaction_events SET settlement_batch_id = $2
      WHERE transaction_id = $1 AND event_type IN ('captured', 'partially_captured')`,
    [transactionId, day1],
  );

  // Day 2: a 4.000 BD capture (fee 100) plus the carried refund.
  const at = new Date(`${tomorrow}T12:00:00+03:00`);
  const t2 = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference, occurred_at)
     VALUES ($1, 'captured', 4000, 4000, $2, $3) RETURNING id`,
    [merchantId, `acq-${randomUUID()}`, at],
  );
  const group = randomUUID();
  await pool.query(
    `INSERT INTO ledger_entries (entry_group_id, merchant_id, transaction_id, account_id, direction, amount_fils, occurred_at, description)
     VALUES ($1, $2, $3, 'card_scheme_clearing', 'debit', 4000, $4, 'capture: gross'),
            ($1, $2, $3, 'merchant_payable', 'credit', 4000, $4, 'capture: gross'),
            ($1, $2, $3, 'merchant_payable', 'debit', 100, $4, 'capture: MDR fee'),
            ($1, $2, $3, 'platform_fee_revenue', 'credit', 100, $4, 'capture: MDR fee')`,
    [group, merchantId, t2.rows[0]!.id, at],
  );
  const day2 = await closedBatch(merchantId, tomorrow, { gross: 4_000, fee: 100, refund: 1_250, feeReversed: 31 });
  await pool.query(
    `INSERT INTO transaction_events (transaction_id, event_type, amount_fils, actor_type, occurred_at, settlement_batch_id)
     VALUES ($1, 'captured', 4000, 'system', $2, $3)`,
    [t2.rows[0]!.id, at, day2],
  );
  await pool.query(`UPDATE refunds SET settlement_batch_id = $2 WHERE id = $1`, [refundId, day2]);

  const r1 = await reconcile(headers, today, tomorrow);
  assert.equal(r1.gapFils, 0, `day 1 (refund waits for a later batch): ${JSON.stringify(r1)}`);
  const r2 = await reconcile(headers, tomorrow, addDays(tomorrow, 1));
  assert.equal(r2.gapFils, 0, `day 2 (batch holds an earlier refund): ${JSON.stringify(r2)}`);
  const both = await reconcile(headers, today, addDays(tomorrow, 1));
  assert.equal(both.gapFils, 0, `both days: ${JSON.stringify(both)}`);

  // The batch API shows the refund part of the math.
  const res = await app.inject({ method: "GET", url: `/v1/settlement/batches/${day2}`, headers });
  assert.equal(res.statusCode, 200, res.body);
  const batch = res.json() as { grossFils: number; feeFils: number; refundFils: number; feeReversedFils: number; netPayoutFils: number };
  assert.equal(batch.refundFils, 1_250);
  assert.equal(batch.feeReversedFils, 31);
  assert.equal(batch.netPayoutFils, batch.grossFils - batch.feeFils - batch.refundFils + batch.feeReversedFils);
});

test("testF01e_refundSummaryViewJoinsTheRightTransaction", async () => {
  const { merchantId } = await merchantWithRefund("view");
  await pool.query(`REFRESH MATERIALIZED VIEW refund_merchant_summary`);
  const r = await pool.query<{ refund_count: string; total_refunded_fils: string; original_captured_fils: string }>(
    `SELECT refund_count, total_refunded_fils, original_captured_fils FROM refund_merchant_summary WHERE merchant_id = $1`,
    [merchantId],
  );
  assert.equal(r.rowCount, 1, "one summary row for the merchant's refund day");
  assert.equal(Number(r.rows[0]!.refund_count), 1);
  assert.equal(Number(r.rows[0]!.total_refunded_fils), 1_250);
  assert.equal(Number(r.rows[0]!.original_captured_fils), 10_000);
});

test("testF01e_adminRebuildKeepsRefunds", async () => {
  const { merchantId } = await merchantWithRefund("rebuild");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await refreshAnalyticsRollups(client);
    const r = await client.query<{ captured_count: number; refund_count: number; refund_gross_fils: string }>(
      `SELECT captured_count, refund_count, refund_gross_fils FROM merchant_daily_volume WHERE merchant_id = $1 AND volume_date = $2`,
      [merchantId, todayBahrain()],
    );
    assert.equal(r.rowCount, 1);
    assert.equal(r.rows[0]!.captured_count, 1);
    assert.equal(r.rows[0]!.refund_count, 1);
    assert.equal(Number(r.rows[0]!.refund_gross_fils), 1_250);
  } finally {
    await client.query("ROLLBACK"); // the rebuild truncates a shared table; leave it as it was
    client.release();
  }
});

test("testF01e_volumesReportShowsRefunds", async () => {
  const { merchantId, headers } = await merchantWithRefund("volumes");
  await pool.query(
    `INSERT INTO merchant_daily_volume (merchant_id, volume_date, captured_count, captured_gross_fils, refund_count, refund_gross_fils)
     VALUES ($1, '2026-01-10', 2, 9000, 1, 1250)`,
    [merchantId],
  );
  const res = await app.inject({ method: "GET", url: "/v1/analytics/volumes?from=2026-01-01&to=2026-02-01", headers });
  assert.equal(res.statusCode, 200, res.body);
  const point = (res.json() as { points: Array<{ refundCount: number; refundGrossFils: number }> }).points[0]!;
  assert.equal(point.refundCount, 1);
  assert.equal(point.refundGrossFils, 1_250);
});
