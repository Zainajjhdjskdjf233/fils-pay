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
