/**
 * E34: the OTP guess limit (5) must hold for parallel guesses, and a resend
 * must not reset it.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { sha256Hex } from "../lib/crypto.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("auth.e34.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  KYC_UPLOAD_DIR: mkdtempSync(join(tmpdir(), "filspay-e34-")),
  OTP_DEV_EXPOSE: "true",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 6).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 10 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

async function pendingLogin(): Promise<{ cookie: string; code: string }> {
  const email = `e34-${randomUUID()}@example.test`;
  const password = "e34-password-123456";
  const signup = await app.inject({
    method: "POST", url: "/v1/merchants",
    payload: {
      businessProfile: {
        legalName: `E34 ${randomUUID().slice(0, 6)}`, registrationNumber: `RC-${randomUUID().slice(0, 8)}`, businessType: "llc",
        contactEmail: `c-${randomUUID()}@example.test`, contactPhone: "+97300000000", addressLine1: "1 Test Street", city: "Manama",
      },
      owner: { email, password },
    },
  });
  assert.equal(signup.statusCode, 201, signup.body);
  const merchantId = (signup.json() as { merchantId: string }).merchantId;
  const login = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { merchantId, email, password } });
  assert.equal(login.statusCode, 200, login.body);
  const raw = login.headers["set-cookie"];
  return { cookie: (Array.isArray(raw) ? raw[0]! : raw!).split(";")[0]!, code: (login.json() as { devOtpCode: string }).devOtpCode };
}

function wrong(code: string): string {
  return code === "000000" ? "111111" : "000000";
}

test("testE34_fiftyParallelGuessesCheckAtMostFive", async () => {
  const { cookie, code } = await pendingLogin();
  const results = await Promise.all(
    Array.from({ length: 50 }, () =>
      app.inject({ method: "POST", url: "/v1/auth/otp/verify", headers: { cookie }, payload: { code: wrong(code) } }),
    ),
  );
  const checked = results.filter((r) => r.statusCode === 401 && r.body.includes("invalid_code")).length;
  assert.ok(checked <= 5, `${checked} guesses were checked against the code (limit 5)`);
});

test("testE34_resendKeepsTheGuessCount", async () => {
  const { cookie, code } = await pendingLogin();
  for (let i = 0; i < 3; i++) {
    await app.inject({ method: "POST", url: "/v1/auth/otp/verify", headers: { cookie }, payload: { code: wrong(code) } });
  }
  // Skip the 30 s resend throttle — only for this cookie's own challenge.
  await pool.query(
    `UPDATE otp_challenges SET created_at = now() - interval '1 minute'
      WHERE id = (SELECT otp_challenge_id FROM sessions WHERE token_hash = $1)`,
    [sha256Hex(cookie.split("=")[1]!)],
  );
  const resend = await app.inject({ method: "POST", url: "/v1/auth/otp/resend", headers: { cookie } });
  assert.equal(resend.statusCode, 200, resend.body);
  const fresh = (resend.json() as { devOtpCode?: string }).devOtpCode ?? "";
  const after = await Promise.all(
    Array.from({ length: 5 }, () =>
      app.inject({ method: "POST", url: "/v1/auth/otp/verify", headers: { cookie }, payload: { code: wrong(fresh) } }),
    ),
  );
  const checked = after.filter((r) => r.statusCode === 401 && r.body.includes("invalid_code")).length;
  assert.ok(checked <= 2, `after 3 wrong guesses and a resend, ${checked} more guesses were checked (should be at most 2)`);
});

// fix-reviewer: a double-click on the right code must log in once and stay logged in.
test("testE34_doubleClickCorrectCodeStaysLoggedIn", async () => {
  const { cookie, code } = await pendingLogin();
  const [a, b] = await Promise.all([
    app.inject({ method: "POST", url: "/v1/auth/otp/verify", headers: { cookie }, payload: { code } }),
    app.inject({ method: "POST", url: "/v1/auth/otp/verify", headers: { cookie }, payload: { code } }),
  ]);
  const codes = [a.statusCode, b.statusCode].sort();
  assert.equal(codes[0], 200, `one verify succeeds: ${a.body} | ${b.body}`);
  assert.notEqual(codes[1], 429, "the second click must not count as out of attempts");
  // E167: the winning verify carries the rotated token.
  const won = a.statusCode === 200 ? a : b;
  const session = ([] as string[]).concat(won.headers["set-cookie"] ?? []).find((h) => h.startsWith(`${config.cookieName}=`))!.split(";")[0]!;
  const me = await app.inject({ method: "GET", url: "/v1/auth/me", headers: { cookie: session } });
  assert.equal(me.statusCode, 200, `session still valid after a double-click: ${me.body}`);
});

// E102: verify must re-issue the session cookie at the full session TTL (12 h),
// not leave the 10-minute pending cookie in place.
test("testE102_verifyReissuesTheCookieForTheSessionTtl", async () => {
  const { cookie, code } = await pendingLogin();
  const verify = await app.inject({ method: "POST", url: "/v1/auth/otp/verify", headers: { cookie }, payload: { code } });
  assert.equal(verify.statusCode, 200, verify.body);
  const setCookie = ([] as string[]).concat(verify.headers["set-cookie"] ?? []).find((h) => h.startsWith(`${config.cookieName}=`));
  assert.ok(setCookie, "verify must send a Set-Cookie for the session");
  assert.match(setCookie!, new RegExp(`Max-Age=${config.sessionTtlHours * 3600}`), setCookie);
});

// E167 [second review]: OTP verify must issue a NEW session token (session
// fixation). The token from the login step must not open the dashboard.
test("testE167_verifyRotatesTheSessionToken", async () => {
  const { cookie, code } = await pendingLogin();
  const verify = await app.inject({ method: "POST", url: "/v1/auth/otp/verify", headers: { cookie }, payload: { code } });
  assert.equal(verify.statusCode, 200, verify.body);
  const fresh = ([] as string[]).concat(verify.headers["set-cookie"] ?? []).find((h) => h.startsWith(`${config.cookieName}=`))!.split(";")[0]!;
  assert.notEqual(fresh, cookie, "verify must hand out a different token");
  const oldMe = await app.inject({ method: "GET", url: "/v1/auth/me", headers: { cookie } });
  assert.equal(oldMe.statusCode, 401, `the pre-login token must not authenticate: ${oldMe.body}`);
  const newMe = await app.inject({ method: "GET", url: "/v1/auth/me", headers: { cookie: fresh } });
  assert.equal(newMe.statusCode, 200, newMe.body);
});
