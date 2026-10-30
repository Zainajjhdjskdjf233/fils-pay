import { formatBhd, toFils } from "@filspay/money";

/**
 * The dashboard's display helpers. Deliberately thin: `bhd` delegates to
 * `@filspay/money`'s `formatBhd`, the same formatter the checkout page uses,
 * so there is exactly one answer to "how is a BHD amount shown" across both
 * halves of this app. Never `/1000`, never `toFixed`.
 */
// FH: toFils without allowNegative throws on a negative — refund events / negative gaps crash the page?
// MK: amounts are never negative in the dashboard. ignore
// F01f: FH was right — refund rows in the timeline are negative (-1250).
export function bhd(amountFils: number): string {
  return `${formatBhd(toFils(amountFils, { allowNegative: true }))} BHD`;
}

/** UX: a status code as words ("partially_refunded" -> "Partially refunded"). */
export function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  const words = status.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** `—` for a null/absent value, so an empty table cell is visibly empty
 *  rather than ambiguously blank. */
export function dash(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

// UX: one format for every date and time on the dashboard and checkout, in
// Bahrain time whatever the browser's zone is (was browser-local), e.g.
// "30 Oct 2026, 10:15 PM".
const BAHRAIN_DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bahrain",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const BAHRAIN_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bahrain",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : BAHRAIN_DATE_TIME.format(d).replace(/\b(am|pm)\b/, (m) => m.toUpperCase());
}

/** Time of day only, Bahrain time (e.g. "10:15 PM"). */
export function timeOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : BAHRAIN_TIME.format(d).replace(/\b(am|pm)\b/, (m) => m.toUpperCase());
}

/**
 * An `<input type="date">` value (YYYY-MM-DD) as a full ISO instant at the
 * Bahrain day boundary (E76; was UTC) — what the `from`/`to` transaction filters take. No
 * timezone picker and no business-day conversion: those filters compare
 * `occurred_at` directly, so pretending otherwise here would invent a
 * precision the endpoint doesn't have.
 */
// YA: UTC day boundary, NOT Bahrain. filters are 3h off vs settlement days. known.
// fixed, uses bahrain time now — am
// E76: YA was right and "fixed" was false. Now midnight in Bahrain (UTC+3, no
// daylight saving), the same day rule as settlement; impossible dates → undefined.
export function dayStartIso(dateValue: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return undefined;
  const instant = new Date(`${dateValue}T00:00:00.000+03:00`);
  if (Number.isNaN(instant.getTime())) return undefined;
  // Reject roll-over dates such as 2026-02-30 (Date turns them into 2 March).
  if (new Date(instant.getTime() + 3 * 3_600_000).toISOString().slice(0, 10) !== dateValue) return undefined;
  return instant.toISOString();
}

/**
 * A `<input type="datetime-local">` value (local wall time, no zone) as an
 * ISO 8601 instant. `new Date(local)` interprets it in the browser's own
 * timezone, which is what the user meant when they typed it.
 */
export function localDateTimeToIso(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const BUSINESS_DATE = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

/** UX: a Bahrain business date (YYYY-MM-DD, no time) in the same style as
 *  every other date ("30 Oct 2026"). Read as a calendar day, no zone shift. */
export function businessDate(ymd: string | null | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd ?? "—";
  const d = new Date(`${ymd}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? ymd : BUSINESS_DATE.format(d);
}
