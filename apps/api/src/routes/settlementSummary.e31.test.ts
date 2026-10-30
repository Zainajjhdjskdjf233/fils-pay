/**
 * E31: the settlement summary must count each captured fil once, even when a
 * payment was captured in several parts.
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
  throw new Error("settlementSummary.e31.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl, NODE_ENV: "test", ACQUIRER_FAILURE_RATE: "0", ACQUIRER_LATENCY_MIN_MS: "0", ACQUIRER_LATENCY_MAX_MS: "1",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE31_partialCapturesCountedOnce", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E31 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `e31-${randomUUID()}@example.test`],
  );
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label: "e31" });
  const h = { authorization: `Bearer ${rawKey}` };
  const auth = await app.inject({
    method: "POST", url: "/v1/transactions", headers: { ...h, "idempotency-key": randomUUID() },
    payload: { amountFils: 10_000, card: { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" } },
  });
  const tx = (auth.json() as { id: string }).id;
  for (const amountFils of [4_000, 6_000]) {
    const c = await app.inject({ method: "POST", url: `/v1/transactions/${tx}/capture`, headers: { ...h, "idempotency-key": randomUUID() }, payload: { amountFils } });
    assert.equal(c.statusCode, 200, c.body);
  }
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 27 * 3600_000).toISOString().slice(0, 10);
  const res = await app.inject({ method: "GET", url: `/v1/settlement/summary?from=${today}&to=${tomorrow}`, headers: h });
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json() as { transactionCount: number; totalCapturedFils: number };
  assert.equal(body.transactionCount, 1);
  assert.equal(body.totalCapturedFils, 10_000, "4.000 + 6.000 BD captured = 10.000 BD, not 20.000");
});
