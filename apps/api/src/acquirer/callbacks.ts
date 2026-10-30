import type { Pool } from "pg";
import { NotFoundError } from "../lib/errors.js";

/** @property outcome Validated against the two allowed values by the route schema. */
export interface AcquirerCallbackInput {
  callbackId: string;
  type: "fraud_review.completed";
  transactionId: string;
  occurredAt: string;
  outcome: "cleared" | "confirmed_fraud";
  note: string;
}

interface TransactionMerchantRow {
  merchant_id: string;
}

/**
 * Applies one acquirer callback: looks up the transaction it refers to and
 * appends a note recording the acquirer's own delayed verdict.
 * acquirer_callback_notes is append-only and surfaced on the transaction
 * timeline for support/finance to read — a fraud-review verdict is
 * informational, not a state transition, so this never touches
 * transactions.status or the ledger; a confirmed-fraud outcome still needs
 * a human decision to void/refund, exactly as today.
 */
export async function applyAcquirerCallback(pool: Pool, callback: AcquirerCallbackInput): Promise<void> {
  const txnResult = await pool.query<TransactionMerchantRow>(
    `SELECT merchant_id FROM transactions WHERE id = $1`,
    [callback.transactionId],
  );
  const txnRow = txnResult.rows[0];
  if (!txnRow) {
    throw new NotFoundError("transaction_not_found");
  }

  // E27 (FP-201): store each callback_id once. The bank resends callbacks,
  // and withCallbackRetry may re-run this. A per-callback advisory lock makes
  // check-then-insert safe for two copies arriving at once. (HANDOVER.md's
  // processed_events table does not exist; a unique index could not be
  // created where duplicates already exist — Decision in LOG.md.)
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('acquirer_callback:' || $1))`, [callback.callbackId]);
    await client.query(
      `INSERT INTO acquirer_callback_notes
          (transaction_id, merchant_id, callback_id, callback_type, outcome, note, received_at)
       SELECT $1, $2, $3, $4, $5, $6, $7
        WHERE NOT EXISTS (SELECT 1 FROM acquirer_callback_notes WHERE callback_id = $3)`,
      [
        callback.transactionId,
        txnRow.merchant_id,
        callback.callbackId,
        callback.type,
        callback.outcome,
        callback.note,
        callback.occurredAt,
      ],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Defaults: 3 attempts, 50 ms apart.
 * — FH
 */
export interface CallbackRetryOptions {
  maxAttempts?: number;
  delayMs?: number;
}

export async function withCallbackRetry<T>(fn: () => Promise<T>, options: CallbackRetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const delayMs = options.delayMs ?? 50;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastErr;
}
