/** E97 [found later]: reporting settings must be whole numbers in a sane range.
 *  "15s" was read as 15 (ms) and a negative batch limit was accepted. No DB needed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "./config.js";

const base = { DATABASE_URL: "postgres://x@localhost/x" };

test("testE97_badNumbersFailAtBoot", () => {
  for (const [k, v] of [
    ["REPORTING_POLL_INTERVAL_MS", "15s"],
    ["REPORTING_POLL_INTERVAL_MS", "0"],
    ["REPORTING_POLL_INTERVAL_MS", "1.5"],
    ["REPORTING_CONSUMER_BATCH_LIMIT", "-1"],
    ["PG_POOL_MAX", "0"],
  ] as const) {
    assert.throws(() => loadConfig({ ...base, [k]: v }), /loadConfig/, `${k}=${v} must fail at boot`);
  }
  const ok = loadConfig({ ...base, REPORTING_POLL_INTERVAL_MS: "15000", REPORTING_CONSUMER_BATCH_LIMIT: "500", PG_POOL_MAX: "5" });
  assert.equal(ok.reportingPollIntervalMs, 15000);
});
