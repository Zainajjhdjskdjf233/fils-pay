/**
 * E32 (FP-240a): a merchant who computes HMAC-SHA256 over `${t}.${rawBody}`
 * with their secret must get the v1 value in the signature header — for real
 * deliveries and for "send test event".
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { issueApiKey } from "../apiKeys/issue.js";
import { recordKycReview } from "../onboarding/review.js";
import { createWebhookEndpoint } from "./create.js";
import { runDispatchPass } from "./dispatcher.js";
import { sendTestWebhookEvent } from "./testSend.js";
import type { WebhookTransport, WebhookTransportRequest } from "./transport.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("signRawBody.e32.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl, NODE_ENV: "test", ACQUIRER_FAILURE_RATE: "0", ACQUIRER_LATENCY_MIN_MS: "0", ACQUIRER_LATENCY_MAX_MS: "1",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

function merchantVerifies(req: WebhookTransportRequest, secret: string): boolean {
  const header = Object.entries(req.headers).find(([k]) => k.toLowerCase().includes("signature"))![1];
  const t = /t=(\d+)/.exec(header)![1];
  const v1 = /v1=([0-9a-f]+)/.exec(header)![1];
  return createHmac("sha256", secret).update(`${t}.${req.body}`).digest("hex") === v1;
}

test("testE32_rawBodyHmacMatchesHeader", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E32 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `e32-${randomUUID()}@example.test`],
  );
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label: "e32" });
  const url = `http://fake-receiver.test/e32-${randomUUID()}`;
  const endpoint = await createWebhookEndpoint(pool, config, { merchantId, url, createdByType: "merchant_session", createdById: randomUUID() });
  const h = { authorization: `Bearer ${rawKey}` };
  const auth = await app.inject({
    method: "POST", url: "/v1/transactions", headers: { ...h, "idempotency-key": randomUUID() },
    payload: { amountFils: 10_000, card: { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" } },
  });
  await app.inject({ method: "POST", url: `/v1/transactions/${(auth.json() as { id: string }).id}/capture`, headers: { ...h, "idempotency-key": randomUUID() }, payload: {} });

  const seen: WebhookTransportRequest[] = [];
  const transport: WebhookTransport = async (req) => {
    if (req.url === url) seen.push(req);
    return { statusCode: 200, body: "ok" };
  };
  await runDispatchPass(pool, transport, config);
  assert.ok(seen.length > 0, "a delivery was sent");
  for (const req of seen) assert.ok(merchantVerifies(req, endpoint.secret), `delivery body does not match its signature: ${req.body}`);

  const testSeen: WebhookTransportRequest[] = [];
  await sendTestWebhookEvent(pool, config, async (req) => {
    testSeen.push(req);
    return { statusCode: 200, body: "ok" };
  }, { merchantId, endpointId: endpoint.id });
  assert.ok(merchantVerifies(testSeen[0]!, endpoint.secret), `test event body does not match its signature: ${testSeen[0]!.body}`);
});
