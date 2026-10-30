/** E151 [coverage, defence in depth]: validateRefundRequest must not trust
 *  its caller's numbers: a fractional amount, or a refundable figure above
 *  what was captured, must not pass. No DB needed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Fils } from "@filspay/money";
import { validateRefundRequest } from "./refundValidation.js";

const f = (n: number) => n as unknown as Fils;
const txn = (capturedFils: number, refundableFils: number) => ({
  id: "t", merchantId: "m", status: "captured", capturedFils: f(capturedFils), refundableFils: f(refundableFils),
});

test("testE151_refundValidationDoesNotTrustCallerNumbers", () => {
  assert.equal(validateRefundRequest(txn(10_000, 10_000), f(1.5)).ok, false, "1.5 fils is not a valid amount");
  const over = validateRefundRequest(txn(4_000, 10_000), f(6_000));
  assert.equal(over.ok, false, "refundable above captured must not allow refunding more than was captured");
  const all = validateRefundRequest(txn(4_000, 10_000));
  assert.deepEqual(all, { ok: true, amountFils: 4_000 }, "no amount → at most what was captured");
  assert.deepEqual(validateRefundRequest(txn(10_000, 6_000), f(6_000)), { ok: true, amountFils: 6_000 });
});
