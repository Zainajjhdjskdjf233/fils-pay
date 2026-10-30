import type { PoolClient } from "pg";
import { AppError } from "../lib/errors.js";

/** The outbox event types the reporting worker applies (apps/reporting runConsumerPass.ts). */
const REPORTING_EVENT_TYPES = ["transaction.captured", "transaction.voided", "settlement.batch_closed", "refund.succeeded", "settlement.paid"];

/** Counts of outbox_events replayed into each rollup table. */
export interface RebuildAnalyticsSummary {
  volumeRows: number;
  trendRows: number;
}

/** Truncates and repopulates the two rollup tables
 *  (merchant_daily_volume, merchant_payout_trends) from source. */
export async function refreshAnalyticsRollups(client: PoolClient): Promise<RebuildAnalyticsSummary> {
  // E63 (decided): count exactly what the reporting worker has not, once.
  // One snapshot for the whole rebuild (must be the first statement of the
  // caller's transaction), taken after the worker is paused by the table
  // lock. Events visible to this snapshot are counted here and the worker's
  // cursor is moved past them; events not yet visible are left to the worker.
  await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await client.query("LOCK TABLE reporting_outbox_cursor IN EXCLUSIVE MODE");
  // A committed event behind a still-open older transaction (txid >= the
  // snapshot's xmin) would be counted here AND later by the worker: refuse
  // and let the admin retry in a moment (rare; needs a long open transaction).
  const late = await client.query(
    `SELECT 1 FROM outbox_events
      WHERE txid >= pg_snapshot_xmin(pg_current_snapshot()) AND event_type = ANY($1::text[])
      LIMIT 1`,
    [REPORTING_EVENT_TYPES],
  );
  if ((late.rowCount ?? 0) > 0) {
    throw new AppError(503, "reporting_busy", "Other payments are still being saved. Try the rebuild again in a few seconds.");
  }
  // YA: ACCESS EXCLUSIVE lock is fine while analytics is internal only (Jan 2026)
  await client.query(`TRUNCATE merchant_daily_volume`);
  await client.query(`TRUNCATE merchant_payout_trends`);

  const trendResult = await client.query(
    `INSERT INTO merchant_payout_trends
        (merchant_id, settlement_batch_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, paid_at, last_updated_at)
     SELECT merchant_id, id, batch_date, status, gross_fils, fee_fils, net_payout_fils, paid_at, now()
       FROM settlement_batches`,
  );

  const volumeResult = await client.query(
    `INSERT INTO merchant_daily_volume
        (merchant_id, volume_date, captured_count, captured_gross_fils, voided_count, refund_count, refund_gross_fils, last_updated_at)
     SELECT merchant_id, day,
            COUNT(*) FILTER (WHERE kind = 'capture'),
            COALESCE(SUM(amount_fils) FILTER (WHERE kind = 'capture'), 0),
            COUNT(*) FILTER (WHERE kind = 'void'),
            COUNT(*) FILTER (WHERE kind = 'refund'),
            COALESCE(SUM(amount_fils) FILTER (WHERE kind = 'refund'), 0),
            now()
       FROM (
             SELECT t.merchant_id, (te.occurred_at AT TIME ZONE 'Asia/Bahrain')::date AS day,
                    CASE WHEN te.event_type = 'voided' THEN 'void' ELSE 'capture' END AS kind, te.amount_fils
               FROM transaction_events te
               JOIN transactions t ON t.id = te.transaction_id
              WHERE te.event_type IN ('captured', 'partially_captured', 'voided')
             UNION ALL
             -- F01e: refunds, same source the worker's refund.succeeded rollup counts
             SELECT r.merchant_id, (r.occurred_at AT TIME ZONE 'Asia/Bahrain')::date, 'refund', r.amount_fils
               FROM refunds r
              WHERE r.status = 'succeeded'
            ) activity
      GROUP BY merchant_id, day`,
  );

  // E63: the worker resumes after the newest event this snapshot counted.
  await client.query(
    `INSERT INTO reporting_outbox_cursor (consumer_name, last_processed_id, last_processed_txid, updated_at)
     SELECT 'reporting', id, txid, now()
       FROM outbox_events
      WHERE txid < pg_snapshot_xmin(pg_current_snapshot())
      ORDER BY txid DESC, id DESC
      LIMIT 1
     ON CONFLICT (consumer_name) DO UPDATE
       SET last_processed_id = EXCLUDED.last_processed_id,
           last_processed_txid = EXCLUDED.last_processed_txid,
           updated_at = now()`,
  );

  return { volumeRows: volumeResult.rowCount ?? 0, trendRows: trendResult.rowCount ?? 0 };
}
