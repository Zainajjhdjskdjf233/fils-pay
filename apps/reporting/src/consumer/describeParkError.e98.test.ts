/** E98 [found later, my E53 code]: a parked event must not store or log the raw
 *  Postgres message, which can echo input values. Keep the SQLSTATE and the
 *  names of the constraint/table/column instead. Our own PoisonEventError
 *  messages carry no input values and are kept. No DB needed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PoisonEventError } from "./applyEvent.js";
import { describeParkError } from "./runConsumerPass.js";

test("testE98_parkedErrorsKeepCodesNotValues", () => {
  const pg = Object.assign(new Error('invalid input syntax for type bigint: "owner@example.test"'), {
    code: "22P02", table: "merchant_daily_volume", column: "captured_gross_fils", constraint: undefined,
  });
  const d = describeParkError(pg);
  assert.doesNotMatch(d, /owner@example\.test/);
  assert.match(d, /SQLSTATE 22P02/);
  assert.match(d, /column=captured_gross_fils/);
  const poison = new PoisonEventError("payment.captured 42: amountFils is not an integer");
  assert.equal(describeParkError(poison), poison.message);
});
