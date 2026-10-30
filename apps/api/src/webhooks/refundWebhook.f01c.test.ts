/**
 * F01c: a refund made through the API is delivered to the shop's webhook endpoint.
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
import { createWebhookEndpoint } from "./create.js";
import { runDispatchPass } from "./dispatcher.js";
import type { WebhookTransport, WebhookTransportRequest } from "./transport.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("refundWebhook.f01c.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  ACQUIRER_FAILURE_RATE: "0",
  ACQUIRER_LATENCY_MIN_MS: "0",
  ACQUIRER_LATENCY_MAX_MS: "1",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testF01c_refundIsDeliveredAsWebhook", async () => {
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`F01c ${randomUUID()}`],
  );
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `f01c-${randomUUID()}@example.test`],
  );
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label: "f01c" });
  const headers = { authorization: `Bearer ${rawKey}` };
  const url = `http://fake-receiver.test/f01c-${randomUUID()}`;
  await createWebhookEndpoint(pool, config, { merchantId, url, createdByType: "merchant_session", createdById: randomUUID() });

  const auth = await app.inject({
    method: "POST", url: "/v1/transactions", headers: { ...headers, "idempotency-key": randomUUID() },
    payload: { amountFils: 10_000, card: { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" } },
  });
  const transactionId = (auth.json() as { id: string }).id;
  await app.inject({ method: "POST", url: `/v1/transactions/${transactionId}/capture`, headers: { ...headers, "idempotency-key": randomUUID() }, payload: {} });
  const refund = await app.inject({
    method: "POST", url: `/v1/merchants/${merchantId}/refunds`, headers: { ...headers, "idempotency-key": randomUUID() },
    payload: { transactionId, amountFils: 1_250 },
  });
  assert.equal(refund.statusCode, 200, refund.body);

  const seen: WebhookTransportRequest[] = [];
  const transport: WebhookTransport = async (req) => {
    if (req.url === url) seen.push(req);
    return { statusCode: 200, body: "ok" };
  };
  await runDispatchPass(pool, transport, config);

  const types = seen.map((r) => (JSON.parse(r.body) as { type: string }).type);
  assert.ok(types.includes("refund.succeeded"), `delivered types: ${JSON.stringify(types)}`);
  const refundBody = seen.map((r) => JSON.parse(r.body)).find((b) => b.type === "refund.succeeded");
  assert.equal(refundBody.data.amountFils, 1_250);
  assert.equal(refundBody.data.transactionId, transactionId);
});
