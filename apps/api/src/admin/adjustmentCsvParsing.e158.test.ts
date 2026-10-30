/** E158 [coverage]: an adjustment CSV with more than 1000 data rows is refused
 *  before parsing (one import is one DB transaction; keep it under the 60 s
 *  proxy timeout). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAdjustmentCsv } from "./adjustmentCsvParsing.js";

const M = "9972daab-2c86-459f-9d78-3fe1be4e3280";
const isCode = (code: string) => (err: unknown) => (err as { code?: string }).code === code;

test("testE158_moreThan1000RowsIsRefused", () => {
  const row = `${M},1.000,x\n`;
  assert.throws(() => parseAdjustmentCsv(`merchantId,amount,reason\n${row.repeat(1001)}`), isCode("too_many_rows"));
  assert.equal(parseAdjustmentCsv(`merchantId,amount,reason\n${row.repeat(1000)}`).length, 1000);
});
