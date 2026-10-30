import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { applyRateFils, toFils } from "@filspay/money";
import { withTransaction } from "../db/withTransaction.js";
import { BadRequestError } from "../lib/errors.js";


/**
 * Parses a promotional discount amount (BD string from the merchant
 * pricing dashboard) into fils for the ledger adjustment.
 */
export function parsePromotionalDiscountFils(raw: string): number {
  const parsed = parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new BadRequestError("invalid_discount", `could not parse discount amount "${raw}"`);
  }
  return Math.round(parsed * 100);
}

/**
 * Applies a merchant's negotiated processing discount against the MDR fee
 * capture.ts already charged, per the merchant's pricing agreement: the
 * discount applies to our processing fee, after it's calculated — see the
 * partner-pricing addendum. capture.ts's own response doesn't carry the
 * fee it just charged, so this reads it back from the transaction_events
 * row capture.ts already wrote (its `metadata.feeFils`), then reverses the
 * merchant's share via a same-day ledger adjustment.
 *
 * A merchant with negotiated_discount_bps = 0 (the default for anyone
 * without a negotiated rate) is a no-op: this
 * function reads the merchant row, sees a zero discount rate, and inserts
 * nothing.
 */
export async function applyCaptureDiscountAdjustment(
  pool: Pool,
  input: { merchantId: string; transactionId: string },
): Promise<void> {
  return withTransaction(pool, async (client) => {
    const merchantRow = await client.query<{ negotiated_discount_bps: number }>(
      `SELECT negotiated_discount_bps FROM merchants WHERE id = $1`,
      [input.merchantId],
    );
    const discountBps = merchantRow.rows[0]?.negotiated_discount_bps ?? 0;
    if (discountBps === 0) return;

    // Exactly one adjustment per capture event. A replayed (idempotent)
    // capture returns its cached 200 without writing a new
    // transaction_events row, so the caller re-enters this path with
    // nothing new to adjust — reversing the same fee a second time would
    // credit the merchant twice for one capture. The row lock serializes
    // this count against a concurrent capture's own adjustment.
    await client.query(`SELECT id FROM transactions WHERE id = $1 FOR UPDATE`, [input.transactionId]);
    // E124: adjustments are only ever written here, in capture-event order,
    // under the row lock, and only for events whose discount is above 0. So
    // the N-th such event owns the N-th adjustment. Every event past the
    // existing adjustments gets one, sized from ITS OWN fee (the old code
    // sized each missing one from the latest capture's fee).
    const countRow = await client.query<{ adjustments: string }>(
      `SELECT count(*) AS adjustments FROM ledger_entries
        WHERE transaction_id = $1 AND direction = 'credit'
          AND description = 'capture: negotiated discount adjustment'`,
      [input.transactionId],
    );
    const events = await client.query<{ metadata: { feeFils?: number } }>(
      `SELECT metadata FROM transaction_events
        WHERE transaction_id = $1 AND event_type IN ('captured', 'partially_captured')
        ORDER BY id`,
      [input.transactionId],
    );
    const discounts = events.rows
      .map((e) => applyRateFils(toFils(Math.max(0, e.metadata?.feeFils ?? 0)), discountBps))
      .filter((d) => d > 0);

    for (const discountFils of discounts.slice(Number(countRow.rows[0]?.adjustments ?? 0))) {
      const entryGroupId = randomUUID();
      await client.query(
        `INSERT INTO ledger_entries
           (entry_group_id, merchant_id, transaction_id, account_id, direction, amount_fils, occurred_at, description)
         VALUES
           ($1, $2, $3, 'platform_fee_revenue', 'debit',  $4, now(), 'capture: negotiated discount adjustment'),
           ($1, $2, $3, 'merchant_payable',     'credit', $4, now(), 'capture: negotiated discount adjustment')`,
        [entryGroupId, input.merchantId, input.transactionId, discountFils],
      );
    }
  });
}
