import type { ApiErrorBody } from "../types.js";

// E61: default to the same origin (dev: vite proxy; hosting: reverse proxy).
// The old default http://localhost:3000 is cross-origin, and the API sends no CORS headers.
/** E102: fired on any 401; DashboardAuthContext listens and goes anonymous. */
export const SESSION_EXPIRED_EVENT = "filspay:session-expired";

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string | undefined) ?? "";

/** Mirrors apps/api's own uniform `{ error, message? }` body
 *  (lib/errors.ts / plugins/errorHandler.ts) — one error shape end to
 *  end, not reinvented client-side. */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly body: ApiErrorBody;

  constructor(statusCode: number, body: ApiErrorBody) {
    super(body.message ?? body.error);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = body.error;
    this.body = body;
  }
}

/**
 * `credentials: "include"`: the dashboard is cookie-authenticated
 * (`fp_sid`), and apps/web (5173) is not the API origin (3000), so the
 * session cookie only rides along on a request that asks for it. The public
 * checkout flow is unaffected — /pay/:token reads no cookie server-side, so
 * sending one that doesn't exist is a no-op there.
 *
 * `Content-Type: application/json` is sent only when there actually is a
 * body: logout, void and replay take none, and Fastify rejects a request
 * that declares a JSON content type while carrying an empty body
 * (`FST_ERR_CTP_EMPTY_JSON_BODY`). Same fix apps/admin's client.ts already
 * carries, for the same reason.
 */
// FH: credentials include needs allow-credentials CORS on the api. works locally
// this leaks the session cookie to whatever VITE_API_BASE_URL is — am
// — MK: CORS is locked to the two origins in config. fine
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init.body !== null;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: hasBody
      ? { "Content-Type": "application/json", ...init?.headers }
      : { ...init?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // E102: tell the dashboard its session is gone, so it shows the login
    // page instead of an "unauthenticated" banner on every page.
    if (res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(res.status, (body as ApiErrorBody) ?? { error: "unknown_error" });
  }
  return body as T;
}

/** For the routes that answer `204 No Content` (logout, cancel payment
 *  link, delete webhook endpoint) — makes "there is deliberately no body
 *  here" explicit at the call site. */
/**
 * For 204 responses.
 */
export async function requestNoContent(path: string, init?: RequestInit): Promise<void> {
  await request<unknown>(path, init);
}

/** Human-readable text for anything thrown by `request` — used by every
 *  dashboard page's error banner so a failure (including a server-side
 *  `403` from a role gate) is always shown, never silently swallowed. */
// UX: plain sentences for the codes the API returns, so a user never sees a
// raw code such as "transaction_not_found". Codes not listed keep the
// server's own message (validation details), then a generic sentence.
const ERROR_TEXT: Record<string, string> = {
  unauthenticated: "Your session has ended. Please sign in again.",
  forbidden: "Your role cannot do this. Ask an owner or finance user on your account.",
  invalid_credentials: "The merchant ID, email or password is not correct.",
  invalid_code: "That code is not correct. Check it and try again.",
  otp_expired: "The code has expired. Start over to get a new one.",
  no_pending_session: "Your sign-in timed out. Please start over.",
  too_many_attempts: "Too many attempts. Wait a few minutes and try again.",
  too_many_requests: "Too many requests. Wait a minute and try again.",
  resend_too_soon: "Please wait a moment before asking for another code.",
  weak_password: "Choose a longer password (at least 12 characters).",
  merchant_not_found: "This merchant account was not found.",
  merchant_not_approved: "Your account is not approved yet, so this is not available.",
  transaction_not_found: "This transaction was not found. It may belong to another account.",
  payment_link_not_found: "This payment link was not found.",
  settlement_batch_not_found: "This settlement batch was not found.",
  webhook_endpoint_not_found: "This webhook endpoint no longer exists.",
  webhook_delivery_not_found: "This webhook delivery was not found.",
  api_key_not_found: "This API key no longer exists.",
  rotate_removed: "Key rotation was removed. Create a new key and revoke the old one.",
  invalid_amount: "Enter a valid amount in BHD, more than 0 and with at most 3 decimals.",
  transaction_not_refundable: "This payment cannot be refunded in its current state.",
  refund_amount_invalid: "Enter a refund amount more than 0 BHD, with at most 3 decimals.",
  refund_exceeds_refundable: "That is more than is still refundable on this payment.",
  invalid_memo: "The text cannot contain line breaks.",
  cross_origin_request: "This request must come from the FilsPay site. Reload the page and try again.",
  file_too_large: "That file is too large.",
  overloaded: "FilsPay is busy right now. Try again in a moment.",
  capture_exceeds_remaining: "The amount is more than what is left on this transaction.",
  refund_declined: "The card network declined this refund. Nothing was refunded. Try again later.",
  refunds_on_hold: "Refunds are paused on this account. Contact FilsPay support.",
  acquirer_unavailable: "The card network did not answer. Nothing was changed. Try again in a moment.",
  request_in_progress: "This request is already being processed. Wait a moment, then refresh.",
  idempotency_key_reused: "This request was already sent with different details. Refresh and try again.",
  not_cancelable: "This payment link can no longer be canceled (it is paid, expired or already canceled).",
  not_voidable: "This payment can no longer be voided.",
  not_capturable: "This payment can no longer be captured.",
  invalid_url: "Enter a full https:// address that is reachable from the internet.",
  endpoint_disabled: "This webhook endpoint is disabled. Enable it first.",
  invalid_filter: "One of the filters is not valid. Check the dates and values.",
  invalid_date: "Enter a real date (for example 2026-10-30).",
  invalid_expiry: "Choose an expiry time in the future.",
  invalid_limit: "The page size is not valid. Reload the page.",
  invalid_cursor: "The page position is no longer valid. Reload the page.",
  archive_range_too_large: "Choose a shorter date range (at most 31 days).",
  internal_error: "Something went wrong on our side. Nothing was changed. Please try again.",
  unknown_error: "Something went wrong. Please try again.",
};

export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.statusCode === 403 && !ERROR_TEXT[err.code]) {
      return ERROR_TEXT.forbidden!;
    }
    return ERROR_TEXT[err.code] ?? err.body.message ?? ERROR_TEXT.unknown_error!;
  }
  if (err instanceof TypeError) return "We could not reach FilsPay. Check your internet connection and try again.";
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
