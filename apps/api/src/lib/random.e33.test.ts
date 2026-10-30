import assert from "node:assert/strict";
import { test } from "node:test";
import { randomDigits, randomFromAlphabet } from "./random.js";
import { generateOtpCode } from "../auth/otp.js";
import { generateInviteCode } from "../admin/inviteCode.js";

// E33: OTP codes, payment-link tokens and admin invite codes must come from a
// cryptographic source. With Math.random forced to 0, anything still built on
// it repeats the same value.
test("testE33_secretsDoNotUseMathRandom", () => {
  const real = Math.random;
  Math.random = () => 0;
  try {
    const distinct = (f: () => string) => new Set(Array.from({ length: 20 }, f)).size;
    assert.ok(distinct(() => generateOtpCode(6)) > 1, "OTP codes repeat when Math.random is fixed");
    assert.ok(distinct(() => randomDigits(6)) > 1, "randomDigits repeats");
    assert.ok(distinct(() => randomFromAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 22)) > 1, "tokens repeat");
    assert.ok(distinct(() => generateInviteCode()) > 1, "admin invite codes repeat");
  } finally {
    Math.random = real;
  }
});

test("testE33_shapeUnchanged", () => {
  assert.match(randomDigits(6), /^\d{6}$/);
  assert.match(randomFromAlphabet("AB", 10), /^[AB]{10}$/);
  assert.match(generateInviteCode(), /^[A-HJ-NP-Z2-9]{8}$/);
});
