/**
 * E45 (second review item 29): /v1/reporting/export-summary had no
 * requireMerchantAuth preHandler. Anonymous calls must get 401; a merchant
 * gets its own summary (it used to 500 for everyone).
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
  throw new Error("reporting.e45.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl, NODE_ENV: "test",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 6).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE45_exportSummaryNeedsLogin", async () => {
  const anon = await app.inject({ method: "GET", url: "/v1/reporting/export-summary" });
  assert.equal(anon.statusCode, 401, `anonymous call: ${anon.statusCode} ${anon.body}`);

  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E45 ${randomUUID()}`]);
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [m.rows[0]!.id, `e45-${randomUUID()}@example.test`],
  );
  const { rawKey } = await issueApiKey(pool, config, { merchantId: m.rows[0]!.id, createdBy: u.rows[0]!.id, label: "e45" });
  const own = await app.inject({ method: "GET", url: "/v1/reporting/export-summary", headers: { authorization: `Bearer ${rawKey}` } });
  assert.equal(own.statusCode, 200, own.body);
  assert.deepEqual(own.json(), { totalDays: 0, grossFils: 0 });
});
