/**
 * Test helper for the reconcile_march tests (E72): builds what the sweep reads
 * — a closed settlement batch, a capture event in it, and the scheme line
 * with the truncated amount — for one capture slice. Test databases only.
 */
import type { Client } from "pg";

export async function insertCaptureSlice(
  client: Client,
  input: { merchantId: string; transactionId: string; batchDate: string; sliceFils: number; lineSequence: number },
): Promise<string> {
  const batch = await client.query<{ id: string }>(
    `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, closed_at)
     VALUES ($1, $2, 'closed', 0, 0, 0, now())
     ON CONFLICT (merchant_id, batch_date) DO UPDATE SET status = settlement_batches.status
     RETURNING id`,
    [input.merchantId, input.batchDate],
  );
  const batchId = batch.rows[0]!.id;
  await client.query(
    `INSERT INTO transaction_events (transaction_id, event_type, amount_fils, actor_type, settlement_batch_id, occurred_at)
     VALUES ($1, 'partially_captured', $2, 'system', $3, ($4::date + time '10:00') AT TIME ZONE 'Asia/Bahrain')`,
    [input.transactionId, input.sliceFils, batchId, input.batchDate],
  );
  await client.query(
    `INSERT INTO scheme_export_lines (settlement_batch_id, transaction_id, amount_fils, line_sequence) VALUES ($1, $2, $3, $4)`,
    [batchId, input.transactionId, Math.floor(input.sliceFils / 10) * 10, input.lineSequence],
  );
  return batchId;
}
