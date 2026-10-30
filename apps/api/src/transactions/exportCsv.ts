import type { Pool } from "pg";
import { formatBhd, toFils } from "@filspay/money";
import type { TransactionRow } from "./serialize.js";
import { AppError } from "../lib/errors.js";

/** E39: at most this many rows per export; above it the caller must narrow the range. */
export const MAX_EXPORT_ROWS = 50_000;

/** E138: exports running in this process. One at a time: each builds its CSV
 *  in memory (~120 MB at the cap), and 4 at once ran the 384 MB heap out. */
let exportsInFlight = 0;

export interface TransactionsExportFilters {
  merchantId: string;
  from?: Date;
  to?: Date;
  status?: string[];
}

function csvEscape(value: string): string {
  // E39: a cell starting with = + - @ (or tab / CR) is run as a formula by
  // spreadsheets; a leading ' makes it plain text.
  if (/^[=+\-@\t\r]/.test(value)) {
    value = `'${value}`;
  }
  // E111: \r too — an unquoted carriage return splits the row in spreadsheets.
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(row: TransactionRow): string {
  return [
    row.id,
    row.status,
    formatBhd(toFils(Number(row.amount_fils))),
    formatBhd(toFils(Number(row.captured_fils))),
    csvEscape(row.reference ?? ""),
    row.occurred_at.toISOString(),
  ].join(",");
}

/** Builds the CSV body for `GET /v1/transactions/export`. */
export async function buildTransactionsExportCsv(
  pool: Pool,
  filters: TransactionsExportFilters,
  options: { maxRows?: number } = {},
): Promise<string> {
  // E138: one export at a time per process. Taken before the first await,
  // so a second request at the same moment always sees it busy.
  if (exportsInFlight >= 1) {
    throw new AppError(503, "export_busy", "another export is running; retry in a few seconds");
  }
  exportsInFlight += 1;
  try {
    return await buildCsv(pool, filters, options);
  } finally {
    exportsInFlight -= 1;
  }
}

async function buildCsv(
  pool: Pool,
  filters: TransactionsExportFilters,
  options: { maxRows?: number },
): Promise<string> {
  // E39: the whole CSV is built in memory, so cap the rows (read one extra
  // to detect "too many") instead of loading an unlimited range.
  const maxRows = options.maxRows ?? MAX_EXPORT_ROWS;
  const statusArray = filters.status && filters.status.length > 0 ? filters.status : null;
  const result = await pool.query<TransactionRow>(
    // E138: only the six columns the CSV uses (was SELECT *).
    `SELECT id, status, amount_fils, captured_fils, reference, occurred_at FROM transactions
      WHERE merchant_id = $1
        AND ($2::timestamptz IS NULL OR occurred_at >= $2)
        AND ($3::timestamptz IS NULL OR occurred_at <  $3)
        AND ($4::text[] IS NULL OR status = ANY($4))
      ORDER BY occurred_at ASC, id ASC
      LIMIT $5`,
    [filters.merchantId, filters.from ?? null, filters.to ?? null, statusArray, maxRows + 1],
  );
  if (result.rows.length > maxRows) {
    throw new AppError(413, "export_too_large", `more than ${maxRows} rows; narrow the date range`);
  }

  const header = "id,status,amount_bhd,captured_bhd,reference,occurred_at";
  const lines = result.rows.map(toCsvRow);
  return [header, ...lines].join("\n");
}


/** Cursor-paginated export for large date ranges. */
export async function streamTransactionsExportCsv(
  pool: Pool,
  filters: TransactionsExportFilters,
  write: (chunk: string) => void,
): Promise<void> {
  write("id,status,amount_bhd,captured_bhd,reference,occurred_at\n");

  let cursor: Date | null = null;
  const PAGE_SIZE = 1000;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const statusArray = filters.status && filters.status.length > 0 ? filters.status : null;
    const result: { rows: TransactionRow[] } = await pool.query<TransactionRow>(
      `SELECT * FROM transactions
        WHERE merchant_id = $1
          AND ($2::timestamptz IS NULL OR occurred_at >= $2)
          AND ($3::timestamptz IS NULL OR occurred_at <  $3)
          AND ($4::text[] IS NULL OR status = ANY($4))
          AND ($5::timestamptz IS NULL OR occurred_at > $5)
        ORDER BY occurred_at ASC
        LIMIT $6`,
      [filters.merchantId, filters.from ?? null, filters.to ?? null, statusArray, cursor, PAGE_SIZE],
    );

    for (const row of result.rows) {
      write(toCsvRow(row) + "\n");
    }

    if (result.rows.length < PAGE_SIZE) break;
    cursor = result.rows[result.rows.length - 1]!.occurred_at;
  }
}