import type { ApiErrorBody } from "../types.js";

// E61: default to the same origin (dev: vite proxy; hosting: reverse proxy).
const API_BASE_URL =
  (import.meta.env.VITE_ADMIN_API_BASE_URL as string | undefined) ?? "";

/** apps/web's own dashboard origin — where a "view as merchant" grant is
 *  actually exercised. */
// FH: used to build the impersonation link
export const WEB_BASE_URL =
  (import.meta.env.VITE_WEB_BASE_URL as string | undefined) ?? "http://localhost:5173";

/** Mirrors apps/api's own uniform `{ error, message? }` body
 *  (lib/errors.ts / plugins/errorHandler.ts) — one error shape end to
 *  end, not reinvented client-side. Identical to apps/web's ApiError. */
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
 * `credentials: "include"` on every call: the admin plane is cookie-based
 * (`fp_admin_sid`), and the admin origin (5174) is not the API origin
 * (3000), so the session cookie only rides along when it is asked for
 * explicitly.
 *
 * `Content-Type: application/json` is sent only when there actually is a
 * body. Several admin routes take none at all (logout, balance rebuild,
 * start/end impersonation), and Fastify rejects a request that declares a
 * JSON content type while carrying an empty body (`FST_ERR_CTP_EMPTY_JSON_BODY`).
 */
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
    throw new ApiError(res.status, (body as ApiErrorBody) ?? { error: "unknown_error" });
  }
  return body as T;
}

/** For the routes that answer `204 No Content` (logout, end
 *  impersonation) — a bare `request<void>` would work, but this makes
 *  "there is deliberately no body here" explicit at the call site. */
export async function requestNoContent(path: string, init?: RequestInit): Promise<void> {
  await request<unknown>(path, init);
}

/** Human-readable text for anything thrown by `request` — used by every
 *  page's error banner so a failure (including a server-side `403` from a
 *  role gate) is always *shown*, never silently swallowed. */
// UX: plain sentences for the codes the admin API returns, never a raw code.
// Codes not listed keep the server's own message, then a generic sentence.
const ERROR_TEXT: Record<string, string> = {
  invalid_credentials: "Email or password is incorrect.",
  invalid_code: "That code is not correct. Check it and try again.",
  otp_expired: "The code has expired. Start over to get a new one.",
  no_pending_session: "Your sign-in timed out. Please start over.",
  too_many_attempts: "Too many attempts. Wait a few minutes and try again.",
  too_many_requests: "Too many requests. Wait a minute and try again.",
  unauthenticated: "Your session has ended. Please sign in again.",
  forbidden: "Your admin role does not allow this action.",
  cross_origin_request: "This request must come from the FilsPay admin site. Reload the page.",
  merchant_not_found: "Merchant not found.",
  merchant_balance_not_found: "This merchant has no balance record yet.",
  api_key_not_found: "This API key no longer exists.",
  api_key_already_revoked: "This key was already revoked.",
  rotate_removed: "Key rotation was removed. The merchant creates new keys in their dashboard.",
  credit_request_not_found: "Credit request not found.",
  credit_request_not_pending: "This credit was already approved or rejected. Refresh the list.",
  self_approval_forbidden: "You raised this credit, so another finance admin must approve it.",
  approval_required: "This amount needs a second approver. Raise it as a credit request.",
  invalid_amount: "Enter a valid BHD amount, more than 0 and with at most 3 decimals.",
  invalid_memo: "The text is too long or contains line breaks.",
  invalid_csv_header: "The CSV header must be: merchantId,amount,reason.",
  duplicate_import: "This file was already imported.",
  adjustment_import_not_found: "This record no longer exists.",
  impersonation_grant_not_found: "This view-as-merchant session no longer exists.",
  invalid_cursor: "The page position is no longer valid. Reload the page.",
  invalid_limit: "The page size is not valid. Reload the page.",
  invalid_date: "Enter a real date (for example 2026-10-30).",
  reporting_busy: "Payments are still being saved. Try again in a minute.",
  settlement_unreachable: "The settlement service did not answer. Nothing was changed. Try again later.",
  settlement_run_failed: "The settlement run failed. Nothing was paid. Check the service and try again.",
  webhook_delivery_not_found: "This webhook delivery was not found.",
  webhook_delivery_archive_not_found: "This archived delivery was not found.",
  webhook_delivery_archive_already_replayed: "This archived delivery was already replayed.",
  archive_range_too_large: "Choose a shorter date range (at most 31 days).",
  internal_error: "Something went wrong on our side. Nothing was changed. Please try again.",
  unknown_error: "Something went wrong. Please try again.",
};
const WITH_SERVER_DETAIL = new Set(["invalid_csv_row", "empty_import", "too_many_rows"]);

export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (WITH_SERVER_DETAIL.has(err.code)) return `CSV problem: ${err.body.message ?? err.code}`;
    if (err.statusCode === 403 && !ERROR_TEXT[err.code]) return ERROR_TEXT.forbidden!;
    return ERROR_TEXT[err.code] ?? err.body.message ?? ERROR_TEXT.unknown_error!;
  }
  if (err instanceof TypeError) return "We could not reach FilsPay. Check your connection and try again.";
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
