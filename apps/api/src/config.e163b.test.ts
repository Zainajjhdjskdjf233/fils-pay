/** E163 (rest): security-relevant numbers must be in a sane range at boot
 *  (an OTP of 1 digit, 0 attempts, an argon2 time cost of 0, a 0-hour
 *  session or a failure rate of 5 were accepted). No DB needed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "./config.js";

const base = { DATABASE_URL: "postgres://x@localhost/x", NODE_ENV: "test", WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64") };

test("testE163_securitySettingsAreRangeChecked", () => {
  for (const [k, v] of [
    ["OTP_CODE_LENGTH", "1"], ["OTP_MAX_ATTEMPTS", "0"], ["OTP_TTL_MINUTES", "0"],
    ["ADMIN_OTP_CODE_LENGTH", "2"], ["ADMIN_OTP_MAX_ATTEMPTS", "1000"],
    ["ARGON2_TIME_COST", "0"], ["ARGON2_MEMORY_KIB", "8"], ["ARGON2_PARALLELISM", "0"],
    ["SESSION_TTL_HOURS", "0"], ["ADMIN_SESSION_TTL_HOURS", "720"], ["IMPERSONATION_TTL_MINUTES", "0"],
    ["ACQUIRER_FAILURE_RATE", "5"],
    ["WEBHOOK_REQUEST_TIMEOUT_MS", "0"], ["WEBHOOK_POLL_INTERVAL_MS", "1"], ["WEBHOOK_MAX_ATTEMPTS", "1000"],
    ["PAYMENT_LINK_RESERVATION_TIMEOUT_SECONDS", "-1"], ["SETTLEMENT_INTERNAL_REQUEST_TIMEOUT_MS", "5"],
  ] as const) {
    assert.throws(() => loadConfig({ ...base, [k]: v }), /loadConfig/, `${k}=${v} must be refused`);
  }
  const ok = loadConfig({ ...base, OTP_CODE_LENGTH: "6", ARGON2_TIME_COST: "2", SESSION_TTL_HOURS: "12" });
  assert.equal(ok.otpCodeLength, 6);
});
