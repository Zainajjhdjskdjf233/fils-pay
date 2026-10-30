import assert from "node:assert/strict";
import test from "node:test";
import { bhd } from "./format.js";
import { isRefundable, parseRefundAmount } from "./pages/transactions/refundForm.js";

// F01f: the dashboard refund page.

test("testF01f_negativeAmountsRender", () => {
  // Refund rows in the timeline are negative (-1250); bhd() threw on them.
  assert.equal(bhd(-1250), "-1.250 BHD");
  assert.equal(bhd(4750), "4.750 BHD");
});

test("testF01f_refundAmountIsTypedInBd", () => {
  assert.deepEqual(parseRefundAmount("1.250", 10_000), { ok: true, fils: 1250 });
  assert.deepEqual(parseRefundAmount(" 10 ", 10_000), { ok: true, fils: 10_000 });
  assert.equal(parseRefundAmount("", 10_000).ok, false);
  assert.equal(parseRefundAmount("0", 10_000).ok, false);
  assert.equal(parseRefundAmount("1.2345", 10_000).ok, false);
  assert.equal(parseRefundAmount("10.001", 10_000).ok, false, "more than still refundable");
  assert.equal(parseRefundAmount("abc", 10_000).ok, false);
});

test("testF01f_whichTransactionsCanBeRefunded", () => {
  assert.equal(isRefundable({ status: "captured", capturedFils: 10_000, refundedFils: 0 }), true);
  assert.equal(isRefundable({ status: "partially_refunded", capturedFils: 10_000, refundedFils: 1_250 }), true);
  assert.equal(isRefundable({ status: "partially_captured", capturedFils: 4_000, refundedFils: 0 }), true);
  assert.equal(isRefundable({ status: "refunded", capturedFils: 10_000, refundedFils: 10_000 }), false);
  assert.equal(isRefundable({ status: "authorized", capturedFils: 0, refundedFils: 0 }), false);
  assert.equal(isRefundable({ status: "partially_captured", capturedFils: 4_000, refundedFils: 4_000 }), false, "nothing left");
});
