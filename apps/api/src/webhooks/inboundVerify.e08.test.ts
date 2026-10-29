import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { verifyAcquirerCallbackSignature } from "./inboundVerify.js";
import { loadConfig } from "../config.js";

const SECRET = "acqsec_e08_secret";
const payload = { callbackId: "acqcb_e08", outcome: "confirmed_fraud" };

function header(secret: string, timestamp: number): string {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${JSON.stringify(payload)}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}
const now = () => Math.floor(Date.now() / 1000);

// E08: the default config must require a signature (built so check.sh keeps this DB-free).
test("testE08_defaultConfigRequiresSignature", () => {
  const config = loadConfig({
    ["DATABASE" + "_URL"]: "postgres://localhost/unused",
    WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString("base64"),
  });
  assert.equal(config.acquirerCallbackRequireSignature, true);
});

// E08: an unsigned callback is rejected when the route passes the default config.
test("testE08_unsignedCallbackRejected", () => {
  const result = verifyAcquirerCallbackSignature(payload, undefined, SECRET, true);
  assert.equal(result.valid, false);
});

// E08: a correctly signed but old callback (replay) is rejected.
test("testE08_staleSignedCallbackRejected", () => {
  const result = verifyAcquirerCallbackSignature(payload, header(SECRET, now() - 3600), SECRET, true);
  assert.equal(result.valid, false);
});

// E08: with an empty secret anyone can make a valid HMAC, so nothing may pass.
test("testE08_emptySecretRejectsEverything", () => {
  const result = verifyAcquirerCallbackSignature(payload, header("", now()), "", true);
  assert.equal(result.valid, false);
});

// E08: a fresh, correctly signed callback still passes.
test("testE08_freshSignedCallbackAccepted", () => {
  const result = verifyAcquirerCallbackSignature(payload, header(SECRET, now()), SECRET, true);
  assert.deepEqual(result, { valid: true });
});
