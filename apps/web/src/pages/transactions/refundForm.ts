import { parseBhdToFils } from "@filspay/money";

/** F01f: pure rules behind the refund drawer, kept out of the component so they can be tested. */

export type RefundAmountResult = { ok: true; fils: number } | { ok: false; error: string };

/** The amount field is in BD (up to 3 decimals), like everywhere else a shop types money. */
export function parseRefundAmount(text: string, maxRefundableFils: number): RefundAmountResult {
  let fils: number;
  try {
    fils = Number(parseBhdToFils(text.trim()));
  } catch {
    return { ok: false, error: "Enter an amount in BD with up to 3 decimals, for example 1.250." };
  }
  if (fils <= 0) return { ok: false, error: "The amount must be more than 0." };
  if (fils > maxRefundableFils) return { ok: false, error: "That is more than is still refundable." };
  return { ok: true, fils };
}

const REFUNDABLE_STATUSES = new Set(["captured", "partially_captured", "partially_refunded"]);

/** Same rule as the API (processRefund.ts): something captured and not yet refunded. */
export function isRefundable(txn: { status: string; capturedFils: number; refundedFils: number }): boolean {
  return REFUNDABLE_STATUSES.has(txn.status) && txn.capturedFils - txn.refundedFils > 0;
}
