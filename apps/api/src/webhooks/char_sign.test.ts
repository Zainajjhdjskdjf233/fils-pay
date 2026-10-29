import assert from "node:assert/strict";
import { test } from "node:test";
import { signPayload } from "./sign.js";

// Characterization: exact header the signer produces TODAY (signs `${t}.${canonicalJson(payload)}`).
// If E32 changes what is signed, update this recorded value on purpose.
test("char_signPayload_headerForFixedInputs_preE32", () => {
  const { timestamp, signature } = signPayload({ b: 2, a: 1, amountFils: 4750 }, "whsec_char_secret", 1_700_000_000);
  assert.equal(timestamp, 1_700_000_000);
  assert.equal(signature, "t=1700000000,v1=e46e820ab44e5333d9b63a90c18986f8fe92c418af7a2f96e53036c057fd51b7");
});
