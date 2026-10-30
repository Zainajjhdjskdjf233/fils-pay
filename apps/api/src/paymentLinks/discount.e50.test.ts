/**
 * E50 (part): a merchant's negotiated discount must apply to a payment-link
 * checkout too, the same as a card-API capture.
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
  throw new Error("discount.e50.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl, NODE_ENV: "test", ACQUIRER_FAILURE_RATE: "0", ACQUIRER_LATENCY_MIN_MS: "0", ACQUIRER_LATENCY_MAX_MS: "1",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

async function netFee(merchantId: string): Promise<number> {
  const r = await pool.query<{ fee: string }>(
    `SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_fils ELSE -amount_fils END), 0) AS fee
       FROM ledger_entries WHERE merchant_id = $1 AND account_id = 'platform_fee_revenue'`,
    [merchantId],
  );
  return Number(r.rows[0]!.fee);
}

test("testE50_paymentLinkGetsTheNegotiatedDiscount", async () => {
  const fees: number[] = [];
  for (const via of ["api", "link"] as const) {
    const m = await pool.query<{ id: string }>(
      `INSERT INTO merchants (display_name, mdr_bps, negotiated_discount_bps) VALUES ($1, 250, 2000) RETURNING id`,
      [`E50 ${via} ${randomUUID()}`],
    );
    const merchantId = m.rows[0]!.id;
    const u = await pool.query<{ id: string }>(
      `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
      [merchantId, `e50-${randomUUID()}@example.test`],
    );
    await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
    const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label: "e50" });
    const h = { authorization: `Bearer ${rawKey}` };
    const card = { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" };
    if (via === "api") {
      const a = await app.inject({ method: "POST", url: "/v1/transactions", headers: { ...h, "idempotency-key": randomUUID() }, payload: { amountFils: 10_000, card } });
      const c = await app.inject({ method: "POST", url: `/v1/transactions/${(a.json() as { id: string }).id}/capture`, headers: { ...h, "idempotency-key": randomUUID() }, payload: {} });
      assert.equal(c.statusCode, 200, c.body);
    } else {
      const link = await app.inject({
        method: "POST", url: `/v1/merchants/${merchantId}/payment-links`, headers: h,
        payload: { amountFils: 10_000, reference: "e50", description: "E50", expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
      });
      const { token } = link.json() as { token: string };
      const pay = await app.inject({ method: "POST", url: `/v1/payment-links/${token}/pay`, headers: { "idempotency-key": randomUUID() }, payload: { card } });
      assert.equal(pay.statusCode, 200, pay.body);
    }
    fees.push(await netFee(merchantId));
  }
  assert.equal(fees[0], 200, "card API: 250 fee minus 20 % discount");
  assert.equal(fees[1], fees[0], `payment link fee ${fees[1]} must equal card API fee ${fees[0]}`);
});
