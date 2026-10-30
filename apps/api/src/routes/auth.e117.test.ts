/**
 * E117 [deep review]: the OTP guess limit must hold per USER across logins,
 * not per code — a new login must not hand out a fresh 5-guess budget forever,
 * and older pending codes/sessions must stop working.
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

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("auth.e117.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  KYC_UPLOAD_DIR: mkdtempSync(join(tmpdir(), "filspay-e117-")),
  OTP_DEV_EXPOSE: "true",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 6 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

async function signup(): Promise<{ merchantId: string; email: string; password: string }> {
  const email = `e117-${randomUUID()}@example.test`;
  const password = "e117-password-123456";
  const res = await app.inject({
    method: "POST", url: "/v1/merchants",
    payload: {
      businessProfile: {
        legalName: `E117 ${randomUUID().slice(0, 6)}`, registrationNumber: `RC-${randomUUID().slice(0, 8)}`, businessType: "llc",
        contactEmail: `c-${randomUUID()}@example.test`, contactPhone: "+97300000000", addressLine1: "1 Test Street", city: "Manama",
      },
      owner: { email, password },
    },
  });
  assert.equal(res.statusCode, 201, res.body);
  return { merchantId: (res.json() as { merchantId: string }).merchantId, email, password };
}

async function login(c: { merchantId: string; email: string; password: string }) {
  const res = await app.inject({ method: "POST", url: "/v1/auth/login", payload: c });
  if (res.statusCode !== 200) return { status: res.statusCode, cookie: "", code: "" };
  const raw = res.headers["set-cookie"];
  return { status: 200, cookie: (Array.isArray(raw) ? raw[0]! : raw!).split(";")[0]!, code: (res.json() as { devOtpCode: string }).devOtpCode };
}

const wrong = (code: string) => (code === "000000" ? "111111" : "000000");
const verify = (cookie: string, code: string) =>
  app.inject({ method: "POST", url: "/v1/auth/otp/verify", headers: { cookie }, payload: { code } });

test("testE117_newLoginKillsOlderPendingCodes", async () => {
  const c = await signup();
  const first = await login(c);
  const second = await login(c);
  const old = await verify(first.cookie, first.code);
  assert.notEqual(old.statusCode, 200, `the first login's code must stop working after a new login: ${old.body}`);
  const ok = await verify(second.cookie, second.code);
  assert.equal(ok.statusCode, 200, ok.body);
});

test("testE117_guessBudgetIsPerUserAcrossLogins", async () => {
  const c = await signup();
  let guesses = 0;
  for (let round = 0; round < 4; round++) {
    const l = await login(c);
    if (l.status === 429) break;
    for (let i = 0; i < 5; i++) {
      const r = await verify(l.cookie, wrong(l.code));
      if (r.statusCode === 401) guesses++;
    }
  }
  assert.ok(guesses <= 10, `${guesses} wrong guesses were checked across logins (per-user limit 10 per 15 min)`);
  const locked = await login(c);
  assert.equal(locked.status, 429, "after the per-user limit, a new login is refused for a while");
});
