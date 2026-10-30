/**
 * E115 [second review]: impossible calendar dates (2026-02-30) must be 400.
 * Date.parse rolled them over to the next month, so the analytics routes
 * answered 200 for a range nobody asked for.
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
  throw new Error("analytics.e115.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 6).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE115_impossibleAnalyticsDateIs400", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E115 ${randomUUID()}`]);
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [m.rows[0]!.id, `e115-${randomUUID()}@example.test`],
  );
  const { rawKey } = await issueApiKey(pool, config, { merchantId: m.rows[0]!.id, createdBy: u.rows[0]!.id, label: "e115" });
  const h = { authorization: `Bearer ${rawKey}` };
  for (const url of [
    "/v1/analytics/volumes?from=2026-02-30&to=2026-03-10",
    "/v1/analytics/top-links?from=2026-01-01&to=2026-02-29",
    "/v1/analytics/payout-trends?from=2025-02-29&to=2025-03-10",
    "/v1/analytics/volumes?from=2026-04-31&to=2026-05-01",
  ]) {
    const r = await app.inject({ method: "GET", url, headers: h });
    assert.equal(r.statusCode, 400, `${url}: ${r.statusCode} ${r.body}`);
  }
  const leap = await app.inject({ method: "GET", url: "/v1/analytics/volumes?from=2024-02-29&to=2024-03-01", headers: h });
  assert.equal(leap.statusCode, 200, `a real leap day must still work: ${leap.body}`);
});
