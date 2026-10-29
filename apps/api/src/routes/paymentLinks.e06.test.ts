/**
 * E06 (FP-187): expiry is judged by the server clock. A buyer-sent
 * `submittedAt` in the past must not make an expired link payable.
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
  throw new Error("paymentLinks.e06.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  ACQUIRER_FAILURE_RATE: "0",
  ACQUIRER_LATENCY_MIN_MS: "0",
  ACQUIRER_LATENCY_MAX_MS: "1",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 6).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE06_pastSubmittedAtCannotPayExpiredLink", async () => {
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`E06 ${randomUUID()}`],
  );
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash)
     VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `e06-${randomUUID()}@example.test`],
  );
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label: "e06" });

  const created = await app.inject({
    method: "POST",
    url: `/v1/merchants/${merchantId}/payment-links`,
    headers: { authorization: `Bearer ${rawKey}` },
    payload: {
      amountFils: 4_750,
      reference: "e06",
      description: "E06",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const { token } = created.json() as { token: string };
  // Creation requires a future date, so force expiry in the DB (same as paymentLinks.test.ts).
  await pool.query(`UPDATE payment_links SET expires_at = now() - interval '1 minute' WHERE token = $1`, [token]);

  const payRes = await app.inject({
    method: "POST",
    url: `/v1/payment-links/${token}/pay`,
    headers: { "idempotency-key": randomUUID() },
    payload: {
      card: { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" },
      submittedAt: "2020-01-01T00:00:00Z",
    },
  });
  assert.equal(payRes.statusCode, 410, `expired link must be rejected, got ${payRes.statusCode}: ${payRes.body}`);

  const charged = await pool.query(`SELECT 1 FROM transactions WHERE merchant_id = $1`, [merchantId]);
  assert.equal(charged.rowCount, 0, "no money may move on an expired link");
});
