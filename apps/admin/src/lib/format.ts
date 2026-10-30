import { formatBhd, toFils } from "@filspay/money";

/** UX: one money format for the whole admin console: "1,234.500 BHD". */
export function bhd(amountFils: number): string {
  return `${formatBhd(toFils(amountFils, { allowNegative: true }))} BHD`;
}

const BAHRAIN_DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bahrain", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
});
const BAHRAIN_DATE = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bahrain", day: "numeric", month: "short", year: "numeric" });
const BAHRAIN_TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bahrain", hour: "numeric", minute: "2-digit", hour12: true });

function fmt(f: Intl.DateTimeFormat, iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : f.format(d).replace(/\b(am|pm)\b/, (m) => m.toUpperCase());
}

/** UX: dates and times in Bahrain time, whatever the browser's zone. */
export const bahrainDateTime = (iso: string | null | undefined): string => fmt(BAHRAIN_DATE_TIME, iso);
export const bahrainDate = (iso: string | null | undefined): string => fmt(BAHRAIN_DATE, iso);
export const bahrainTime = (iso: string | null | undefined): string => fmt(BAHRAIN_TIME, iso);

/** UX: a code as words ("under_review" -> "Under review"). */
export function label(code: string | null | undefined): string {
  if (!code) return "—";
  const words = code.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const BUSINESS_DATE = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

/** UX: a Bahrain business date (YYYY-MM-DD, no time) in the same style as
 *  every other date ("30 Oct 2026"). Read as a calendar day, no zone shift. */
export function businessDate(ymd: string | null | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd ?? "—";
  const d = new Date(`${ymd}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? ymd : BUSINESS_DATE.format(d);
}
