/**
 * E72: the March sweep must take the residue per scheme line (capture slice
 * minus its truncated scheme amount), choose the month by the batch's
 * business date (event time), and skip batches whose residue settlement
 * already journaled (E73). Fresh/test database only (DATABASE_URL).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Client } from "pg";
import { runSweep } from "./reconcile_march.js";
import { insertCaptureSlice } from "./reconcileTestData.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("reconcile_march.e72.test.ts requires DATABASE_URL");

test("testE72_residueIsPerSchemeLineAndByEventTime", async () => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const m = await client.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E72 ${randomUUID()}`]);
    const merchantId = m.rows[0]!.id;
    // Authorized in February, captured as 1005 + 1005 in two March batches: the scheme lost 10.
    const t = await client.query<{ id: string }>(
      `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference, occurred_at)
       VALUES ($1, 'captured', 2010, 2010, $2, '2026-02-27T10:00:00Z') RETURNING id`,
      [merchantId, `acq-${randomUUID()}`],
    );
    await insertCaptureSlice(client, { merchantId, transactionId: t.rows[0]!.id, batchDate: "2026-03-02", sliceFils: 1005, lineSequence: 1 });
    await insertCaptureSlice(client, { merchantId, transactionId: t.rows[0]!.id, batchDate: "2026-03-03", sliceFils: 1005, lineSequence: 1 });
    // A March batch whose residue settlement already journaled (E73) must be skipped.
    const t2 = await client.query<{ id: string }>(
      `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference, occurred_at)
       VALUES ($1, 'captured', 1007, 1007, $2, '2026-03-04T10:00:00Z') RETURNING id`,
      [merchantId, `acq-${randomUUID()}`],
    );
    const journaledBatch = await insertCaptureSlice(client, { merchantId, transactionId: t2.rows[0]!.id, batchDate: "2026-03-04", sliceFils: 1007, lineSequence: 1 });
    const g = randomUUID();
    await client.query(
      `INSERT INTO ledger_entries (entry_group_id, merchant_id, settlement_batch_id, account_id, direction, amount_fils, occurred_at, description) VALUES
         ($1, $2, $3, 'card_scheme_clearing', 'credit', 7, now(), 'scheme rounding residue (ADR-0002)'),
         ($1, $2, $3, 'scheme_rounding_residue', 'debit', 7, now(), 'scheme rounding residue (ADR-0002)')`,
      [g, merchantId, journaledBatch],
    );
    const result = await runSweep(client, 2026, 3, new Date());
    const mine = result.merchants.find((x) => x.merchantId === merchantId);
    assert.equal(mine?.residueFils, 10, "5 + 5 from the two slices; the E73-journaled batch is not swept again");
    assert.equal(mine?.lineCount, 2);
  } finally {
    await client.end();
  }
});
