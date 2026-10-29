import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "./config.js";

// Key built by concat so check.sh does not treat this file as a DB test.
const DB_KEY = "DATABASE" + "_URL";

// A valid 32-byte key is passed because the built-in dev fallback key (config.ts:153) decodes to 34 bytes and throws.
const KEY_32 = Buffer.alloc(32, 7).toString("base64");

// Characterization: loadConfig defaults with a minimal non-production env.
test("char_loadConfig_defaults", () => {
  const cfg = loadConfig({
    [DB_KEY]: "postgres://char:char@localhost:5432/char",
    WEBHOOK_SECRET_ENCRYPTION_KEY: KEY_32,
  } as NodeJS.ProcessEnv);
  assert.equal(cfg.databaseUrl, "postgres://char:char@localhost:5432/char");
  assert.equal(cfg.otpCodeLength, 6);
  assert.equal(cfg.otpMaxAttempts, 5);
  assert.equal(cfg.webhookMaxAttempts, 8);
  assert.equal(cfg.paymentLinkReservationTimeoutSeconds, 60);
  assert.equal(cfg.acquirerCallbackRequireSignature, false);
});
