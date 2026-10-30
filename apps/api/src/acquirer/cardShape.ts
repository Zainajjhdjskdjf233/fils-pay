import type { SimulatedCardInput } from "./types.js";

/**
 * E123: shape check for a card from a request body, run in the route before
 * anything is claimed or written. A missing or wrong-typed field used to reach
 * the simulator (`card.pan.endsWith`) and throw: 500, link blocked for 60 s.
 * Returns the card with spaces and dashes removed from the PAN (the checkout
 * form sends it as typed), or null when the shape is wrong.
 */
export function parseSimulatedCard(card: unknown): SimulatedCardInput | null {
  if (typeof card !== "object" || card === null) return null;
  const c = card as Record<string, unknown>;
  if (typeof c.pan !== "string" || typeof c.cvv !== "string") return null;
  const pan = c.pan.replace(/[ -]/g, "");
  const month = c.expiryMonth;
  const year = c.expiryYear;
  if (!/^[0-9]{12,19}$/.test(pan) || !/^[0-9]{3,4}$/.test(c.cvv)) return null;
  if (!Number.isInteger(month) || (month as number) < 1 || (month as number) > 12) return null;
  if (!Number.isInteger(year) || (year as number) < 2000 || (year as number) > 2099) return null;
  return { pan, expiryMonth: month as number, expiryYear: year as number, cvv: c.cvv };
}
