/**
 * E84 [found later]: a page on another origin (even same-site) could make a
 * logged-in browser POST to the API (SameSite=Lax only). A cookie-carrying
 * state-changing request whose Origin is not this host is now refused.
 * Requires DATABASE_URL (buildApp needs a pool; no rows are written).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("csrfOrigin.e84.test.ts requires DATABASE_URL");
const config = loadConfig({ DATABASE_URL: databaseUrl, NODE_ENV: "test", WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64") });
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const app = buildApp(config, pool);
test.after(async () => { await app.close(); await pool.end(); });

const post = (headers: Record<string, string>) =>
  app.inject({ method: "POST", url: "/v1/auth/logout", headers: { host: "pay.example.test", ...headers } });

test("testE84_crossOriginCookiePostIsRefused", async () => {
  const cookie = `${config.cookieName}=whatever`;
  const evil = await post({ cookie, origin: "http://evil.example.test" });
  assert.equal(evil.statusCode, 403, evil.body);
  const textPlain = await app.inject({
    method: "POST", url: "/v1/auth/otp/resend",
    headers: { host: "pay.example.test", cookie, origin: "http://shop.example.test", "content-type": "text/plain" }, payload: "x",
  });
  assert.equal(textPlain.statusCode, 403, textPlain.body);
  const same = await post({ cookie, origin: "http://pay.example.test" });
  assert.notEqual(same.statusCode, 403, "same origin is allowed");
  const noOrigin = await post({ cookie });
  assert.notEqual(noOrigin.statusCode, 403, "no Origin header (non-browser client) is allowed");
  const noCookie = await post({ origin: "http://evil.example.test" });
  assert.notEqual(noCookie.statusCode, 403, "without a cookie there is nothing to forge");
});
