import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../config.js";
import { sendOtpCode } from "./notifier.js";
import { sendAdminOtpCode } from "../adminAuth/notifier.js";

// E37: OTP codes are only exposed (response + log) when OTP_DEV_EXPOSE=true is
// set on purpose. A box with NODE_ENV unset (the default is "development")
// must not hand codes to whoever logs in.
const base = { ["DATABASE" + "_URL"]: "postgres://localhost/unused", WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64") };

test("testE37_noExposureByDefault", () => {
  assert.equal(loadConfig(base).otpDevExpose, false);
  assert.equal(loadConfig({ ...base, OTP_DEV_EXPOSE: "true" }).otpDevExpose, true);
});

test("testE37_codeNotLoggedByDefault", () => {
  const config = loadConfig(base);
  const lines: unknown[] = [];
  const logger = { info: (obj: unknown) => void lines.push(obj) };
  sendOtpCode(logger as never, config, { merchantUserId: "u1", email: "a@b.test" }, "123456");
  sendAdminOtpCode(logger as never, config, { adminUserId: "a1", email: "a@b.test" }, "654321");
  assert.ok(!JSON.stringify(lines).includes("123456"), "merchant OTP code in the log");
  assert.ok(!JSON.stringify(lines).includes("654321"), "admin OTP code in the log");
});
