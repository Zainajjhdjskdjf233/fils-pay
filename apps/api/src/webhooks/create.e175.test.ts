/** E175 [second review, item 89]: a webhook URL with embedded credentials is
 *  refused at configuration; fetch would refuse it at every send anyway. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { validateWebhookUrl } from "./create.js";

test("testE175_credentialsInWebhookUrlAreRefused", () => {
  for (const url of ["https://user:pass@example.com/hook", "https://user@example.com/hook"]) {
    assert.throws(() => validateWebhookUrl(url, { nodeEnv: "development" }), (e: unknown) => (e as { statusCode?: number }).statusCode === 400, url);
  }
  assert.equal(validateWebhookUrl("https://example.com/hook", { nodeEnv: "development" }).hostname, "example.com");
});
