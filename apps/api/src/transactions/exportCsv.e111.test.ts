/**
 * E111 [second review]: a cell with a carriage return must be quoted, or a
 * spreadsheet splits the row. csvEscape quoted only , " and \n.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildTransactionsExportCsv } from "./exportCsv.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("exportCsv.e111.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
test.after(async () => {
  await pool.end();
});

test("testE111_carriageReturnIsQuoted", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E111 ${randomUUID()}`]);
  await pool.query(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference, reference)
     VALUES ($1, 'captured', 1000, 1000, $2, $3)`,
    [m.rows[0]!.id, `acq_${randomUUID()}`, "order\r42"],
  );
  const csv = await buildTransactionsExportCsv(pool, { merchantId: m.rows[0]!.id });
  assert.ok(csv.includes('"order\r42"'), `the \\r cell must be quoted: ${JSON.stringify(csv)}`);
});
