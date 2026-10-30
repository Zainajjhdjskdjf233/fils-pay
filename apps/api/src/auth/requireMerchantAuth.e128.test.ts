/**
 * E128 [deep review]: a suspended or closed merchant must lose its live
 * sessions and API keys. Only login checked merchants.status = 'active'.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { issueApiKey } from "../apiKeys/issue.js";
import { randomToken, sha256Hex } from "../lib/crypto.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("requireMerchantAuth.e128.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE128_suspendedMerchantLosesSessionAndApiKey", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E128 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `e128-${randomUUID()}@example.test`],
  );
  const raw = randomToken(32);
  await pool.query(
    `INSERT INTO sessions (merchant_user_id, token_hash, authenticated, expires_at) VALUES ($1, $2, true, now() + interval '1 hour')`,
    [u.rows[0]!.id, sha256Hex(raw)],
  );
  const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: u.rows[0]!.id, label: "e128" });
  const cookie = `${config.cookieName}=${raw}`;
  const viaCookie = () => app.inject({ method: "GET", url: "/v1/transactions", headers: { cookie } });
  const viaKey = () => app.inject({ method: "GET", url: "/v1/transactions", headers: { authorization: `Bearer ${rawKey}` } });
  assert.equal((await viaCookie()).statusCode, 200, "active merchant: session works");
  assert.equal((await viaKey()).statusCode, 200, "active merchant: key works");
  await pool.query(`UPDATE merchants SET status = 'suspended' WHERE id = $1`, [merchantId]);
  assert.equal((await viaCookie()).statusCode, 401, "suspended merchant: session must stop");
  assert.equal((await viaKey()).statusCode, 401, "suspended merchant: API key must stop");
  assert.equal((await app.inject({ method: "GET", url: "/v1/auth/me", headers: { cookie } })).statusCode, 401, "requireSession path too");
});
