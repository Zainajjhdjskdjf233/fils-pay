/**
 * E165 [second review, items 59, 61]: authorize and capture amounts must be
 * positive whole numbers of fils. 0 reached the acquirer and then the DB
 * CHECK (500); a negative value made toFils throw (500).
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { issueApiKey } from "../apiKeys/issue.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("amounts.e165.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 6).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE165_zeroOrNegativeAmountIs400", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps, onboarding_status, kyc_passed) VALUES ($1, 250, 'approved', true) RETURNING id`, [`E165 ${randomUUID()}`]);
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [m.rows[0]!.id, `e165-${randomUUID()}@example.test`],
  );
  const { rawKey } = await issueApiKey(pool, config, { merchantId: m.rows[0]!.id, createdBy: u.rows[0]!.id, label: "e165" });
  const h = { authorization: `Bearer ${rawKey}` };
  const card = { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" };
  for (const amountFils of [0, -1, 1.5, null, "5000"]) {
    const r = await app.inject({ method: "POST", url: "/v1/transactions", headers: { ...h, "idempotency-key": randomUUID() }, payload: { amountFils, card } });
    assert.equal(r.statusCode, 400, `authorize ${amountFils}: ${r.statusCode} ${r.body}`);
  }
  const ok = await app.inject({ method: "POST", url: "/v1/transactions", headers: { ...h, "idempotency-key": randomUUID() }, payload: { amountFils: 5000, card } });
  const id = (ok.json() as { id: string }).id;
  for (const amountFils of [0, -1]) {
    const r = await app.inject({ method: "POST", url: `/v1/transactions/${id}/capture`, headers: { ...h, "idempotency-key": randomUUID() }, payload: { amountFils } });
    assert.equal(r.statusCode, 400, `capture ${amountFils}: ${r.statusCode} ${r.body}`);
  }
});
