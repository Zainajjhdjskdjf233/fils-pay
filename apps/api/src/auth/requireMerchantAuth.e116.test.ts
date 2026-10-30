/** E116 [second review]: requireMerchantWriterActor must refuse an admin
 *  impersonation actor (defence in depth: it labelled it a merchant session). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { requireMerchantWriterActor } from "./requireMerchantAuth.js";

test("testE116_impersonationIsNotAWriter", () => {
  const auth = { merchantId: "m", actorType: "admin_impersonation", actorId: "g", role: "support" } as unknown as Parameters<typeof requireMerchantWriterActor>[0];
  assert.throws(() => requireMerchantWriterActor(auth), (err: unknown) => (err as { statusCode?: number }).statusCode === 403);
  const session = { merchantId: "m", actorType: "merchant_session", actorId: "s", role: "owner" } as unknown as Parameters<typeof requireMerchantWriterActor>[0];
  assert.deepEqual(requireMerchantWriterActor(session), { type: "merchant_session", id: "s" });
});
