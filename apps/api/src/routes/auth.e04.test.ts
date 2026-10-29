/**
 * E04: the OTP challenge and session must belong to the user whose password
 * was checked, never to another merchant's user with the same email.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("auth.e04.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const kycUploadDir = mkdtempSync(join(tmpdir(), "filspay-e04-"));
const config = loadConfig({
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  KYC_UPLOAD_DIR: kycUploadDir,
  OTP_DEV_EXPOSE: "true",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString("base64"),
});
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
  await rm(kycUploadDir, { recursive: true, force: true });
});

async function signup(label: string, email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/v1/merchants",
    payload: {
      businessProfile: {
        legalName: `E04 ${label} ${randomUUID().slice(0, 6)}`,
        registrationNumber: `RC-${randomUUID().slice(0, 8)}`,
        businessType: "llc",
        contactEmail: `contact-${randomUUID()}@example.test`,
        contactPhone: "+97300000000",
        addressLine1: "1 Test Street",
        city: "Manama",
      },
      owner: { email, password },
    },
  });
  assert.equal(res.statusCode, 201, res.body);
  return (res.json() as { merchantId: string }).merchantId;
}

test("testE04_sharedEmailLoginLandsOnOwnMerchant", async () => {
  const email = `e04-${randomUUID()}@example.test`;
  const victimId = await signup("victim", email, "victim-password-123456");
  const attackerPassword = "attacker-password-654321";
  const attackerId = await signup("attacker", email, attackerPassword);

  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { merchantId: attackerId, email, password: attackerPassword },
  });
  assert.equal(login.statusCode, 200, login.body);
  const raw = login.headers["set-cookie"];
  const cookie = (Array.isArray(raw) ? raw[0]! : raw!).split(";")[0]!;
  const verify = await app.inject({
    method: "POST",
    url: "/v1/auth/otp/verify",
    headers: { cookie },
    payload: { code: (login.json() as { devOtpCode: string }).devOtpCode },
  });
  assert.equal(verify.statusCode, 200, verify.body);

  const me = await app.inject({ method: "GET", url: "/v1/auth/me", headers: { cookie } });
  assert.equal(me.statusCode, 200, me.body);
  assert.notEqual(me.json().merchant.id, victimId, "attacker's password must never open the victim's merchant");
  assert.equal(me.json().merchant.id, attackerId);
});
