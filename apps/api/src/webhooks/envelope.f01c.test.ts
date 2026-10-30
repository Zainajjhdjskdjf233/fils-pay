import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEnvelope } from "./envelope.js";

// F01c: refund.succeeded has an explicit public shape (never a spread of the outbox payload).
test("testF01c_refundSucceededEnvelope", () => {
  const env = buildEnvelope("dlv_1", {
    eventType: "refund.succeeded",
    aggregateId: "txn_1",
    createdAt: new Date("2026-10-30T00:00:00Z"),
    payload: {
      merchantId: "m_1", refundId: "r_1", amountFils: 1_250, feeReversedFils: 31,
      refundedTotalFils: 1_250, newStatus: "partially_refunded", internalOnly: "x",
    },
  });
  assert.deepEqual(env, {
    id: "dlv_1",
    type: "refund.succeeded",
    createdAt: "2026-10-30T00:00:00.000Z",
    data: {
      refundId: "r_1", transactionId: "txn_1", merchantId: "m_1", amountFils: 1_250,
      feeReversedFils: 31, refundedTotalFils: 1_250, status: "partially_refunded",
    },
  });
});
