/**
 * E35: a `support` merchant user must not capture or void payments.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { issueApiKey } from "../apiKeys/issue.js";
import { recordKycReview } from "../onboarding/review.js";
import { randomToken, sha256Hex } from "../lib/crypto.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("transactions.e35.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl, NODE_ENV: "test", ACQUIRER_FAILURE_RATE: "0", ACQUIRER_LATENCY_MIN_MS: "0", ACQUIRER_LATENCY_MAX_MS: "1",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

async function sessionCookie(merchantId: string, role: "owner" | "finance" | "support"): Promise<string> {
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, $3, 'unused') RETURNING id`,
    [merchantId, `e35-${role}-${randomUUID()}@example.test`, role],
  );
  const raw = randomToken(32);
  await pool.query(
    `INSERT INTO sessions (merchant_user_id, token_hash, authenticated, expires_at) VALUES ($1, $2, true, now() + interval '1 hour')`,
    [u.rows[0]!.id, sha256Hex(raw)],
  );
  return `${config.cookieName}=${raw}`;
}

test("testE35_supportCannotCaptureOrVoid_financeCan", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E35 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const owner = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `e35-o-${randomUUID()}@example.test`],
  );
  await recordKycReview(pool, { merchantId, outcome: "approved", reviewerIdentifier: "test" });
  const { rawKey } = await issueApiKey(pool, config, { merchantId, createdBy: owner.rows[0]!.id, label: "e35" });
  const authorize = async () =>
    ((await app.inject({
      method: "POST", url: "/v1/transactions", headers: { authorization: `Bearer ${rawKey}`, "idempotency-key": randomUUID() },
      payload: { amountFils: 5_000, card: { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" } },
    })).json() as { id: string }).id;

  const support = await sessionCookie(merchantId, "support");
  const t1 = await authorize();
  const cap = await app.inject({ method: "POST", url: `/v1/transactions/${t1}/capture`, headers: { cookie: support, "idempotency-key": randomUUID() }, payload: {} });
  assert.equal(cap.statusCode, 403, `support capture: ${cap.body}`);
  const vd = await app.inject({ method: "POST", url: `/v1/transactions/${t1}/void`, headers: { cookie: support } });
  assert.equal(vd.statusCode, 403, `support void: ${vd.body}`);

  const finance = await sessionCookie(merchantId, "finance");
  const ok = await app.inject({ method: "POST", url: `/v1/transactions/${t1}/capture`, headers: { cookie: finance, "idempotency-key": randomUUID() }, payload: {} });
  assert.equal(ok.statusCode, 200, `finance capture: ${ok.body}`);
});
