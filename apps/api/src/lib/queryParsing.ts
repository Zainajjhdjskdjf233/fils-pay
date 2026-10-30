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
