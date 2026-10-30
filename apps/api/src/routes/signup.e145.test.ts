/**
 * E145 [coverage]: public signup checked only that fields were truthy. A
 * 1-character password was accepted (201), a number password crashed argon2
 * (500), and a bad businessType or a 3-letter country hit DB constraints (500).
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("signup.e145.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 6).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => {
  await app.close();
  await pool.end();
});

function body(bp: Record<string, unknown>, password: unknown) {
  return {
    businessProfile: {
      legalName: `E145 ${randomUUID().slice(0, 6)}`, registrationNumber: `RC-${randomUUID().slice(0, 8)}`, businessType: "llc",
      contactEmail: `c-${randomUUID()}@example.test`, contactPhone: "+97300000000", addressLine1: "1 Test Street", city: "Manama", ...bp,
    },
    owner: { email: `e145-${randomUUID()}@example.test`, password },
  };
}

test("testE145_badSignupInputIs400Not201Or500", async () => {
  const cases: Array<[string, Record<string, unknown>, unknown]> = [
    ["short password", {}, "a"],
    ["number password", {}, 123],
    ["bad businessType", { businessType: "x" }, "e145-password-123456"],
    ["3-letter country", { country: "BHR" }, "e145-password-123456"],
  ];
  for (const [name, bp, pw] of cases) {
    const res = await app.inject({ method: "POST", url: "/v1/merchants", payload: body(bp, pw) });
    assert.equal(res.statusCode, 400, `${name}: ${res.statusCode} ${res.body}`);
  }
  const ok = await app.inject({ method: "POST", url: "/v1/merchants", payload: body({ country: "BH" }, "e145-password-123456") });
  assert.equal(ok.statusCode, 201, ok.body);
});

test("testE145_profilePatchChecksTypeAndCountry", async () => {
  const { updateBusinessProfile } = await import("../onboarding/businessProfile.js");
  const created = await app.inject({ method: "POST", url: "/v1/merchants", payload: body({}, "e145-password-123456") });
  const merchantId = (created.json() as { merchantId: string }).merchantId;
  for (const patch of [{ businessType: "x" }, { country: "BHR" }, { legalName: 42 }]) {
    await assert.rejects(
      updateBusinessProfile(pool, merchantId, patch as never),
      (err: unknown) => (err as { statusCode?: number }).statusCode === 400,
      `patch ${JSON.stringify(patch)}`,
    );
  }
  const ok = await updateBusinessProfile(pool, merchantId, { city: "Muharraq" });
  assert.equal(ok.city, "Muharraq");
});

// E145 (rest): the owner email must look like an email, and login must not
// depend on letter case (signup stored it as typed; login compared exactly).
test("testE145_ownerEmailIsCheckedAndCaseInsensitive", async () => {
  for (const email of ["not-an-email", "a@b", "x y@example.test", "a\r\n@example.test", "a\u0000b@example.test"]) {
    const b = body({}, "e145-password-123456");
    b.owner.email = email;
    const res = await app.inject({ method: "POST", url: "/v1/merchants", payload: b });
    assert.equal(res.statusCode, 400, `${JSON.stringify(email)}: ${res.statusCode} ${res.body}`);
  }
  const b = body({}, "e145-password-123456");
  const mixed = `Owner-${randomUUID().slice(0, 8)}@Example.TEST`;
  b.owner.email = mixed;
  const created = await app.inject({ method: "POST", url: "/v1/merchants", payload: b });
  assert.equal(created.statusCode, 201, created.body);
  const merchantId = (created.json() as { merchantId: string }).merchantId;
  const login = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { merchantId, email: mixed.toLowerCase(), password: "e145-password-123456" } });
  assert.equal(login.statusCode, 200, `lower-case login: ${login.body}`);
});
