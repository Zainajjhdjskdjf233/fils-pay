/**
 * E58 (FP-198 comment): a request carrying BOTH a real merchant session for
 * merchant A and an impersonation grant for merchant B must act as A only;
 * with an expired session it must act as the grant (role support) only.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { startImpersonation } from "../admin/impersonation.js";
import { randomToken, sha256Hex } from "../lib/crypto.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("requireMerchantAuth.e58.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

async function merchant(label: string) {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E58 ${label} ${randomUUID()}`]);
  await pool.query(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference, reference) VALUES ($1, 'captured', 1000, 1000, $2, $3)`,
    [m.rows[0]!.id, `acq-${randomUUID()}`, `ref-${label}`],
  );
  return m.rows[0]!.id;
}

async function sessionCookie(merchantId: string, expired: boolean): Promise<string> {
  const u = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, role, password_hash) VALUES ($1, $2, 'owner', 'unused') RETURNING id`,
    [merchantId, `e58-${randomUUID()}@example.test`],
  );
  const raw = randomToken(32);
  await pool.query(
    `INSERT INTO sessions (merchant_user_id, token_hash, authenticated, expires_at) VALUES ($1, $2, true, now() + $3::interval)`,
    [u.rows[0]!.id, sha256Hex(raw), expired ? "-1 hour" : "1 hour"],
  );
  return `${config.cookieName}=${raw}`;
}

test("testE58_bothCookiesNeverMixIdentities", async () => {
  const a = await merchant("A");
  const b = await merchant("B");
  const admin = await pool.query<{ id: string }>(
    `INSERT INTO admin_users (email, password_hash, display_name, role) VALUES ($1, 'x', 'E58', 'super_admin') RETURNING id`,
    [`e58-${randomUUID()}@admin.test`],
  );
  const grant = await startImpersonation(pool, { adminUserId: admin.rows[0]!.id, merchantId: b, ttlMinutes: 30 });
  const grantCookie = `${config.impersonationCookieName}=${grant.rawToken}`;

  const refs = async (cookie: string) => {
    const res = await app.inject({ method: "GET", url: "/v1/transactions", headers: { cookie } });
    assert.equal(res.statusCode, 200, res.body);
    return JSON.stringify(res.json());
  };

  const both = await refs(`${await sessionCookie(a, false)}; ${grantCookie}`);
  assert.ok(both.includes("ref-A") && !both.includes("ref-B"), `valid session + grant must act as A only: ${both}`);

  const expiredPlusGrant = `${await sessionCookie(a, true)}; ${grantCookie}`;
  const asGrant = await refs(expiredPlusGrant);
  assert.ok(asGrant.includes("ref-B") && !asGrant.includes("ref-A"), `expired session + grant must act as B only: ${asGrant}`);
  const capture = await app.inject({ method: "POST", url: `/v1/transactions/${randomUUID()}/void`, headers: { cookie: expiredPlusGrant } });
  assert.equal(capture.statusCode, 403, "the grant keeps its support role (no writes)");
});
