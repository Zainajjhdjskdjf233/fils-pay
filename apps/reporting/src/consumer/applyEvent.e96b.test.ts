/**
 * E96 (rest): a settlement.batch_closed event must write the payout trend row
 * from the batch row itself (merchant, date, amounts), not from the payload,
 * so a bad producer cannot put merchant X's batch into Y's dashboard.
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { applyEvent } from "./applyEvent.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("applyEvent.e96b.test.ts requires DATABASE_URL");
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
test.after(async () => { await pool.end(); });

test("testE96_trendRowComesFromTheBatchNotThePayload", async () => {
  const mk = async (n: string) => (await pool.query<{ id: string }>(`INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`, [`E96 ${n} ${randomUUID()}`])).rows[0]!.id;
  const realMerchant = await mk("real");
  const otherMerchant = await mk("other");
  const b = await pool.query<{ id: string }>(
    `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, closed_at)
     VALUES ($1, '2026-01-08', 'closed', 1000, 25, 975, now()) RETURNING id`,
    [realMerchant],
  );
  const client = await pool.connect();
  try {
    await applyEvent(client, {
      id: 1, event_type: "settlement.batch_closed", aggregate_id: b.rows[0]!.id, created_at: new Date(),
      payload: { merchantId: otherMerchant, batchId: b.rows[0]!.id, batchDate: "2026-01-08", grossFils: 999999, feeFils: 1, netPayoutFils: 999998 },
    } as never);
  } finally {
    client.release();
  }
  const rows = await pool.query<{ merchant_id: string; gross_fils: string }>(
    `SELECT merchant_id, gross_fils FROM merchant_payout_trends WHERE settlement_batch_id = $1`, [b.rows[0]!.id],
  );
  assert.equal(rows.rowCount, 1);
  assert.equal(rows.rows[0]!.merchant_id, realMerchant, "the batch's own merchant, not the payload's");
  assert.equal(Number(rows.rows[0]!.gross_fils), 1000, "the batch's own amounts");
});
