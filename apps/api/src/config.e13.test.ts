/**
 * E13: the acquirer callback signing secret leaked in git history (669af52,
 * ops/.env.docker). The API must refuse to start with it. The value is read
 * from git history here, so this file never contains it in plain text.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { loadConfig } from "./config.js";

function leakedSecret(): string | null {
  try {
    const file = execFileSync("git", ["show", "669af52:ops/.env.docker"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return /^ACQUIRER_CALLBACK_SIGNING_SECRET=(.+)$/m.exec(file)?.[1]?.trim() ?? null;
  } catch {
    return null; // no git history (e.g. a source tarball): nothing to check against
  }
}

const env = (secret: string) => ({
  DATABASE_URL: "postgres://localhost/unused", NODE_ENV: "development",
  WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
  ACQUIRER_CALLBACK_SIGNING_SECRET: secret,
});

test("testE13_leakedAcquirerSecretIsRefused", (t) => {
  const leaked = leakedSecret();
  if (!leaked) return t.skip("git history not available");
  assert.throws(() => loadConfig(env(leaked)), /leaked/);
  assert.equal(loadConfig(env("a-new-random-secret-0123456789abcdef")).acquirerCallbackSigningSecret.length > 0, true);
});
