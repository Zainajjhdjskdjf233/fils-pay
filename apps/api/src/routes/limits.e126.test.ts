/**
 * E126 [second review]: `limit` must be a whole number. Each route used
 * Number.parseInt: "abc" became NaN (LIMIT NaN → 500), "10abc" silently 10.
 * Routes still clamp whole numbers to their own range.
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
  throw new Error("limits.e126.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 6).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE126_limitMustBeAWholeNumber", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E126 ${randomUUID()}`]);
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [m.rows[0]!.id, `e126-${randomUUID()}@example.test`],
  );
  const { rawKey } = await issueApiKey(pool, config, { merchantId: m.rows[0]!.id, createdBy: u.rows[0]!.id, label: "e126" });
  const h = { authorization: `Bearer ${rawKey}` };
  const get = (url: string) => app.inject({ method: "GET", url, headers: h });
  for (const url of [
    "/v1/transactions?limit=abc",          // NaN reached SQL: LIMIT NaN → 500
    "/v1/transactions?limit=10abc",        // silently became 10
    "/v1/settlement/batches?limit=1e3",
    "/v1/analytics/top-links?limit=10garbage", // item 34, analytics.ts:122
  ]) {
    const r = await get(url);
    assert.equal(r.statusCode, 400, `${url}: ${r.statusCode} ${r.body}`);
  }
  for (const url of ["/v1/transactions?limit=5", "/v1/transactions?limit=1000", "/v1/settlement/batches?limit=0"]) {
    const r = await get(url);
    assert.equal(r.statusCode, 200, `${url}: ${r.statusCode} ${r.body}`);
  }
});
