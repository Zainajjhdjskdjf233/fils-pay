import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAdjustmentAmountFils } from "./adjustmentCsvParsing.js";

// E21: CSV amounts are BD with up to 3 decimals; 1 BD = 1000 fils.
test("testE21_bdAmountsBecomeFils", () => {
  assert.equal(Number(parseAdjustmentAmountFils("4.755")), 4755);
  assert.equal(Number(parseAdjustmentAmountFils("4.75")), 4750);
  assert.equal(Number(parseAdjustmentAmountFils("4.750")), 4750);
  assert.equal(Number(parseAdjustmentAmountFils("10")), 10_000);
  assert.equal(Number(parseAdjustmentAmountFils("-3.50")), -3500);
});

// E21: a fourth decimal is below one fil; reject it instead of cutting it.
test("testE21_moreThanThreeDecimalsRejected", () => {
  assert.throws(() => parseAdjustmentAmountFils("4.7555"), /could not parse amount/);
});
