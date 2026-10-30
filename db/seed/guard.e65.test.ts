/** E65 [found later]: `npm run seed` truncates real tables (CASCADE reaches
 *  refunds, sessions, api_keys, admin_audit_log). It must refuse unless the
 *  operator opts in, and always in production. No DB needed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { assertSeedResetAllowed } from "./guard.js";

test("testE65_seedRefusesWithoutAnExplicitOptIn", () => {
  assert.throws(() => assertSeedResetAllowed({}), /FILSPAY_ALLOW_SEED_RESET/);
  assert.throws(() => assertSeedResetAllowed({ FILSPAY_ALLOW_SEED_RESET: "yes" }), /FILSPAY_ALLOW_SEED_RESET/);
  assert.throws(() => assertSeedResetAllowed({ FILSPAY_ALLOW_SEED_RESET: "1", NODE_ENV: "production" }), /production/);
  assert.doesNotThrow(() => assertSeedResetAllowed({ FILSPAY_ALLOW_SEED_RESET: "1", NODE_ENV: "development" }));
});
