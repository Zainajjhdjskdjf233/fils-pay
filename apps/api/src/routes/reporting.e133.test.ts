/**
 * E133 [second review, item 30]: the report filter JSON must be checked before
 * use. Wrong shape, wrong types, unknown status or bad dates → 400, never 500.
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
  throw new Error("reporting.e133.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 6).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE133_badReportFilterIs400", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E133 ${randomUUID()}`]);
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [m.rows[0]!.id, `e133-${randomUUID()}@example.test`],
  );
  const { rawKey } = await issueApiKey(pool, config, { merchantId: m.rows[0]!.id, createdBy: u.rows[0]!.id, label: "e133" });
  const h = { authorization: `Bearer ${rawKey}` };
  const call = (filter: string) =>
    app.inject({ method: "GET", url: `/v1/reporting/transactions?filter=${encodeURIComponent(filter)}`, headers: h });

  for (const bad of [
    "null", "[1]", "42", '"x"',
    '{"merchantId":123}', '{"merchantId":"not-a-uuid"}',
    '{"status":"stolen"}', '{"status":5}',
    '{"from":"yesterday"}', '{"from":"2026-02-30"}', '{"to":12}', '{"from":"2026-03-01\\r\\n"}',
  ]) {
    const res = await call(bad);
    assert.equal(res.statusCode, 400, `filter ${bad}: ${res.statusCode} ${res.body}`);
  }
  for (const good of ["{}", '{"status":"captured"}', '{"from":"2026-03-01","to":"2026-04-01"}', '{"from":"2026-03-01T00:00:00+03:00"}']) {
    const res = await call(good);
    assert.equal(res.statusCode, 200, `filter ${good}: ${res.body}`);
  }
});
