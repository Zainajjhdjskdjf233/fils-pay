/** E94: in production the API refuses a weak settlement internal token
 *  (only an empty one was refused). No DB needed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "./config.js";

const prod = {
  DATABASE_URL: "postgres://x@localhost/x", NODE_ENV: "production",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  ACQUIRER_CALLBACK_SIGNING_SECRET: "a".repeat(64),
};

test("testE94_productionRefusesAWeakSettlementToken", () => {
  assert.throws(() => loadConfig({ ...prod, SETTLEMENT_INTERNAL_TOKEN: "dev-token" }), /SETTLEMENT_INTERNAL_TOKEN/);
  assert.doesNotThrow(() => loadConfig({ ...prod, SETTLEMENT_INTERNAL_TOKEN: "f".repeat(64) }));
  assert.doesNotThrow(() => loadConfig({ ...prod, NODE_ENV: "test", SETTLEMENT_INTERNAL_TOKEN: "test-settlement-token" }));
});
