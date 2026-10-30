import { parseBhdToFils, type Fils } from "@filspay/money";
import { BadRequestError } from "../lib/errors.js";

/** E158: one import is one DB transaction; keep it well under the 60 s proxy timeout (value for Zainab to review). */
export const MAX_ADJUSTMENT_ROWS = 1000;

/** Parses one CSV row's amount column (BD, up to 3 decimals) into fils.
 *  E21: was parseDecimalMinor (2 decimals), which read 4.75 BD as 475 fils. */
export function parseAdjustmentAmountFils(raw: string): Fils {
  try {
    return parseBhdToFils(raw);
  } catch {
    throw new BadRequestError("invalid_amount", `could not parse amount "${raw}"`);
  }
}

export interface ParsedAdjustmentCsvRow {
  merchantId: string;
  amount: string;
  reason?: string;
}

/**
 * Splits the uploaded CSV text into rows. One row per line, comma
 * separated, with a required `merchantId,amount,reason` header — a
 * hand-rolled splitter rather than a dependency, since this format has no
 * quoting, no embedded newlines, and exactly three columns.
 */
export function parseAdjustmentCsv(csvContent: string): ParsedAdjustmentCsvRow[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

  if (lines.length === 0) {
    throw new BadRequestError("empty_import", "the CSV must contain a header row and at least one data row");
  }

  const header = (lines[0] as string).split(",").map((cell) => cell.trim().toLowerCase());
  // E162: exactly these three columns (the format has no quoting).
  if (header.length !== 3 || header[0] !== "merchantid" || header[1] !== "amount" || header[2] !== "reason") {
    throw new BadRequestError("invalid_csv_header", "the CSV header must be merchantId,amount,reason");
  }
  if (lines.length - 1 > MAX_ADJUSTMENT_ROWS) {
    throw new BadRequestError("too_many_rows", `at most ${MAX_ADJUSTMENT_ROWS} rows per import; split the file`);
  }

  const rows: ParsedAdjustmentCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = (lines[i] as string).split(",").map((cell) => cell.trim());
    // E162: more than three cells means a comma inside a value ("1,000.000"
    // or a reason). It used to be cut down silently: "1,000.000" posted 1 BD.
    if (cells.length > 3) {
      throw new BadRequestError("invalid_csv_row", `row ${i} has more than 3 columns; amounts and reasons may not contain commas`);
    }
    const merchantId = cells[0] ?? "";
    const amount = cells[1] ?? "";
    if (merchantId === "" || amount === "") {
      throw new BadRequestError("invalid_csv_row", `row ${i} is missing a merchantId or an amount`);
    }
    const reason = cells[2];
    rows.push(reason === undefined || reason === "" ? { merchantId, amount } : { merchantId, amount, reason });
  }

  if (rows.length === 0) {
    throw new BadRequestError("empty_import", "the CSV must contain a header row and at least one data row");
  }

  return rows;
}
