/**
 * E135 [coverage]: a single KYC review may only decide a merchant that is
 * 'under_review'. Before the fix it approved a merchant in any state
 * (submitted with no document, rejected, already approved).
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
  throw new Error("adminKycReview.e135.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl, NODE_ENV: "test", OTP_DEV_EXPOSE: "true",
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
  const email = `e135-${randomUUID()}@admin.test`;
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, display_name, role) VALUES ($1, $2, 'E135', 'finance')`,
    [email, await hashPassword(PASSWORD, config)],
  );
  const login = await app.inject({ method: "POST", url: "/v1/admin/auth/login", payload: { email, password: PASSWORD } });
  const cookie = ([] as string[]).concat(login.headers["set-cookie"] ?? []).find((h) => h.startsWith(`${config.adminCookieName}=`))!.split(";")[0]!;
  const verify = await app.inject({
    method: "POST", url: "/v1/admin/auth/otp/verify", headers: { cookie },
    payload: { code: (login.json() as { devOtpCode: string }).devOtpCode },
  });
  assert.equal(verify.statusCode, 200, verify.body);
  return cookie;
}

async function merchantIn(status: string): Promise<string> {
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, onboarding_status, kyc_passed) VALUES ($1, 250, $2, false) RETURNING id`,
    [`E135 ${randomUUID()}`, status],
  );
  return m.rows[0]!.id;
}

test("testE135_kycReviewOnlyDecidesMerchantsUnderReview", async () => {
  const cookie = await financeCookie();
  const review = (id: string, outcome: string) =>
    app.inject({ method: "POST", url: `/v1/admin/merchants/${id}/kyc-reviews`, headers: { cookie }, payload: { outcome } });

  for (const status of ["submitted", "rejected"]) {
    const id = await merchantIn(status);
    const res = await review(id, "approved");
    assert.equal(res.statusCode, 409, `approving a '${status}' merchant: ${res.statusCode} ${res.body}`);
    const row = await pool.query(`SELECT onboarding_status, kyc_passed FROM merchants WHERE id = $1`, [id]);
    assert.deepEqual(row.rows[0], { onboarding_status: status, kyc_passed: false }, "nothing may change");
    const reviews = await pool.query(`SELECT 1 FROM merchant_kyc_reviews WHERE merchant_id = $1`, [id]);
    assert.equal(reviews.rowCount, 0, "no review row for a refused review");
  }

  const id = await merchantIn("under_review");
  assert.equal((await review(id, "approved")).statusCode, 200);
  const again = await review(id, "rejected");
  assert.equal(again.statusCode, 409, `a second decision on an already-decided merchant: ${again.body}`);
  const reviews = await pool.query(`SELECT outcome FROM merchant_kyc_reviews WHERE merchant_id = $1`, [id]);
  assert.deepEqual(reviews.rows, [{ outcome: "approved" }]);
});
