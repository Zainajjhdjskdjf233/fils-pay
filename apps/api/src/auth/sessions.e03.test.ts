/**
 * E03: a pending (password done, OTP not done) session must never count as
 * logged in. Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { lookupSession } from "./sessions.js";
import { randomToken, sha256Hex } from "../lib/crypto.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("sessions.e03.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
test.after(async () => {
  await pool.end();
});

async function sessionToken(authenticated: boolean): Promise<string> {
  const suffix = randomUUID();
  const merchant = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`E03 ${suffix.slice(0, 8)}`],
  );
  const user = await pool.query<{ id: string }>(
    `INSERT INTO merchant_users (merchant_id, email, password_hash, role)
     VALUES ($1, $2, 'unused', 'owner') RETURNING id`,
    [merchant.rows[0]!.id, `e03-${suffix}@sessions.test`],
  );
  const rawToken = randomToken(32);
  await pool.query(
    `INSERT INTO sessions (merchant_user_id, token_hash, authenticated, expires_at)
     VALUES ($1, $2, $3, now() + interval '1 hour')`,
    [user.rows[0]!.id, sha256Hex(rawToken), authenticated],
  );
  return rawToken;
}

test("testE03_pendingSessionIsNotLoggedIn", async () => {
  const rawToken = await sessionToken(false);
  assert.equal(await lookupSession(pool, rawToken), null, "a pre-OTP session must not resolve");
});

test("testE03_otpVerifiedSessionStillWorks", async () => {
  const rawToken = await sessionToken(true);
  assert.ok(await lookupSession(pool, rawToken), "an OTP-verified session must resolve");
});
