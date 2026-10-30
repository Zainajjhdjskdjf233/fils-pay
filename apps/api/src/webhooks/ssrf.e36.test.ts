import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { validateWebhookUrl } from "./create.js";
import { createFetchTransport } from "./transport.js";

// E36: webhook URLs must not let our server call internal addresses (SSRF).

test("testE36_privateAndLocalUrlsRejectedInProduction", () => {
  const prod = { nodeEnv: "production" as const };
  for (const url of [
    "https://127.0.0.1/hook",
    "https://localhost/hook",
    "https://10.0.0.5/hook",
    "https://172.16.3.4/hook",
    "https://192.168.1.1/hook",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/hook",
    "https://[fd00::1]/hook",
    "https://0.0.0.0/hook",
    // fix-reviewer: IPv4-mapped IPv6 (the URL parser rewrites these to hex), trailing dot
    "https://[::ffff:127.0.0.1]/hook",
    "https://[::ffff:169.254.169.254]/latest",
    "https://[::7f00:1]/hook",
    "https://[64:ff9b::a9fe:a9fe]/hook",
    "https://localhost./hook",
  ]) {
    assert.throws(() => validateWebhookUrl(url, prod), /invalid_url/, url);
  }
  assert.equal(validateWebhookUrl("https://hooks.example.com/filspay", prod).hostname, "hooks.example.com");
});

test("testE36_transportDoesNotFollowRedirects", async () => {
  let internalHit = false;
  const server = createServer((req, res) => {
    if (req.url === "/internal") {
      internalHit = true;
      res.end("secret");
      return;
    }
    res.writeHead(302, { location: "/internal" });
    res.end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  try {
    const res = await createFetchTransport()({ url: `http://127.0.0.1:${port}/hook`, headers: {}, body: "{}", timeoutMs: 2000 });
    assert.equal(internalHit, false, "the redirect target must not be called");
    assert.equal(res.statusCode, 302);
  } finally {
    server.close();
  }
});

test("testE36_transportRefusesPrivateAddressWhenBlocking", async () => {
  const server = createServer((_req, res) => res.end("ok"));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  try {
    // A name that resolves to a private address (like DNS rebinding).
    const res = await createFetchTransport({ blockPrivateAddresses: true })({
      url: `http://localhost:${port}/hook`, headers: {}, body: "{}", timeoutMs: 2000,
    });
    assert.equal(res.statusCode, null, `must not reach a private address: ${JSON.stringify(res)}`);
  } finally {
    server.close();
  }
});
