import type { Pool } from "pg";

export type CancelPaymentLinkResult =
  | { outcome: "canceled" }
  | { outcome: "not_found" }
  | { outcome: "not_cancelable"; status: string };

/** Cancels an active payment link by id, only if it belongs to merchantId. */
export async function cancelPaymentLink(
  pool: Pool,
  input: { id: string; merchantId: string; reservationTimeoutSeconds?: number },
): Promise<CancelPaymentLinkResult> {
  // E101: a link whose reservation went stale (the pay attempt died) can be
  // canceled too. A payment still in flight holds the row lock through
  // capture (E29), so this UPDATE waits for it and then no longer matches.
  const updateResult = await pool.query<{ id: string }>(
    `UPDATE payment_links
        SET status = 'canceled', canceled_at = now()
      WHERE id = $1 AND merchant_id = $2
        AND (status = 'active'
             OR (status = 'reserved' AND COALESCE(reserved_at, 'epoch') < now() - make_interval(secs => $3)))
      RETURNING id`,
    [input.id, input.merchantId, input.reservationTimeoutSeconds ?? 60],
  );
  if (updateResult.rows[0]) {
    return { outcome: "canceled" };
  }

  // YA: second read is just for the error shape, no race. fine
  const lookupResult = await pool.query<{ status: string }>(
    `SELECT status FROM payment_links WHERE id = $1 AND merchant_id = $2`,
    [input.id, input.merchantId],
  );
  const row = lookupResult.rows[0];
  if (!row) {
    return { outcome: "not_found" };
  }
  return { outcome: "not_cancelable", status: row.status };
}
