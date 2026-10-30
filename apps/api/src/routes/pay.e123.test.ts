/**
 * E123 [deep review]: a malformed card ({"card":{}}) must give 400 before the
 * link is claimed. Before the fix the simulator threw on `card.pan.endsWith`
 * after the claim: 500, and the link stayed blocked ("processing") for 60 s.
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
  throw new Error("pay.e123.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
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

const good = { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" };
const badCards: unknown[] = [
  {},
  { pan: 4242424242424242, expiryMonth: 12, expiryYear: 2030, cvv: "123" },
  { ...good, pan: "abcd" },
  { ...good, expiryMonth: 13 },
  { ...good, expiryYear: "2030" },
  { ...good, cvv: 123 },
  "4242424242424242",
];

test("testE123_malformedCardIs400AndDoesNotBlockTheLink", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E123 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `e123-${randomUUID()}@example.test`],
  );
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label: "e123" });
  const h = { authorization: `Bearer ${rawKey}` };
  const link = await app.inject({
    method: "POST", url: `/v1/merchants/${merchantId}/payment-links`, headers: h,
    payload: { amountFils: 5_000, reference: "e123", description: "E123", expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  });
  const { token } = link.json() as { token: string };

  for (const card of badCards) {
    const pay = await app.inject({ method: "POST", url: `/v1/payment-links/${token}/pay`, headers: { "idempotency-key": randomUUID() }, payload: { card } });
    assert.equal(pay.statusCode, 400, `link pay with card ${JSON.stringify(card)}: ${pay.body}`);
    const api = await app.inject({ method: "POST", url: "/v1/transactions", headers: { ...h, "idempotency-key": randomUUID() }, payload: { amountFils: 1_000, card } });
    assert.equal(api.statusCode, 400, `card API with card ${JSON.stringify(card)}: ${api.body}`);
  }

  // The link was never claimed, so a real buyer can pay right away.
  const pay = await app.inject({ method: "POST", url: `/v1/payment-links/${token}/pay`, headers: { "idempotency-key": randomUUID() }, payload: { card: { ...good, pan: "4242 4242 4242 4242" } } });
  assert.equal(pay.statusCode, 200, `a PAN typed with spaces must still pay: ${pay.body}`);
});
