import assert from "node:assert/strict";
import { test } from "node:test";
import { computeResidueFils, monthBounds } from "./reconcile_march.js";

test("computeResidueFils returns the amount lost to 2dp quantization", () => {
  assert.equal(computeResidueFils(4750), 0);
  assert.equal(computeResidueFils(4759), 9);
  assert.equal(computeResidueFils(10), 0);
  assert.equal(computeResidueFils(1), 1);
  assert.equal(computeResidueFils(0), 0);
});

test("monthBounds for March 2026 spans 31 days", () => {
  const { start, end } = monthBounds(2026, 3);
  const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  assert.equal(days, 31);
  // E16: bounds are Bahrain midnights (UTC+3), so check the month in Bahrain time.
  const bahrain = (d: Date) => new Date(d.getTime() + 3 * 60 * 60 * 1000);
  assert.equal(bahrain(start).getUTCMonth(), 2);
  assert.equal(bahrain(end).getUTCMonth(), 3);
});
