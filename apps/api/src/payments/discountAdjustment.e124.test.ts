/**
 * E124 [deep review]: each capture event gets exactly one discount adjustment,
 * sized from ITS OWN fee. Before the fix every missing adjustment was sized
 * from the latest capture's fee, so a replay after a lost adjustment credited
 * the wrong amount (2 × latest instead of first + latest).
 * Requires DATABASE_URL to point at a real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { applyCaptureDiscountAdjustment } from "./discountAdjustment.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("discountAdjustment.e124.test.ts requires DATABASE_URL to point at a real, migrated Postgres");
}
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
test.after(async () => {
  await pool.end();
});

test("testE124_eachCaptureGetsTheDiscountOfItsOwnFee", async () => {
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, negotiated_discount_bps) VALUES ($1, 250, 2000) RETURNING id`,
    [`E124 ${randomUUID()}`],
  );
  const merchantId = m.rows[0]!.id;
  const t = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference)
     VALUES ($1, 'captured', 6000, 6000, $2) RETURNING id`,
    [merchantId, `acq_${randomUUID()}`],
  );
  const transactionId = t.rows[0]!.id;
  // Two partial captures (fee 100, then fee 50); the first one's adjustment was lost.
  for (const [amount, fee, type] of [[4000, 100, "partially_captured"], [2000, 50, "captured"]] as const) {
    await pool.query(
      `INSERT INTO transaction_events (transaction_id, event_type, amount_fils, actor_type, metadata) VALUES ($1, $2, $3, 'system', $4)`,
      [transactionId, type, amount, JSON.stringify({ feeFils: fee })],
    );
  }

  // The second capture's own call, then two replays.
  for (let i = 0; i < 3; i++) await applyCaptureDiscountAdjustment(pool, { merchantId, transactionId });

  const r = await pool.query<{ amount_fils: string }>(
    `SELECT amount_fils FROM ledger_entries
      WHERE transaction_id = $1 AND account_id = 'merchant_payable' AND description = 'capture: negotiated discount adjustment'
      ORDER BY id`,
    [transactionId],
  );
  assert.deepEqual(r.rows.map((x) => Number(x.amount_fils)).sort((a, b) => a - b), [10, 20], "20 % of fee 100 and 20 % of fee 50, once each");
});

test("testE124_aZeroDiscountCaptureDoesNotShiftLaterAdjustments", async () => {
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, negotiated_discount_bps) VALUES ($1, 250, 2000) RETURNING id`,
    [`E124b ${randomUUID()}`],
  );
  const merchantId = m.rows[0]!.id;
  const t = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference)
     VALUES ($1, 'captured', 4040, 4040, $2) RETURNING id`,
    [merchantId, `acq_${randomUUID()}`],
  );
  const transactionId = t.rows[0]!.id;
  // Fee 1 → 20 % rounds to 0 (no adjustment); fee 100 → 20.
  for (const [amount, fee, type] of [[40, 1, "partially_captured"], [4000, 100, "captured"]] as const) {
    await pool.query(
      `INSERT INTO transaction_events (transaction_id, event_type, amount_fils, actor_type, metadata) VALUES ($1, $2, $3, 'system', $4)`,
      [transactionId, type, amount, JSON.stringify({ feeFils: fee })],
    );
  }
  for (let i = 0; i < 3; i++) await applyCaptureDiscountAdjustment(pool, { merchantId, transactionId });
  const r = await pool.query<{ amount_fils: string }>(
    `SELECT amount_fils FROM ledger_entries
      WHERE transaction_id = $1 AND account_id = 'merchant_payable' AND description = 'capture: negotiated discount adjustment'`,
    [transactionId],
  );
  assert.deepEqual(r.rows.map((x) => Number(x.amount_fils)), [20], "one adjustment of 20, never repeated on replay");
});
