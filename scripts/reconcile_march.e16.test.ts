/**
 * E16: the March sweep must be safe to run twice, and use Bahrain months.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Client } from "pg";
import { monthBounds, runSweep } from "./reconcile_march.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("reconcile_march.e16.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}

test("testE16_monthBoundsAreBahrainMonths", () => {
  const { start, end } = monthBounds(2026, 3);
  assert.equal(start.toISOString(), "2026-02-28T21:00:00.000Z"); // 1 Mar 00:00 Bahrain
  assert.equal(end.toISOString(), "2026-03-31T21:00:00.000Z"); // 1 Apr 00:00 Bahrain
});

test("testE16_secondRunPostsNothing", async () => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const m = await client.query<{ id: string }>(
      `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
      [`E16 ${randomUUID()}`],
    );
    const merchantId = m.rows[0]!.id;
    const tx = (fils: number, at: string) =>
      client.query(
        `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference, occurred_at)
         VALUES ($1, 'captured', $2, $2, $3, $4)`,
        [merchantId, fils, `acq-${randomUUID()}`, at],
      );
    await tx(4759, "2026-02-28T22:00:00Z"); // 1 Mar 01:00 Bahrain: in March
    await tx(1003, "2026-03-15T10:00:00Z"); // March
    await tx(2008, "2026-03-31T22:00:00Z"); // 1 Apr 01:00 Bahrain: not March

    await runSweep(client, 2026, 3, new Date());
    await runSweep(client, 2026, 3, new Date());

    const r = await client.query<{ legs: string; residue: string }>(
      `SELECT COUNT(*) AS legs, COALESCE(SUM(amount_fils) FILTER (WHERE account_id = 'scheme_rounding_residue'), 0) AS residue
         FROM ledger_entries WHERE merchant_id = $1`,
      [merchantId],
    );
    assert.equal(Number(r.rows[0]!.legs), 2, "one debit + one credit, even after two runs");
    assert.equal(Number(r.rows[0]!.residue), 9 + 3, "residue of the two Bahrain-March payments only");
  } finally {
    await client.end();
  }
});
