/**
 * E112, E125, E127 [second review]: date filters must be real dates, and a
 * time must carry its zone. Before the fix `new Date(q.from)` accepted
 * garbage (Postgres error, 500), rolled 2026-02-30 over to March, and read
 * "2026-03-01T00:00" in the server's own time zone; reconciliation and
 * summary checked only that from/to were present.
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
  throw new Error("dateFilters.e112.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 6).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE112_E125_E127_dateFiltersAreChecked", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E112 ${randomUUID()}`]);
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [m.rows[0]!.id, `e112-${randomUUID()}@example.test`],
  );
  const { rawKey } = await issueApiKey(pool, config, { merchantId: m.rows[0]!.id, createdBy: u.rows[0]!.id, label: "e112" });
  const h = { authorization: `Bearer ${rawKey}` };
  const get = (url: string) => app.inject({ method: "GET", url, headers: h });

  for (const url of [
    "/v1/transactions?from=2026-02-30",                 // E112: rolls over to March
    "/v1/transactions?from=yesterday",                  // E112: garbage
    "/v1/transactions?from=2026-03-01T00:00",           // E125: no time zone
    "/v1/transactions/export?to=2026-04-31",            // E112: export too
    "/v1/settlement/batches?from=2026-02-30",           // E127
    "/v1/settlement/reconciliation?from=2026-02-30&to=2026-03-02", // E127
    "/v1/settlement/summary?from=2026-01-01&to=2026-13-01",        // E127
  ]) {
    const r = await get(url);
    assert.equal(r.statusCode, 400, `${url}: ${r.statusCode} ${r.body}`);
  }
  for (const url of [
    "/v1/transactions?from=2026-03-01",
    "/v1/transactions?from=2026-03-01T00:00:00.000Z",   // what the dashboard sends
    "/v1/transactions?from=2026-03-01T00:00:00%2B03:00",
    "/v1/settlement/batches?from=2026-03-01&to=2026-03-31",
    "/v1/settlement/reconciliation?from=2026-03-01&to=2026-03-02",
  ]) {
    const r = await get(url);
    assert.equal(r.statusCode, 200, `${url}: ${r.statusCode} ${r.body}`);
  }
});
