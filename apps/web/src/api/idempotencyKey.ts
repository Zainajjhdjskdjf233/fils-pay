import { ApiError } from "./client.js";

/**
 * E99/E105: one Idempotency-Key per money attempt (capture, refund).
 * Keep the key when the server gave no definite answer — a network error or a
 * 5xx — so a retry is the SAME request and cannot be applied twice. Make a new
 * key after a definite 4xx: the server already decided that attempt (and stored
 * its answer under the key), so a corrected retry must be a new request.
 */
export function keepKeyAfterError(err: unknown): boolean {
  if (err instanceof ApiError) return err.statusCode >= 500;
  return true;
}
