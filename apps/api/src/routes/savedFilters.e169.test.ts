/**
 * E169 [second review, items 69-70]: the saved-filter POST must refuse an
 * array filter and a name that is only spaces (both were stored).
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
  throw new Error("savedFilters.e169.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 6).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE169_savedFilterNeedsAnObjectAndARealName", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E169 ${randomUUID()}`]);
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [m.rows[0]!.id, `e169-${randomUUID()}@example.test`],
  );
  const { rawKey } = await issueApiKey(pool, config, { merchantId: m.rows[0]!.id, createdBy: u.rows[0]!.id, label: "e169" });
  const h = { authorization: `Bearer ${rawKey}` };
  const post = (payload: unknown) => app.inject({ method: "POST", url: "/v1/reporting/saved-filters", headers: h, payload: payload as object });
  for (const bad of [{ name: "x", filter: [] }, { name: "   ", filter: {} }]) {
    const r = await post(bad);
    assert.equal(r.statusCode, 400, `${JSON.stringify(bad)}: ${r.statusCode} ${r.body}`);
  }
  assert.equal((await post({ name: "  March  ", filter: {} })).statusCode, 201);
});

// E171 [second review]: a merchant is capped at 50 saved filters (the old
// comment claimed a CHECK that does not exist). Parallel saves must not pass the cap.
test("testE171_savedFiltersAreCappedAt50", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E171 ${randomUUID()}`]);
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [m.rows[0]!.id, `e171-${randomUUID()}@example.test`],
  );
  const { rawKey } = await issueApiKey(pool, config, { merchantId: m.rows[0]!.id, createdBy: u.rows[0]!.id, label: "e171" });
  const h = { authorization: `Bearer ${rawKey}` };
  await pool.query(
    `INSERT INTO reporting_saved_filters (merchant_id, name, filter_json) SELECT $1, 'f' || g, '{}'::jsonb FROM generate_series(1, 45) g`,
    [m.rows[0]!.id],
  );
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      app.inject({ method: "POST", url: "/v1/reporting/saved-filters", headers: h, payload: { name: `p${i}`, filter: {} } }),
    ),
  );
  const codes = results.map((r) => r.statusCode);
  assert.equal(codes.filter((c) => c === 201).length, 5, `only 5 more fit under the cap: ${codes}`);
  assert.ok(codes.every((c) => c === 201 || c === 409), `${codes}`);
  const n = await pool.query(`SELECT count(*)::int AS n FROM reporting_saved_filters WHERE merchant_id = $1`, [m.rows[0]!.id]);
  assert.equal(n.rows[0].n, 50);
});
