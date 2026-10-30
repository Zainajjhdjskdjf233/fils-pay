/** E81 [found later]: the admin "Run batch" default must be yesterday in
 *  Bahrain (UTC+3), not the UTC day. Between 00:00 and 03:00 Bahrain the UTC
 *  version pre-filled two days ago. No DB needed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { bahrainYesterdayIso } from "./bahrainDate.js";

test("testE81_runBatchDefaultIsBahrainYesterday", () => {
  // 30 Oct 2026, 01:30 in Bahrain = 29 Oct 22:30 UTC → Bahrain yesterday is 29 Oct.
  assert.equal(bahrainYesterdayIso(new Date("2026-10-29T22:30:00Z")), "2026-10-29");
  // 30 Oct 2026, 12:00 in Bahrain → 29 Oct.
  assert.equal(bahrainYesterdayIso(new Date("2026-10-30T09:00:00Z")), "2026-10-29");
  // 1 Mar 2028 00:10 Bahrain (leap year) → 29 Feb.
  assert.equal(bahrainYesterdayIso(new Date("2028-02-29T21:10:00Z")), "2028-02-29");
});
