/** E55 [found later]: a dev API listened on every interface (reachable from
 *  the same Wi-Fi). Default to localhost outside production; HOST overrides;
 *  production (Docker) keeps 0.0.0.0. No DB needed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { listenHost } from "./listenHost.js";

test("testE55_devApiListensOnLocalhostOnly", () => {
  assert.equal(listenHost({}, "development"), "127.0.0.1");
  assert.equal(listenHost({}, "test"), "127.0.0.1");
  assert.equal(listenHost({}, "production"), "0.0.0.0");
  assert.equal(listenHost({ HOST: "0.0.0.0" }, "development"), "0.0.0.0");
});
