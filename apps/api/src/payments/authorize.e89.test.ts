/** E89 [found later]: the idempotency request hash must not be computed over
 *  the full card number or the CVV (an unsalted SHA-256 of PAN+CVV can be
 *  brute-forced offline; storing CVV in any form breaks PCI DSS). No DB needed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizeRequestHash } from "./authorize.js";
import { hashRequest } from "./idempotency.js";
import { toFils } from "@filspay/money";

const card = { pan: "4242424242424242", expiryMonth: 12, expiryYear: 2030, cvv: "123" };

test("testE89_requestHashExcludesPanAndCvv", () => {
  const h = authorizeRequestHash({ amountFils: toFils(1000), card, reference: "r1" });
  assert.equal(h, authorizeRequestHash({ amountFils: toFils(1000), card: { ...card, cvv: "999" }, reference: "r1" }), "the CVV must not affect the stored hash");
  assert.equal(h, hashRequest({ amountFils: 1000, card: { last4: "4242", expiryMonth: 12, expiryYear: 2030 }, reference: "r1" }));
  assert.notEqual(h, authorizeRequestHash({ amountFils: toFils(2000), card, reference: "r1" }), "a different amount is still a different request");
  assert.notEqual(h, authorizeRequestHash({ amountFils: toFils(1000), card: { ...card, pan: "4000000000000002" }, reference: "r1" }), "a different card (last 4) is still a different request");
});
