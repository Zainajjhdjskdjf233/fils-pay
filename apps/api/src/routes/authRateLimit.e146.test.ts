/**
 * E146 [coverage]: public login and signup had no rate limit; each call runs
 * argon2. With AUTH_RATE_LIMIT_PER_MINUTE set, one IP gets 429 + Retry-After
 * after that many calls in a minute, and another IP is not affected.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("authRateLimit.e146.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", AUTH_RATE_LIMIT_PER_MINUTE: "5", WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const app = buildApp(config, pool);
test.after(async () => { await app.close(); await pool.end(); });

const login = (ip: string) => app.inject({
  method: "POST", url: "/v1/auth/login", remoteAddress: ip,
  payload: { merchantId: "00000000-0000-4000-8000-000000000000", email: "nobody@example.test", password: "wrong-password-123" },
});

test("testE146_loginIsRateLimitedPerIp", async () => {
  const codes: number[] = [];
  for (let i = 0; i < 6; i++) codes.push((await login("203.0.113.7")).statusCode);
  assert.deepEqual(codes.slice(0, 5).every((c) => c === 401), true, `${codes}`);
  const sixth = await login("203.0.113.7");
  assert.equal(sixth.statusCode, 429, `${codes} then ${sixth.statusCode}`);
  assert.ok(sixth.headers["retry-after"], "429 carries Retry-After");
  assert.equal((await login("198.51.100.9")).statusCode, 401, "another IP is not limited");
  const signup = await app.inject({ method: "POST", url: "/v1/merchants", remoteAddress: "203.0.113.7", payload: {} });
  assert.equal(signup.statusCode, 429, "signup shares the per-IP budget");
});
