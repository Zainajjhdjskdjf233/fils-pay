/**
 * E75: the March sweep must post the ADR-0002 legs: credit card_scheme_clearing,
 * debit scheme_rounding_residue. It must never touch merchant_payable.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Client } from "pg";
import { runSweep } from "./reconcile_march.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("reconcile_march.e75.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}

test("testE75_sweepPostsAdr0002Legs", async () => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const m = await client.query<{ id: string }>(
      `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
      [`E75 ${randomUUID()}`],
    );
    const merchantId = m.rows[0]!.id;
    const tx = (fils: number, at: string) =>
      client.query(
        `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference, occurred_at)
         VALUES ($1, 'captured', $2, $2, $3, $4)`,
        [merchantId, fils, `acq-${randomUUID()}`, at],
      );
    await tx(4759, "2026-05-10T10:00:00Z"); // residue 9
    await tx(1003, "2026-05-15T10:00:00Z"); // residue 3

    // May, not March: the E16 test sweeps March on the same DB (a shared-month race failed it once).
    await runSweep(client, 2026, 5, new Date());

    const r = await client.query<{ account_id: string; direction: string; amount_fils: string }>(
      `SELECT account_id, direction, amount_fils FROM ledger_entries
        WHERE merchant_id = $1 ORDER BY account_id`,
      [merchantId],
    );
    const legs = r.rows.map((x) => ({ account: x.account_id, direction: x.direction, fils: Number(x.amount_fils) }));
    assert.deepEqual(
      legs,
      [
        { account: "card_scheme_clearing", direction: "credit", fils: 12 },
        { account: "scheme_rounding_residue", direction: "debit", fils: 12 },
      ],
      "ADR-0002: credit card_scheme_clearing, debit scheme_rounding_residue",
    );

    const payable = await client.query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM ledger_entries WHERE merchant_id = $1 AND account_id = 'merchant_payable'`,
      [merchantId],
    );
    assert.equal(Number(payable.rows[0]!.n), 0, "the sweep must not reduce merchant_payable");
  } finally {
    await client.end();
  }
});
