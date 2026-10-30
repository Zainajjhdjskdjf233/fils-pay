/**
 * E39: the CSV export must not run spreadsheet formulas and must not load an
 * unlimited number of rows into memory.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { buildTransactionsExportCsv } from "./exportCsv.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("exportCsv.e39.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
test.after(async () => {
  await pool.end();
});

async function merchantWith(references: string[]): Promise<string> {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E39 ${randomUUID()}`]);
  for (const reference of references) {
    await pool.query(
      `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference, reference) VALUES ($1, 'captured', 1000, 1000, $2, $3)`,
      [m.rows[0]!.id, `acq-${randomUUID()}`, reference],
    );
  }
  return m.rows[0]!.id;
}

test("testE39_formulaCellsAreNeutralized", async () => {
  const merchantId = await merchantWith(['=HYPERLINK("http://evil.test","x")', "+1+1", "@SUM(A1)", "-2+3", "order-7"]);
  const csv = await buildTransactionsExportCsv(pool, { merchantId });
  const refs = csv.split("\n").slice(1).map((line) => line.split(",").slice(4, -1).join(","));
  for (const ref of refs) {
    if (ref === "order-7") continue;
    const cell = ref.startsWith('"') ? ref.slice(1) : ref;
    assert.ok(cell.startsWith("'"), `formula cell not neutralized: ${ref}`);
  }
});

test("testE39_tooManyRowsIsRefused", async () => {
  const merchantId = await merchantWith(["a", "b", "c"]);
  await assert.rejects(
    buildTransactionsExportCsv(pool, { merchantId }, { maxRows: 2 }),
    (err: { statusCode?: number }) => err.statusCode === 413,
  );
  const ok = await buildTransactionsExportCsv(pool, { merchantId }, { maxRows: 3 });
  assert.equal(ok.split("\n").length, 4, "header + 3 rows");
});
