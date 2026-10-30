/** E50 [decided]: the contract is settlement's formula — discount the amount,
 *  then apply the MDR (apps/settlement discounted_fee.go). The capture-time
 *  adjustment must leave exactly that fee. Example: 1020 fils at 250 bps with
 *  a 12.5 % discount: capture fee 26; settlement fee 22; adjustment 4 (the old
 *  "fee x discount" gave 3, a net fee of 23). Requires DATABASE_URL. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { applyCaptureDiscountAdjustment } from "./discountAdjustment.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("discountFormula.e50.test.ts requires DATABASE_URL");
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
test.after(async () => { await pool.end(); });

test("testE50_captureAdjustmentMatchesTheSettlementFormula", async () => {
  const m = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps, negotiated_discount_bps) VALUES ($1, 250, 1250) RETURNING id`, [`E50 ${randomUUID()}`],
  );
  const t = await pool.query<{ id: string }>(
    `INSERT INTO transactions (merchant_id, status, amount_fils, captured_fils, acquirer_reference) VALUES ($1, 'captured', 1020, 1020, $2) RETURNING id`,
    [m.rows[0]!.id, `acq-${randomUUID()}`],
  );
  await pool.query(
    `INSERT INTO transaction_events (transaction_id, event_type, amount_fils, actor_type, metadata) VALUES ($1, 'captured', 1020, 'system', $2::jsonb)`,
    [t.rows[0]!.id, JSON.stringify({ feeFils: 26, discountBps: 1250, mdrBps: 250 })],
  );
  await applyCaptureDiscountAdjustment(pool, { merchantId: m.rows[0]!.id, transactionId: t.rows[0]!.id });
  const credit = await pool.query<{ amount_fils: string }>(
    `SELECT amount_fils FROM ledger_entries WHERE transaction_id = $1 AND direction = 'credit' AND description = 'capture: negotiated discount adjustment'`,
    [t.rows[0]!.id],
  );
  assert.deepEqual(credit.rows.map((r) => Number(r.amount_fils)), [4], "fee 26 − adjustment 4 = 22, the settlement fee");
});
