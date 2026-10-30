/**
 * E26: "recompute statuses" must never turn a test merchant live, and must
 * not rewrite chargeback rows.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { hashPassword } from "../adminAuth/passwords.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("adminMerchantsRecompute.e26.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  OTP_DEV_EXPOSE: "true",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

const PASSWORD = "admin-test-password-9000!";

async function financeCookie(): Promise<string> {
  const email = `e26-${randomUUID()}@admin.test`;
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, display_name, role) VALUES ($1, $2, 'E26', 'finance')`,
    [email, await hashPassword(PASSWORD, config)],
  );
  const login = await app.inject({ method: "POST", url: "/v1/admin/auth/login", payload: { email, password: PASSWORD } });
  assert.equal(login.statusCode, 200, login.body);
  const setCookie = ([] as string[]).concat(login.headers["set-cookie"] ?? []);
  const cookie = setCookie.find((h) => h.startsWith(`${config.adminCookieName}=`))!.split(";")[0]!;
  const verify = await app.inject({
    method: "POST", url: "/v1/admin/auth/otp/verify", headers: { cookie },
    payload: { code: (login.json() as { devOtpCode: string }).devOtpCode },
  });
  assert.equal(verify.statusCode, 200, verify.body);
  return cookie;
}

test("testE26_testMerchantStaysTestAndChargebackStays", async () => {
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, status, test_mode) VALUES ($1, 250, 'active', true) RETURNING id`,
    [`E26 ${randomUUID()}`],
  );
  const merchantId = m.rows[0]!.id;
  const tx = async (status: string) =>
    (await pool.query<{ id: string }>(
      `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference)
       VALUES ($1, $2, 10000, 10000, $3) RETURNING id`,
      [merchantId, status, `acq-${randomUUID()}`],
    )).rows[0]!.id;
  await tx("captured");
  const chargebackId = await tx("chargeback");

  const res = await app.inject({
    method: "POST",
    url: `/v1/admin/merchants/${merchantId}/transactions/recompute-statuses`,
    headers: { cookie: await financeCookie() },
  });
  assert.equal(res.statusCode, 200, res.body);

  const flag = await pool.query<{ test_mode: boolean }>(`SELECT test_mode FROM merchants WHERE id = $1`, [merchantId]);
  assert.equal(flag.rows[0]!.test_mode, true, "a status backfill must not turn a test merchant live");
  const cb = await pool.query<{ status: string }>(`SELECT status FROM transactions WHERE id = $1`, [chargebackId]);
  assert.equal(cb.rows[0]!.status, "chargeback", "chargeback rows are not derived from amounts");
});
