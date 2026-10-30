/**
 * E41: a settlement.batch_closed event for a day that has captures but no
 * daily-volume row yet must not crash the reporting pass.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { applyEvent } from "./applyEvent.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("applyEvent.e41.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
test.after(async () => {
  await pool.end();
});

test("testE41_missingRollupRowDoesNotCrash", async () => {
  const m = await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E41 ${randomUUID()}`]);
  const merchantId = m.rows[0]!.id;
  const t = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference, occurred_at)
     VALUES ($1, 'captured', 1000, 1000, $2, '2026-01-07T09:00:00Z') RETURNING id`,
    [merchantId, `acq-${randomUUID()}`],
  );
  await pool.query(
    `INSERT INTO transaction_events (transaction_id, event_type, amount_fils, actor_type, occurred_at) VALUES ($1, 'captured', 1000, 'system', '2026-01-07T09:00:00Z')`,
    [t.rows[0]!.id],
  );
  const b = await pool.query<{ id: string }>(
    `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, closed_at)
     VALUES ($1, '2026-01-07', 'closed', 1000, 25, 975, now()) RETURNING id`,
    [merchantId],
  );
  const client = await pool.connect();
  try {
    await applyEvent(client, {
      id: 1, event_type: "settlement.batch_closed", aggregate_id: b.rows[0]!.id, created_at: new Date(),
      payload: { merchantId, batchId: b.rows[0]!.id, batchDate: "2026-01-07", grossFils: 1000, feeFils: 25, netPayoutFils: 975 },
    });
  } finally {
    client.release();
  }
  const trend = await pool.query(`SELECT 1 FROM merchant_payout_trends WHERE settlement_batch_id = $1`, [b.rows[0]!.id]);
  assert.equal(trend.rowCount, 1, "the payout trend row is still written");
});
