/**
 * E162 [second review, item 40]: the adjustment CSV has exactly three columns
 * and no quoting. A row with more cells (an amount written "1,000.000", or a
 * comma in the reason) must be refused, not cut down: before the fix
 * "1,000.000" posted 1 BD with reason "000.000".
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAdjustmentCsv } from "./adjustmentCsvParsing.js";

const M = "9972daab-2c86-459f-9d78-3fe1be4e3280";
const isCode = (code: string) => (err: unknown) => (err as { code?: string }).code === code;

test("testE162_extraColumnsAreRefused", () => {
  assert.throws(() => parseAdjustmentCsv(`merchantId,amount,reason\n${M},1,000.000,refund for March\n`), isCode("invalid_csv_row"));
  assert.throws(() => parseAdjustmentCsv(`merchantId,amount,reason\n${M},5.000,refund, March\n`), isCode("invalid_csv_row"));
  assert.throws(() => parseAdjustmentCsv(`merchantId,amount,reason,extra\n${M},5.000,x,y\n`), isCode("invalid_csv_header"));
  assert.throws(() => parseAdjustmentCsv(`merchantId,amount,note\n${M},5.000,x\n`), isCode("invalid_csv_header"));
});

test("testE162_validRowsStillParse", () => {
  assert.deepEqual(parseAdjustmentCsv(`merchantId,amount,reason\n${M},1000.000,refund for March\n${M},4.750\n`), [
    { merchantId: M, amount: "1000.000", reason: "refund for March" },
    { merchantId: M, amount: "4.750" },
  ]);
});
