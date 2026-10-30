/** E178 [deep review]: a discount adjustment must use the rate that applied
 *  at capture time, recorded on the capture event — not the merchant's rate
 *  today. Requires DATABASE_URL. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { applyCaptureDiscountAdjustment } from "./discountAdjustment.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("discountRate.e178.test.ts requires DATABASE_URL");
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
test.after(async () => { await pool.end(); });

test("testE178_adjustmentUsesTheRateRecordedAtCapture", async () => {
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, negotiated_discount_bps) VALUES ($1, 250, 2000) RETURNING id`, [`E178 ${randomUUID()}`],
  );
  const merchantId = m.rows[0]!.id;
  const t = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference) VALUES ($1, 'captured', 10040, 10040, $2) RETURNING id`,
    [merchantId, `acq-${randomUUID()}`],
  );
  // Two captures at 2000 bps: fee 1 (discount rounds to 0) and fee 250 (discount 50).
  for (const fee of [1, 250]) {
    await pool.query(
      `INSERT INTO transaction_events (transaction_id, event_type, amount_fils, actor_type, metadata) VALUES ($1, 'partially_captured', 40, 'system', $2::jsonb)`,
      [t.rows[0]!.id, JSON.stringify({ feeFils: fee, discountBps: 2000 })],
    );
  }
  await applyCaptureDiscountAdjustment(pool, { merchantId, transactionId: t.rows[0]!.id });
  // The merchant's rate goes up later; a later call must not resize history.
  await pool.query(`UPDATE merchants SET negotiated_discount_bps = 6000 WHERE id = $1`, [merchantId]);
  await applyCaptureDiscountAdjustment(pool, { merchantId, transactionId: t.rows[0]!.id });
  const credits = await pool.query<{ amount_fils: string }>(
    `SELECT amount_fils FROM ledger_entries WHERE transaction_id = $1 AND direction = 'credit' AND description = 'capture: negotiated discount adjustment' ORDER BY id`,
    [t.rows[0]!.id],
  );
  assert.deepEqual(credits.rows.map((r) => Number(r.amount_fils)), [50], "one credit of 50 at the capture-time rate");
});
