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
