/**
 * F01b: POST /v1/merchants/:merchantId/refunds works end to end through the API.
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
import { randomToken, sha256Hex } from "../lib/crypto.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("refunds.f01b.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  ACQUIRER_FAILURE_RATE: "0",
  ACQUIRER_LATENCY_MIN_MS: "0",
  ACQUIRER_LATENCY_MAX_MS: "1",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

async function merchantWithCapturedPayment(label: string, amountFils = 10_000) {
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`F01b ${label} ${randomUUID()}`],
  );
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `f01b-${randomUUID()}@example.test`],
  );
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label });
  const headers = { authorization: `Bearer ${rawKey}` };
  const auth = await app.inject({
    method: "POST", url: "/v1/transactions", headers: { ...headers, "idempotency-key": randomUUID() },
    payload: { amountFils, card: { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" } },
  });
  assert.equal(auth.statusCode, 201, auth.body);
  const transactionId = (auth.json() as { id: string }).id;
  const cap = await app.inject({
    method: "POST", url: `/v1/transactions/${transactionId}/capture`, headers: { ...headers, "idempotency-key": randomUUID() }, payload: {},
  });
  assert.equal(cap.statusCode, 200, cap.body);
  return { merchantId, headers, transactionId };
}

test("testF01b_partialRefundThroughTheApi", async () => {
  const { merchantId, headers, transactionId } = await merchantWithCapturedPayment("ok");
  const key = randomUUID();
  const res = await app.inject({
    method: "POST", url: `/v1/merchants/${merchantId}/refunds`, headers: { ...headers, "idempotency-key": key },
    payload: { transactionId, amountFils: 1_250, reason: "customer returned item" },
  });
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json() as { amountFils: number; feeReversedFils: number; transactionStatus: string };
  assert.equal(body.amountFils, 1_250);
  assert.equal(body.feeReversedFils, 31); // 250 fee * 1250 / 10000 = 31.25 -> 31 (banker's rounding)
  assert.equal(body.transactionStatus, "partially_refunded");

  // Same Idempotency-Key replays the first answer and writes nothing new.
  const replay = await app.inject({
    method: "POST", url: `/v1/merchants/${merchantId}/refunds`, headers: { ...headers, "idempotency-key": key },
    payload: { transactionId, amountFils: 1_250, reason: "customer returned item" },
  });
  assert.equal(replay.statusCode, 200, replay.body);
  assert.deepEqual(replay.json(), res.json());
  const rows = await pool.query(`SELECT 1 FROM refunds WHERE transaction_id = $1`, [transactionId]);
  assert.equal(rows.rowCount, 1);
});

test("testF01b_idempotencyKeyRequired", async () => {
  const { merchantId, headers, transactionId } = await merchantWithCapturedPayment("nokey");
  const res = await app.inject({
    method: "POST", url: `/v1/merchants/${merchantId}/refunds`, headers, payload: { transactionId, amountFils: 100 },
  });
  assert.equal(res.statusCode, 400, res.body);
});

test("testF01b_invalidAmountRejected", async () => {
  const { merchantId, headers, transactionId } = await merchantWithCapturedPayment("badamount");
  for (const amountFils of [0, -5, 1.5, "100"]) {
    const res = await app.inject({
      method: "POST", url: `/v1/merchants/${merchantId}/refunds`, headers: { ...headers, "idempotency-key": randomUUID() },
      payload: { transactionId, amountFils },
    });
    assert.ok(res.statusCode === 400 || res.statusCode === 422, `${JSON.stringify(amountFils)} -> ${res.statusCode} ${res.body}`);
  }
});

test("testF01b_otherMerchantPathIsForbidden", async () => {
  const a = await merchantWithCapturedPayment("a");
  const b = await merchantWithCapturedPayment("b");
  const res = await app.inject({
    method: "POST", url: `/v1/merchants/${b.merchantId}/refunds`, headers: { ...a.headers, "idempotency-key": randomUUID() },
    payload: { transactionId: b.transactionId, amountFils: 100 },
  });
  assert.equal(res.statusCode, 403, res.body);
});

// F01b follow-ups (fix-reviewer): reason length, support role, timeline.

test("testF01b_overlongReasonRejected", async () => {
  const { merchantId, headers, transactionId } = await merchantWithCapturedPayment("longreason");
  const res = await app.inject({
    method: "POST", url: `/v1/merchants/${merchantId}/refunds`, headers: { ...headers, "idempotency-key": randomUUID() },
    payload: { transactionId, amountFils: 100, reason: "x".repeat(501) },
  });
  assert.equal(res.statusCode, 400, res.body);
});

test("testF01b_supportUserCannotRefund", async () => {
  const { merchantId, transactionId } = await merchantWithCapturedPayment("support");
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'support', 'unused') RETURNING id`,
    [merchantId, `f01b-support-${randomUUID()}@example.test`],
  );
  const raw = randomToken(32);
  await pool.query(
    `INSERT INTO sessions (merchant_user_id, token_hash, authenticated, expires_at) VALUES ($1, $2, true, now() + interval '1 hour')`,
    [u.rows[0]!.id, sha256Hex(raw)],
  );
  const res = await app.inject({
    method: "POST", url: `/v1/merchants/${merchantId}/refunds`,
    headers: { cookie: `${config.cookieName}=${raw}`, "idempotency-key": randomUUID() },
    payload: { transactionId, amountFils: 100 },
  });
  assert.equal(res.statusCode, 403, res.body);
});

test("testF01b_refundShowsInTimeline", async () => {
  const { merchantId, headers, transactionId } = await merchantWithCapturedPayment("timeline");
  const res = await app.inject({
    method: "POST", url: `/v1/merchants/${merchantId}/refunds`, headers: { ...headers, "idempotency-key": randomUUID() },
    payload: { transactionId, amountFils: 1_250 },
  });
  assert.equal(res.statusCode, 200, res.body);
  const events = await app.inject({ method: "GET", url: `/v1/transactions/${transactionId}/events`, headers });
  assert.equal(events.statusCode, 200, events.body);
  const list = (events.json() as { events?: Array<{ eventType?: string; type?: string; amountFils: number }> }).events
    ?? (events.json() as Array<{ eventType?: string; type?: string; amountFils: number }>);
  const refundEvent = list.find((e) => (e.eventType ?? e.type) === "refund_partial");
  assert.ok(refundEvent, events.body);
  assert.equal(refundEvent.amountFils, -1_250);
});
