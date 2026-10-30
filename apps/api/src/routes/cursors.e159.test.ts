/**
 * E159 [second review, item 32]: a malformed pagination cursor must never be
 * a 500. The decoders checked only for a "|" separator, so a bad timestamp or
 * id reached a Postgres cast. Expected: 400 (or page one), never 500.
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
  throw new Error("cursors.e159.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 6).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE159_malformedCursorIsNever500", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E159 ${randomUUID()}`]);
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [m.rows[0]!.id, `e159-${randomUUID()}@example.test`],
  );
  const { rawKey } = await issueApiKey(pool, config, { merchantId: m.rows[0]!.id, createdBy: u.rows[0]!.id, label: "e159" });
  const h = { authorization: `Bearer ${rawKey}` };
  const cur = (s: string) => encodeURIComponent(Buffer.from(s, "utf8").toString("base64url"));
  const bad = [cur("abc|def"), cur(`yesterday|${randomUUID()}`), cur("2026-03-01 10:00:00+03|not-a-uuid"), "%%%"];
  for (const path of [`/v1/transactions`, `/v1/settlement/batches`, `/v1/merchants/${m.rows[0]!.id}/payment-links`]) {
    for (const c of bad) {
      const r = await app.inject({ method: "GET", url: `${path}?cursor=${c}`, headers: h });
      assert.ok(r.statusCode === 400 || r.statusCode === 200, `${path} cursor=${c}: ${r.statusCode} ${r.body}`);
    }
  }
});
