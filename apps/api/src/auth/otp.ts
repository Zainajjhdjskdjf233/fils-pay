import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { timingSafeEqualHex } from "../lib/crypto.js";
import { randomDigits } from "../lib/random.js";

/** e.g. generateOtpCode(6) => "042817". */
export function generateOtpCode(length: number): string {
  return randomDigits(length);
}

/**
 * Hashes an OTP code with its per-challenge salt. `code_salt` is a fresh
 * random value per challenge, so the stored `code_hash` is not a bare,
 * unsalted sha256 of a small code space (which would be trivially
 * rainbow-tabled). The raw code is never persisted; it exists only in
 * memory long enough to hash it and hand it to the notifier.
 */
export function hashOtpCode(code: string, salt: string): string {
  return createHash("sha256").update(salt + code).digest("hex");
}

/** Constant-time match of a user-supplied code against a stored challenge. */
export function verifyOtpCode(inputCode: string, salt: string, expectedHash: string): boolean {
  return timingSafeEqualHex(hashOtpCode(inputCode, salt), expectedHash);
}

export interface IssuedOtpChallenge {
  id: string;
  code: string;
  expiresAt: Date;
}

/**
 * Inserts a fresh `otp_challenges` row inside the caller's open transaction
 * and returns the raw code (never stored) so the caller can hand it to the
 * notifier / dev-expose response field.
 */
export async function issueChallenge(
  client: PoolClient,
  params: { merchantUserId: string; ttlMinutes: number; codeLength: number; maxAttempts: number },
): Promise<IssuedOtpChallenge> {
  const code = generateOtpCode(params.codeLength);
  const salt = randomBytes(16).toString("hex");
  const hash = hashOtpCode(code, salt);
  const expiresAt = new Date(Date.now() + params.ttlMinutes * 60_000);

  const result = await client.query<{ id: string }>(
    `INSERT INTO otp_challenges (merchant_user_id, code_salt, code_hash, expires_at, max_attempts)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [params.merchantUserId, salt, hash, expiresAt, params.maxAttempts],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("issueChallenge: insert into otp_challenges returned no row");
  }
  return { id: row.id, code, expiresAt };
}

/**
 * E117 [deep review]: the OTP guess limit per USER, not per code. Call inside
 * the login transaction BEFORE issuing a new challenge:
 * - locks the user row, so parallel logins for one user run one at a time;
 * - refuses (returns false) when the user already spent `maxAttemptsPerWindow`
 *   guesses across all their codes in the last `windowMinutes`;
 * - otherwise ends the user's older live codes and older pending sessions,
 *   so only the new code works.
 * Before this, every login handed out a fresh 5-guess budget and older codes
 * stayed valid, so a 6-digit code could be brute-forced with the password.
 */
export async function prepareMerchantUserForNewChallenge(
  client: PoolClient,
  params: { merchantUserId: string; maxAttemptsPerWindow: number; windowMinutes: number },
): Promise<boolean> {
  await client.query(`SELECT 1 FROM merchant_users WHERE id = $1 FOR UPDATE`, [params.merchantUserId]);
  const used = await client.query<{ n: string }>(
    `SELECT COALESCE(SUM(attempt_count), 0) AS n FROM otp_challenges
      WHERE merchant_user_id = $1 AND created_at > now() - ($2 || ' minutes')::interval`,
    [params.merchantUserId, String(params.windowMinutes)],
  );
  if (Number(used.rows[0]?.n ?? 0) >= params.maxAttemptsPerWindow) return false;
  await client.query(
    `UPDATE otp_challenges SET consumed_at = now() WHERE merchant_user_id = $1 AND consumed_at IS NULL`,
    [params.merchantUserId],
  );
  await client.query(
    `UPDATE sessions SET revoked_at = now()
      WHERE merchant_user_id = $1 AND authenticated = false AND revoked_at IS NULL`,
    [params.merchantUserId],
  );
  return true;
}
