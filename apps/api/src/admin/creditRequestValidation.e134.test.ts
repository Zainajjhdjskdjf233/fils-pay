/**
 * E134 [coverage]: a credit's effectiveDate must be a real business date in a
 * sensible range: not in the future (Bahrain time) and at most 90 days back.
 * Before the fix "2099-12-31" was accepted (the payout would wait until 2099,
 * credit_batch.go pays only occurred_at < window end), and so were
 * "1900-01-01" and "0000-01-01" (E149).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCreditRequestInput } from "./creditRequestValidation.js";

const VALID = { baseAmountFils: 1_000, reasonCode: "goodwill", effectiveDate: "" };
const bahrainDay = (offsetDays: number): string => {
  const d = new Date(Date.now() + 3 * 3600_000);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};
const isDateError = (err: unknown) => (err as { code?: string }).code === "invalid_effective_date";

test("testE134_futureAndAncientDatesAreRefused", () => {
  for (const effectiveDate of ["2099-12-31", bahrainDay(1), bahrainDay(-91), "1900-01-01", "0000-01-01"]) {
    assert.throws(() => parseCreditRequestInput({ ...VALID, effectiveDate }), isDateError, `effectiveDate ${effectiveDate}`);
  }
});

test("testE134_todayAndRecentDatesAreAccepted", () => {
  for (const effectiveDate of [bahrainDay(0), bahrainDay(-1), bahrainDay(-90)]) {
    assert.equal(parseCreditRequestInput({ ...VALID, effectiveDate }).effectiveDate, effectiveDate);
  }
});
