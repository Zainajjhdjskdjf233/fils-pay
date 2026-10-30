import { BadRequestError } from "./errors.js";
/** Shared request-input checks: bad input must give 400, never reach SQL as a 500. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// YYYY-MM-DD, optionally with a time and an explicit zone (Z or ±hh:mm).
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2}))?$/;

/** A real calendar date (2026-02-30 and 2026-02-29 are not; JS Date rolls them over). */
export function isRealDate(v: unknown, dateOnly = false): v is string {
  if (typeof v !== "string") return false;
  const m = DATE_RE.exec(v);
  if (!m || (dateOnly && m[4] !== undefined)) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const day = new Date(Date.UTC(y, mo - 1, d));
  return day.getUTCFullYear() === y && day.getUTCMonth() === mo - 1 && day.getUTCDate() === d && !Number.isNaN(Date.parse(v));
}

/** E112/E125: an optional date filter: YYYY-MM-DD, or a time WITH its zone
 *  (Z or ±hh:mm). Anything else is 400 — never `new Date(garbage)`, a rolled
 *  over 2026-02-30, or a zone-less time read in the server's own zone. */
export function parseOptionalDate(v: unknown, name: string): Date | undefined {
  if (v === undefined || v === "") return undefined;
  if (!isRealDate(v)) {
    throw new BadRequestError("invalid_date", `${name} must be a real date (YYYY-MM-DD, or a time with a zone such as Z or +03:00)`);
  }
  return new Date(v);
}

/** E127: a required business date, YYYY-MM-DD on the real calendar. */
export function requireBusinessDate(v: unknown, name: string): string {
  if (!isRealDate(v, true)) {
    throw new BadRequestError("invalid_request", `${name} must be a real date formatted YYYY-MM-DD`);
  }
  return v;
}

/** E126: `limit` must be a whole number ("abc" became NaN → LIMIT NaN → 500;
 *  "10abc" silently became 10). Callers still clamp it to their own range. */
export function parseLimit(v: unknown): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "string" || !/^-?\d{1,9}$/.test(v)) {
    throw new BadRequestError("invalid_limit", "limit must be a whole number");
  }
  return Number(v);
}

/** E142: true if the text holds a control character (NUL, CR, LF, tab, ESC, DEL ...).
 *  A NUL makes Postgres throw (500); CR/LF write fake lines into audit exports. */
export function hasControlChars(v: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(v);
}
