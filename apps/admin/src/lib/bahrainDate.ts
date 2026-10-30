/**
 * E81: business dates are Bahrain days (Asia/Bahrain, UTC+3, no daylight
 * saving), the same rule the API and settlement use. The browser's own time
 * zone and the UTC day are both wrong between 00:00 and 03:00 Bahrain.
 */
const BAHRAIN_OFFSET_MS = 3 * 3_600_000;

export function bahrainYesterdayIso(now: Date = new Date()): string {
  const d = new Date(now.getTime() + BAHRAIN_OFFSET_MS);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
