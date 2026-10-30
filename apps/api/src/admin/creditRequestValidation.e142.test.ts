/** E142 [coverage]: a credit memo with control characters (NUL, CR, LF) is
 *  refused with 400 before it reaches Postgres or the audit export. No DB needed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCreditRequestInput } from "./creditRequestValidation.js";

const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

test("testE142_memoWithControlCharactersIs400", () => {
  for (const memo of ["x\u0000y", "ok\r\nFAKE", "a\u001bb"]) {
    assert.throws(
      () => parseCreditRequestInput({ baseAmountFils: 1000, reasonCode: "goodwill", effectiveDate: today, memo }),
      (err: unknown) => (err as { statusCode?: number; code?: string }).statusCode === 400 && (err as { code?: string }).code === "invalid_memo",
      JSON.stringify(memo),
    );
  }
  assert.equal(parseCreditRequestInput({ baseAmountFils: 1000, reasonCode: "goodwill", effectiveDate: today, memo: "  fine  " }).memo, "fine");
});
