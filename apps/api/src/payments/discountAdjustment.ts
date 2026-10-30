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
    // Fast path kept for the common case (no negotiated discount): no lock,
    // no extra queries. The adjustment runs in the capture's own request.
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
    const events = await client.query<{ amount_fils: string; metadata: { feeFils?: number; discountBps?: number; mdrBps?: number; discountAdjFils?: number } }>(
      `SELECT amount_fils, metadata FROM transaction_events
        WHERE transaction_id = $1 AND event_type IN ('captured', 'partially_captured')
        ORDER BY id`,
      [input.transactionId],
    );
    // E178: each event's own recorded rate (capture.ts writes discountBps);
    // older events without it fall back to the merchant's current rate.
    const rateOf = (e: { metadata: { discountBps?: number } }): number => {
      const recorded = e.metadata?.discountBps;
      return Number.isInteger(recorded) && (recorded as number) >= 0 && (recorded as number) <= 10_000 ? (recorded as number) : discountBps;
    };
    // E50 (decided): the contract is settlement's formula — discount the
    // amount, then apply the MDR (apps/settlement discounted_fee.go). With the
    // MDR rate recorded on the event, the adjustment is exactly
    // fee − settlementFee, so capture's net fee equals the batch fee. Events
    // without mdrBps (before this change) keep the old fee × discount.
    const discountFor = (e: { amount_fils: string; metadata: { feeFils?: number; mdrBps?: number; discountBps?: number; discountAdjFils?: number } }): number => {
      // The amount capture recorded (E50) wins; it is what the sweep counts too.
      const recordedAdj = e.metadata?.discountAdjFils;
      if (Number.isSafeInteger(recordedAdj) && (recordedAdj as number) >= 0) return recordedAdj as number;
      const fee = Math.max(0, e.metadata?.feeFils ?? 0);
      const bps = rateOf(e);
      const mdr = e.metadata?.mdrBps;
      if (Number.isInteger(mdr) && (mdr as number) >= 0 && (mdr as number) <= 10_000) {
        const amount = toFils(Number(e.amount_fils));
        const discountedAmount = Number(amount) - Number(applyRateFils(amount, bps));
        const settlementFee = Number(applyRateFils(toFils(discountedAmount), mdr as number));
        return Math.max(0, fee - settlementFee);
      }
      return Number(applyRateFils(toFils(fee), bps));
    };
    const discounts = events.rows.map(discountFor).filter((d) => d > 0);
    if (discounts.length === 0) return;

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

/**
 * E131: the durable retry. applyCaptureDiscountAdjustment runs after a paid
 * checkout has committed; if it fails there, nothing re-ran it and the
 * merchant missed the discount credit. This sweep finds captures (last 2 hours) of
 * discounted merchants that have fewer adjustment credits than capture
 * events and calls the same idempotent function, which writes only the
 * missing ones under the transaction's row lock.
 */
export async function sweepMissingDiscountAdjustments(pool: Pool, limit = 100): Promise<number> {
  const candidates = await pool.query<{ id: string; merchant_id: string }>(
    `SELECT t.id, t.merchant_id
       FROM transactions t
       JOIN merchants m ON m.id = t.merchant_id
      WHERE m.negotiated_discount_bps > 0
        AND t.captured_fils > 0
        -- fix-reviewer: a short window. A missed adjustment is retried within a
        -- minute; a long window would let a later change of the merchant's
        -- discount rate resize old adjustments (E178).
        AND t.created_at > now() - interval '2 hours'
        -- only events with an adjustment above 0: the recorded discountAdjFils
        -- (E50) when present, else the old rule (half-even rounding of
        -- fee * bps / 10000 is 0 when fee * bps <= 5000)
        AND (SELECT count(*) FROM transaction_events e
              WHERE e.transaction_id = t.id AND e.event_type IN ('captured', 'partially_captured')
                AND CASE WHEN jsonb_typeof(e.metadata->'discountAdjFils') = 'number' AND e.metadata->>'discountAdjFils' ~ '^[0-9]{1,15}$'
                         THEN (e.metadata->>'discountAdjFils')::bigint > 0
                         ELSE (CASE WHEN jsonb_typeof(e.metadata->'feeFils') = 'number' AND e.metadata->>'feeFils' ~ '^[0-9]{1,15}$'
                          THEN (e.metadata->>'feeFils')::bigint ELSE 0 END)
                    * (CASE WHEN jsonb_typeof(e.metadata->'discountBps') = 'number' AND e.metadata->>'discountBps' ~ '^[0-9]{1,5}$'
                                 AND (e.metadata->>'discountBps')::int <= 10000
                            THEN (e.metadata->>'discountBps')::int ELSE m.negotiated_discount_bps END) > 5000
                    END)
          > (SELECT count(*) FROM ledger_entries l
              WHERE l.transaction_id = t.id AND l.direction = 'credit'
                AND l.description = 'capture: negotiated discount adjustment')
      ORDER BY t.created_at
      LIMIT $1`,
    [limit],
  );
  let repaired = 0;
  for (const row of candidates.rows) {
    try {
      await applyCaptureDiscountAdjustment(pool, { merchantId: row.merchant_id, transactionId: row.id });
      repaired += 1;
    } catch (err) {
      console.error(`[discount-sweep] transaction ${row.id}: ${(err as Error).message}`);
    }
  }
  return repaired;
}
