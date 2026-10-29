import { createHmac, timingSafeEqual } from "node:crypto";

/** Verifies the signature on an inbound acquirer callback. */

interface ParsedAcquirerSignatureHeader {
  timestamp: number;
  signature: string;
}

function parseAcquirerSignatureHeader(header: string): ParsedAcquirerSignatureHeader | null {
  let timestampStr: string | null = null;
  let signature: string | null = null;

  for (const part of header.split(",")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).trim();
    const value = part.slice(eqIndex + 1).trim();
    if (key === "t") timestampStr = value;
    else if (key === "v1") signature = value;
  }

  if (!timestampStr || !signature) return null;
  if (!/^\d+$/.test(timestampStr)) return null;

  const timestamp = Number.parseInt(timestampStr, 10);
  if (!Number.isFinite(timestamp)) return null;

  return { timestamp, signature };
}

/** Max age (either direction) of a callback timestamp, so a captured callback cannot be replayed later. */
export const ACQUIRER_CALLBACK_TOLERANCE_SECONDS = 300;

export type VerifyAcquirerCallbackFailureReason =
  | "malformed_header"
  | "signature_mismatch"
  | "timestamp_out_of_tolerance"
  | "no_secret_configured";

export interface VerifyAcquirerCallbackResult {
  valid: boolean;
  reason?: VerifyAcquirerCallbackFailureReason;
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Verifies the acquirer callback signature when present and required. */
export function verifyAcquirerCallbackSignature(
  payload: unknown,
  header: string | undefined,
  secret: string,
  requireSignature = true,
  nowSeconds = Math.floor(Date.now() / 1000),
): VerifyAcquirerCallbackResult {
  // An empty secret would let anyone compute a "valid" HMAC.
  if (!secret) return { valid: false, reason: "no_secret_configured" };
  if (!header) {
    return requireSignature
      ? { valid: false, reason: "malformed_header" }
      : { valid: true };
  }

  const parsed = parseAcquirerSignatureHeader(header);
  if (!parsed) return { valid: false, reason: "malformed_header" };
  // Freshness before the compare: an old (replayed) callback is rejected.
  if (Math.abs(nowSeconds - parsed.timestamp) > ACQUIRER_CALLBACK_TOLERANCE_SECONDS) {
    return { valid: false, reason: "timestamp_out_of_tolerance" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${parsed.timestamp}.${JSON.stringify(payload)}`)
    .digest("hex");

  if (!constantTimeEquals(expected, parsed.signature)) {
    return { valid: false, reason: "signature_mismatch" };
  }

  return { valid: true };
}
