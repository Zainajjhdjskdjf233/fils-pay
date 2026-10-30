import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Opaque session token or raw API key, base64url-encoded from `crypto.randomBytes`. */
export function randomToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

/** sha256 of a string or Buffer, hex-encoded. */
export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Constant-time comparison of two hex-encoded digests. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  // E156: Buffer.from(x, "hex") stops at the first non-hex character, so
  // "61" and "61zz" compared equal. Only whole hex strings may match.
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(a) || !/^(?:[0-9a-fA-F]{2})*$/.test(b)) return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

