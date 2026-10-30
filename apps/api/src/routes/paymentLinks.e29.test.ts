/**
 * E29 (incident 2026-05-14): one payment link must never be charged twice,
 * even when a slow payment outlives its reservation and a second buyer
 * re-claims the link. Timeout 0 s + 300 ms acquirer latency forces that race.
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
import { createAcquirerSimulator } from "../acquirer/simulator.js";
import type { AcquirerSimulator } from "../acquirer/types.js";
import { payPaymentLink } from "../paymentLinks/pay.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("paymentLinks.e29.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  ACQUIRER_FAILURE_RATE: "0",
  ACQUIRER_LATENCY_MIN_MS: "300",
  ACQUIRER_LATENCY_MAX_MS: "300",
  PAYMENT_LINK_RESERVATION_TIMEOUT_SECONDS: "0",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 8 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE29_slowPaymentAndSecondBuyerChargeOnce", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E29 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `e29-${randomUUID()}@example.test`],
  );
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label: "e29" });
  const created = await app.inject({
    method: "POST", url: `/v1/merchants/${merchantId}/payment-links`, headers: { authorization: `Bearer ${rawKey}` },
    payload: { amountFils: 4_750, reference: "e29", description: "E29", expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  });
  assert.equal(created.statusCode, 201, created.body);
  const { token } = created.json() as { token: string };

  const pay = () =>
    app.inject({
      method: "POST", url: `/v1/payment-links/${token}/pay`, headers: { "idempotency-key": randomUUID() },
      payload: { card: { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" } },
    });
  const results = await Promise.all([pay(), pay()]);
  const codes = results.map((r) => r.statusCode).sort();

  const captured = await pool.query(
    `SELECT 1 FROM transactions WHERE merchant_id = $1 AND captured_fils > 0`,
    [merchantId],
  );
  assert.equal(captured.rowCount, 1, `link charged ${captured.rowCount} times; responses ${codes} ${results.map((r) => r.body).join(" | ")}`);
  assert.deepEqual(codes, [200, 409], `one buyer pays, the other is told no: ${results.map((r) => r.body).join(" | ")}`);
});

// fix-reviewer: the window while capture itself is running. A's capture takes
// 500 ms; B arrives 100 ms in, after A already passed its ownership check.
test("testE29_secondBuyerDuringASlowCaptureIsRefused", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E29b ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `e29b-${randomUUID()}@example.test`],
  );
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label: "e29b" });
  const created = await app.inject({
    method: "POST", url: `/v1/merchants/${merchantId}/payment-links`, headers: { authorization: `Bearer ${rawKey}` },
    payload: { amountFils: 4_750, reference: "e29b", description: "E29b", expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  });
  assert.equal(created.statusCode, 201, created.body);
  const { token } = created.json() as { token: string };

  const base = createAcquirerSimulator({ ...config, acquirerLatencyMinMs: 0, acquirerLatencyMaxMs: 1 });
  const slowCapture: AcquirerSimulator = {
    authorize: (req) => base.authorize(req),
    capture: async (req) => {
      await new Promise((r) => setTimeout(r, 500));
      return base.capture(req);
    },
    refund: (req) => base.refund(req),
  };
  const pay = () =>
    payPaymentLink(pool, slowCapture, { paymentLinkReservationTimeoutSeconds: 0 }, {
      token, idempotencyKey: randomUUID(),
      card: { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" },
    } as Parameters<typeof payPaymentLink>[3]);
  const a = pay();
  await new Promise((r) => setTimeout(r, 100));
  const b = pay();
  const results = await Promise.all([a, b]);

  const captured = await pool.query(`SELECT 1 FROM transactions WHERE merchant_id = $1 AND captured_fils > 0`, [merchantId]);
  assert.equal(captured.rowCount, 1, `link charged ${captured.rowCount} times: ${JSON.stringify(results)}`);
  assert.deepEqual(results.map((r) => r.statusCode), [200, 409], JSON.stringify(results));
});

// fix-reviewer (re-review): five pays on five links at once must not starve
// a 5-connection pool (each locked pay needs a second connection to capture).
test("testE29_fiveParallelPaysDoNotStarveThePool", async () => {
  const small = new Pool({ connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 2_000 });
  try {
    const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E29c ${randomUUID()}`]);
    const merchantId = m.rows[0]!.id;
    const u = await pool.query<{ id: string }>(
      `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
      [merchantId, `e29c-${randomUUID()}@example.test`],
    );
    await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
    const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label: "e29c" });
    const tokens: string[] = [];
    for (let i = 0; i < 5; i++) {
      const created = await app.inject({
        method: "POST", url: `/v1/merchants/${merchantId}/payment-links`, headers: { authorization: `Bearer ${rawKey}` },
        payload: { amountFils: 1_000 + i, reference: `e29c-${i}`, description: "E29c", expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
      });
      assert.equal(created.statusCode, 201, created.body);
      tokens.push((created.json() as { token: string }).token);
    }
    const base = createAcquirerSimulator({ ...config, acquirerLatencyMinMs: 0, acquirerLatencyMaxMs: 1 });
    const slowCapture: AcquirerSimulator = {
      authorize: (req) => base.authorize(req),
      capture: async (req) => {
        await new Promise((r) => setTimeout(r, 300));
        return base.capture(req);
      },
      refund: (req) => base.refund(req),
    };
    const results = await Promise.all(
      tokens.map((token) =>
        payPaymentLink(small, slowCapture, { paymentLinkReservationTimeoutSeconds: 60, maxConcurrentLockedPays: 2 }, {
          token, idempotencyKey: randomUUID(),
          card: { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" },
        } as Parameters<typeof payPaymentLink>[3]).catch((e: unknown) => ({ statusCode: 500, body: String(e) })),
      ),
    );
    assert.deepEqual(results.map((r) => r.statusCode), [200, 200, 200, 200, 200], JSON.stringify(results));
  } finally {
    await small.end();
  }
});
