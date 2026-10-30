/**
 * E166 [second review, item 60]: a payment link for 0 fils must be 400. It
 * passed toFils and hit the DB CHECK amount_fils > 0 (0020:31): 500.
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
  throw new Error("paymentLinkCreate.e166.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 6).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

test("testE166_zeroAmountLinkIs400", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E166 ${randomUUID()}`]);
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [m.rows[0]!.id, `e166-${randomUUID()}@example.test`],
  );
  const { rawKey } = await issueApiKey(pool, config, { merchantId: m.rows[0]!.id, createdBy: u.rows[0]!.id, label: "e166" });
  const r = await app.inject({
    method: "POST", url: `/v1/merchants/${m.rows[0]!.id}/payment-links`, headers: { authorization: `Bearer ${rawKey}` },
    payload: { amountFils: 0, reference: "e166", description: "E166", expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  });
  assert.equal(r.statusCode, 400, `${r.statusCode} ${r.body}`);
});

// E174 [second review, item 85]: expiresAt must be a real date with a zone;
// 2026-02-30 rolled over and a zone-less time was read in the server's zone.
test("testE174_expiresAtMustBeRealAndZoned", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E174 ${randomUUID()}`]);
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [m.rows[0]!.id, `e174-${randomUUID()}@example.test`],
  );
  const { rawKey } = await issueApiKey(pool, config, { merchantId: m.rows[0]!.id, createdBy: u.rows[0]!.id, label: "e174" });
  const create = (expiresAt: string) => app.inject({
    method: "POST", url: `/v1/merchants/${m.rows[0]!.id}/payment-links`, headers: { authorization: `Bearer ${rawKey}` },
    payload: { amountFils: 1000, reference: "e174", description: "E174", expiresAt },
  });
  for (const bad of ["2099-02-30T10:00:00Z", "2099-03-01T10:00:00"]) {
    const r = await create(bad);
    assert.equal(r.statusCode, 400, `${bad}: ${r.statusCode} ${r.body}`);
  }
  assert.equal((await create(new Date(Date.now() + 3_600_000).toISOString())).statusCode, 201);
});
