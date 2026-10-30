/**
 * E44: reconciliation's "pending" must use the rate payments are really
 * charged (fee schedule), so an unbatched day explains to 0.
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
  throw new Error("reconciliation.e44.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl, NODE_ENV: "test", ACQUIRER_FAILURE_RATE: "0", ACQUIRER_LATENCY_MIN_MS: "0", ACQUIRER_LATENCY_MAX_MS: "1",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE44_pendingUsesTheScheduledRate", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E44 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  await pool.query(`INSERT INTO fee_schedules (merchant_id, mdr_bps, effective_from) VALUES ($1, 200, now() - interval '30 days')`, [merchantId]);
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `e44-${randomUUID()}@example.test`],
  );
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label: "e44" });
  const h = { authorization: `Bearer ${rawKey}` };
  for (const amountFils of [10_000, 3_333]) {
    const a = await app.inject({
      method: "POST", url: "/v1/transactions", headers: { ...h, "idempotency-key": randomUUID() },
      payload: { amountFils, card: { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" } },
    });
    const c = await app.inject({ method: "POST", url: `/v1/transactions/${(a.json() as { id: string }).id}/capture`, headers: { ...h, "idempotency-key": randomUUID() }, payload: {} });
    assert.equal(c.statusCode, 200, c.body);
  }
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 27 * 3600_000).toISOString().slice(0, 10);
  const res = await app.inject({ method: "GET", url: `/v1/settlement/reconciliation?from=${today}&to=${tomorrow}`, headers: h });
  assert.equal(res.statusCode, 200, res.body);
  const report = res.json() as { gapFils: number };
  assert.equal(report.gapFils, 0, res.body);
});
