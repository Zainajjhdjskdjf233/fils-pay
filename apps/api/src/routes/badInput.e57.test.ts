/**
 * E57: bad input must give 400/413/415, never 500. Fastify's own client
 * errors (broken JSON, body over 1 MiB, unknown media type) were turned into
 * 500 by errorHandler, and a non-UUID login merchantId reached Postgres.
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
  throw new Error("badInput.e57.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 6).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE57_fastifyClientErrorsAre4xx", async () => {
  const post = (payload: string, ct = "application/json") =>
    app.inject({ method: "POST", url: "/v1/auth/login", headers: { "content-type": ct }, payload });
  const cases: Array<[string, Promise<{ statusCode: number; body: string }>, number]> = [
    ["broken JSON", post('{"merchantId":'), 400],
    ["body over 1 MiB", post(JSON.stringify({ pad: "x".repeat(1_100_000) })), 413],
    ["unknown media type", post("<a/>", "application/xml"), 415],
    ["merchantId not a UUID", post(JSON.stringify({ merchantId: "abc", email: "a@b.c", password: "pw" })), 400],
  ];
  for (const [name, p, want] of cases) {
    const r = await p;
    assert.equal(r.statusCode, want, `${name}: ${r.statusCode} ${r.body}`);
  }
});

test("testE57_malformedIdsInTheUrlAre400", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E57 ${randomUUID()}`]);
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [m.rows[0]!.id, `e57-${randomUUID()}@example.test`],
  );
  const { rawKey } = await issueApiKey(pool, config, { merchantId: m.rows[0]!.id, createdBy: u.rows[0]!.id, label: "e57" });
  const h = { authorization: `Bearer ${rawKey}` };
  for (const url of ["/v1/transactions/not-a-uuid", "/v1/settlement/batches/not-a-uuid", "/v1/transactions/not-a-uuid/events"]) {
    const r = await app.inject({ method: "GET", url, headers: h });
    assert.ok(r.statusCode === 400 || r.statusCode === 404, `${url}: ${r.statusCode} ${r.body}`);
  }
});
