/** E156 [coverage]: Buffer.from(x, "hex") stops quietly at the first non-hex
 *  character, so "61" and "61zz" compared equal. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { timingSafeEqualHex } from "./crypto.js";

test("testE156_trailingNonHexIsNotEqual", () => {
  assert.equal(timingSafeEqualHex("61", "61zz"), false);
  assert.equal(timingSafeEqualHex("61", "6"), false);
  assert.equal(timingSafeEqualHex("zz", "qq"), false);
  assert.equal(timingSafeEqualHex("ab", "AB"), true);
});
