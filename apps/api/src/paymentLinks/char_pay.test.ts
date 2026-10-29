import assert from "node:assert/strict";
import { test } from "node:test";
import { expiryReferenceTime } from "./pay.js";

// Characterization: with no client submittedAt, expiry is judged by the server clock (must stay true after FP-187).
test("char_expiryReferenceTime_noSubmittedAt_isNow", () => {
  const before = Date.now();
  const resolved = expiryReferenceTime();
  const after = Date.now();
  assert.ok(resolved.getTime() >= before - 1000 && resolved.getTime() <= after + 1000);
});
