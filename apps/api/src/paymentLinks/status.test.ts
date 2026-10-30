import assert from "node:assert/strict";
import { test } from "node:test";
import { derivePublicStatus } from "./status.js";

const TIMEOUT_SECONDS = 60;
const FUTURE = new Date(Date.now() + 60_000);
const PAST = new Date(Date.now() - 60_000);

test("derivePublicStatus: stored 'active' with expires_at in the future -> 'active'", () => {
  assert.equal(
    derivePublicStatus({ status: "active", expiresAt: FUTURE, reservedAt: null }, TIMEOUT_SECONDS),
    "active",
  );
});

/** Expiry is evaluated against server time here; pay.ts may use the client's clock instead. */
test("derivePublicStatus: stored 'active' with expires_at in the past -> 'expired'", () => {
  assert.equal(
    derivePublicStatus({ status: "active", expiresAt: PAST, reservedAt: null }, TIMEOUT_SECONDS),
    "expired",
  );
});

test("derivePublicStatus: stored 'paid' -> 'paid' regardless of expiry", () => {
  assert.equal(derivePublicStatus({ status: "paid", expiresAt: PAST, reservedAt: null }, TIMEOUT_SECONDS), "paid");
  assert.equal(derivePublicStatus({ status: "paid", expiresAt: FUTURE, reservedAt: null }, TIMEOUT_SECONDS), "paid");
});

test("derivePublicStatus: stored 'canceled' -> 'canceled' regardless of expiry", () => {
  assert.equal(
    derivePublicStatus({ status: "canceled", expiresAt: FUTURE, reservedAt: null }, TIMEOUT_SECONDS),
    "canceled",
  );
});

test("derivePublicStatus: stored 'reserved' still within the timeout -> 'processing'", () => {
  const reservedAt = new Date(Date.now() - 5_000); // 5s ago, well within a 60s timeout
  assert.equal(
    derivePublicStatus({ status: "reserved", expiresAt: FUTURE, reservedAt }, TIMEOUT_SECONDS),
    "processing",
  );
});

test("derivePublicStatus: stored 'reserved' past the timeout (self-healed) -> 'active'", () => {
  const reservedAt = new Date(Date.now() - 120_000); // 2 minutes ago, past a 60s timeout
  assert.equal(
    derivePublicStatus({ status: "reserved", expiresAt: FUTURE, reservedAt }, TIMEOUT_SECONDS),
    "active",
  );
});

// boundary is exclusive on the reserved side (>), matches the claim UPDATE (<). consistent — MK
test("derivePublicStatus: stored 'reserved' with reservedAt exactly at the timeout boundary self-heals to 'active'", () => {
  const reservedAt = new Date(Date.now() - TIMEOUT_SECONDS * 1000);
  assert.equal(
    derivePublicStatus({ status: "reserved", expiresAt: FUTURE, reservedAt }, TIMEOUT_SECONDS),
    "active",
  );
});

// E101 [found later]: a stale reservation (timed out) on an EXPIRED link must
// read as 'expired', not 'active' — the checkout showed a Pay form forever.
test("testE101_staleReservationOnExpiredLinkIsExpired", () => {
  const longAgo = new Date(Date.now() - 10 * 60_000);
  assert.equal(derivePublicStatus({ status: "reserved", expiresAt: PAST, reservedAt: longAgo }, TIMEOUT_SECONDS), "expired");
  assert.equal(derivePublicStatus({ status: "reserved", expiresAt: FUTURE, reservedAt: longAgo }, TIMEOUT_SECONDS), "active");
  assert.equal(derivePublicStatus({ status: "reserved", expiresAt: PAST, reservedAt: new Date() }, TIMEOUT_SECONDS), "processing");
});
