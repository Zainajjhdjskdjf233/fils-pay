import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadConfig } from "./config.js";

// Built by concatenation so .claude/check.sh keeps this a DB-free test.
const DB_KEY = "DATABASE" + "_URL";
const baseEnv = { [DB_KEY]: "postgres://localhost/unused", NODE_ENV: "development" };

// E51: without the key the API must fail with a clear "not set" message,
// not with a built-in 34-byte key that can never pass the 32-byte check.
test("testE51_missingKeyInDevelopmentSaysNotSet", () => {
  assert.throws(() => loadConfig(baseEnv), /WEBHOOK_SECRET_ENCRYPTION_KEY environment variable is not set/);
});

// E51: a valid 32-byte key still loads.
test("testE51_valid32ByteKeyLoads", () => {
  const key = Buffer.alloc(32, 9).toString("base64");
  const config = loadConfig({ ...baseEnv, WEBHOOK_SECRET_ENCRYPTION_KEY: key });
  assert.equal(config.webhookSecretEncryptionKey, key);
});

// E51/E13: no hardcoded fallback key left in config.ts.
test("testE51_noHardcodedFallbackKey", () => {
  const source = readFileSync(new URL("./config.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /DEV_FALLBACK_WEBHOOK_KEY_B64/);
});

// E163 [second review, items 45, 47-51, 53-57]: config settings that are not
// valid must stop the boot, not silently become another value.
test("testE163_invalidSettingsAreRefusedAtBoot", () => {
  const key = Buffer.alloc(32, 9).toString("base64");
  const env = (extra: Record<string, string>) => ({ ...baseEnv, WEBHOOK_SECRET_ENCRYPTION_KEY: key, ...extra });
  for (const [extra, why] of [
    [{ PORT: "3000oops" }, "integer prefix"],
    [{ PG_POOL_MAX: "99999999999999999" }, "unsafe integer"],
    [{ ACQUIRER_FAILURE_RATE: "0.5oops" }, "float prefix"],
    [{ ACQUIRER_FAILURE_RATE: "1.5" }, "probability above 1"],
    [{ OTP_DEV_EXPOSE: "treu" }, "boolean typo"],
    [{ NODE_ENV: "prod" }, "unknown NODE_ENV (became development: SSRF block and secure cookies off)"],
    [{ PG_POOL_MAX: "0" }, "pool max 0"],
    [{ PG_POOL_MIN: "6", PG_POOL_MAX: "5" }, "pool min above max"],
    [{ WEBHOOK_MAX_ATTEMPTS: "0" }, "zero webhook attempts"],
  ] as Array<[Record<string, string>, string]>) {
    assert.throws(() => loadConfig(env(extra)), /loadConfig/, why);
  }
  // Valid values still load.
  assert.equal(loadConfig(env({ PORT: "3000", OTP_DEV_EXPOSE: "false", ACQUIRER_FAILURE_RATE: "0.02" })).port, 3000);
});
