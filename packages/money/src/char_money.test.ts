import assert from "node:assert/strict";
import { test } from "node:test";
import { allocateRemainder, applyRateFils, formatBhd, parseBhdToFils, toFils } from "./fils.js";

// Characterization: records current money behaviour that later fixes must not change.

test("char_parseBhdToFils_threeDecimals", () => {
  assert.equal(parseBhdToFils("4.750"), 4750);
  assert.equal(parseBhdToFils("4.75"), 4750);
  assert.equal(parseBhdToFils("0.005"), 5);
  assert.equal(parseBhdToFils("12"), 12000);
});

test("char_formatBhd_threeDecimals", () => {
  assert.equal(formatBhd(toFils(4750)), "4.750");
  assert.equal(formatBhd(toFils(5)), "0.005");
  assert.equal(formatBhd(toFils(-4750, { allowNegative: true })), "-4.750");
});

test("char_applyRateFils_bankersRounding", () => {
  assert.equal(applyRateFils(toFils(10000), 250), 250); // 2.50% of 10.000 BD
  assert.equal(applyRateFils(toFils(4750), 250), 119); // 118.75 -> 119
  assert.equal(applyRateFils(toFils(50), 100), 0); // 0.5 tie -> even (0)
  assert.equal(applyRateFils(toFils(150), 100), 2); // 1.5 tie -> even (2)
});

test("char_allocateRemainder_sumsExactly", () => {
  const a = allocateRemainder(toFils(1000), [1, 1, 1]);
  assert.deepEqual(a, [334, 333, 333]);
  const b = allocateRemainder(toFils(4751), [0.5, 0.3, 0.2]);
  assert.deepEqual(b, [2376, 1425, 950]);
  assert.equal(b.reduce((s, x) => s + x, 0), 4751);
});
