import type { Pool, PoolClient } from "pg";
import { toFils } from "@filspay/money";
import { authorizeTransaction } from "../payments/authorize.js";
import { captureTransaction } from "../payments/capture.js";
import { voidTransaction } from "../payments/void.js";
import { applyCaptureDiscountAdjustment } from "../payments/discountAdjustment.js";
import type { AcquirerSimulator, SimulatedCardInput } from "../acquirer/types.js";

export interface PayPaymentLinkInput {
  token: string;
  card: SimulatedCardInput;
  idempotencyKey: string;
  submittedAt?: string;
}

export interface PayPaymentLinkResult {
  statusCode: number;
  body: unknown;
}

/** Returned by the claim UPDATE; merchant_id comes from the link row, never from the request. */
interface ClaimedLinkRow {
  id: string;
  merchant_id: string;
  amount_fils: string | number;
  reference: string | null;
  reservation_token: string;
}

interface LinkStatusRow {
  status: string;
  expires_at: Date;
}

/** DEPRECATED (FP-187, LOG.md E06): never use this on the pay route; a
 * client-sent time must not decide expiry. Kept only because pay.test.ts
 * still tests it (removal needs Zainab's approval). */
export function expiryReferenceTime(submittedAt?: string): Date {
  if (!submittedAt) return new Date();
  const parsed = new Date(submittedAt);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * `POST /v1/payment-links/:token/pay` business logic (public,
 * unauthenticated). Calls `authorizeTransaction`
 * then `captureTransaction` directly, in sequence, never issuing an HTTP
 * request back into the API's own /v1/transactions routes.
 *
 * Concurrency: reserve the link with a single
 * atomic conditional UPDATE, release the row lock immediately, run
 * authorize+capture with no lock held on payment_links at all, then
 * finalize with a second atomic conditional UPDATE keyed on still being in
 * the 'reserved' state. A short, configurable reservation timeout
 * self-heals a link stuck 'reserved' by a crash between claim and
 * finalize, with no sweep job.
 */
export async function payPaymentLink(
  pool: Pool,
  acquirer: AcquirerSimulator,
  config: { paymentLinkReservationTimeoutSeconds: number; maxConcurrentLockedPays?: number },
  input: PayPaymentLinkInput,
): Promise<PayPaymentLinkResult> {
  // FP-187: expiry is judged by the server clock only. A buyer-sent submittedAt
  // is never trusted on this public route.
  const expiryCheckTime = new Date();

  // Step 1 — claim. A single UPDATE is already atomic; no explicit
  // transaction needed.
  // YA: one conditional UPDATE = atomic claim, no explicit txn needed. correct
  const claimResult = await pool.query<ClaimedLinkRow>(
    // E29: SKIP LOCKED — a link whose payment is mid-capture (row locked
    // below) is skipped at once instead of waiting on the lock while holding
    // a pool connection; classifyClaimFailure then answers 409 processing.
    `UPDATE payment_links
        SET status = 'reserved', reserved_at = now(), reservation_token = gen_random_uuid()
      WHERE id = (
            SELECT id FROM payment_links
             WHERE token = $1
               AND (
                    status = 'active'
                    OR (status = 'reserved' AND reserved_at < now() - ($2 || ' seconds')::interval)
                   )
               AND expires_at > $3
             FOR UPDATE SKIP LOCKED
            )
      RETURNING id, merchant_id, amount_fils, reference, reservation_token`,
    [input.token, config.paymentLinkReservationTimeoutSeconds, expiryCheckTime],
  );

  const claimedRow = claimResult.rows[0];
  if (!claimedRow) {
    return classifyClaimFailure(pool, input.token, config.paymentLinkReservationTimeoutSeconds, expiryCheckTime);
  }

  const link = {
    id: claimedRow.id,
    merchantId: claimedRow.merchant_id,
    amountFils: toFils(Number(claimedRow.amount_fils)),
    reference: claimedRow.reference,
    // E29: this request's claim; every later write on the link must match it.
    reservationToken: claimedRow.reservation_token,
  };

  // Step 2 — authorize.
  // am: keys include link.id so two links can never collide on idempotency. good
  const authorizeKey = `paylink:${link.id}:${input.idempotencyKey}:authorize`;
  let authResult: Awaited<ReturnType<typeof authorizeTransaction>>;
  try {
    authResult = await authorizeTransaction(pool, acquirer, {
      merchantId: link.merchantId,
      amountFils: link.amountFils,
      card: input.card,
      reference: link.reference ?? undefined,
      idempotencyKey: authorizeKey,
      // No merchant session/API key initiated this — a customer did, via
      // the public link.
      actor: { type: "system" },
    });
  } catch (err) {
    // E123: authorize threw (its DB work rolled back): free our claim now
    // instead of blocking the link for the reservation timeout.
    await releaseReservation(pool, link.id, link.reservationToken).catch(() => undefined);
    throw err;
  }

  if (authResult.statusCode !== 201) {
    await releaseReservation(pool, link.id, link.reservationToken);
    return {
      statusCode: authResult.statusCode,
      body: { stage: "authorize", ...(authResult.body as Record<string, unknown>) },
    };
  }

  const txnId = (authResult.body as { id: string }).id;

  // E29: hold a row lock on the link from the ownership check through capture
  // and finalize. A second buyer's claim UPDATE waits on this lock and then
  // sees 'paid' (or 'active' after a release), so it can never re-claim the
  // link while this request is still capturing, however slow the acquirer
  // is. If the process dies, the connection drops and the lock is released,
  // so the reservation timeout still recovers abandoned claims.
  // At most half the pool may hold a link lock at once, so every lock holder
  // can still get the second connection captureTransaction needs (fix-reviewer:
  // with pgPoolMax 5, five locked pays would starve each other).
  const releaseSlot = await acquireLockSlot(config.maxConcurrentLockedPays ?? 2);
  let linkClient: PoolClient;
  try {
    linkClient = await pool.connect();
  } catch (err) {
    // E122: no connection (pool timeout) → give the slot back, free the link
    // and void the authorization, or the slot leaks and every later pay waits.
    releaseSlot();
    await releaseReservation(pool, link.id, link.reservationToken).catch(() => undefined);
    await voidTransaction(pool, { transactionId: txnId, merchantId: link.merchantId, actor: { type: "system", id: link.id } }).catch(() => undefined);
    throw err;
  }
  let clientReleased = false;
  let finalized: { id: string; paid_at: Date } | undefined;
  try {
    await linkClient.query("BEGIN");
    const owner = await linkClient.query(
      `SELECT 1 FROM payment_links
        WHERE id = $1 AND status = 'reserved' AND reservation_token = $2
        FOR UPDATE`,
      [link.id, link.reservationToken],
    );
    if ((owner.rowCount ?? 0) === 0) {
      // A second buyer re-claimed our stale reservation while we were
      // authorizing: void our authorization (no money moves) and say so.
      await linkClient.query("ROLLBACK");
      linkClient.release(); // do not hold two connections while voiding
      clientReleased = true;
      await voidTransaction(pool, { transactionId: txnId, merchantId: link.merchantId, actor: { type: "system", id: link.id } });
      return { statusCode: 409, body: { error: "payment_link_processing" } };
    }

    // NOTE: discountAdjustment is applied by the transactions route only, not here — FH
    // MK: it's applied for both now (moved into capture.ts in July)
    // Step 3 — capture (full amount, immediately). amountFils omitted =>
    // capture the full remaining amount — always correct here, since this
    // transaction was just authorized for exactly link.amountFils and
    // nothing else could have touched it yet. captureTransaction uses its
    // own connection and never touches payment_links, so no deadlock.
    const captureKey = `paylink:${link.id}:${input.idempotencyKey}:capture`;
    const captureResult = await captureTransaction(pool, acquirer, {
      transactionId: txnId,
      merchantId: link.merchantId,
      idempotencyKey: captureKey,
      actor: { type: "system", id: link.id },
    });

    if (captureResult.statusCode !== 200) {
      await releaseReservation(linkClient, link.id, link.reservationToken);
      await linkClient.query("COMMIT");
      return {
        statusCode: captureResult.statusCode,
        body: { stage: "capture", ...(captureResult.body as Record<string, unknown>) },
      };
    }

    // see incident 2026-05-14 — two customers charged on one link. root cause: the claim
    // MK: re-evaluation is exactly what makes it safe. the bug was in the web retry, closed
    // am: was it? FP-198 is still open
    // Step 4 — finalize, on the locked row.
    const finalizeResult = await linkClient.query<{ id: string; paid_at: Date }>(
      `UPDATE payment_links
          SET status = 'paid', paid_at = now(), transaction_id = $2, reserved_at = NULL, reservation_token = NULL
        WHERE id = $1 AND status = 'reserved' AND reservation_token = $3
        RETURNING id, paid_at`,
      [link.id, txnId, link.reservationToken],
    );
    finalized = finalizeResult.rows[0];
    await linkClient.query("COMMIT");
  } catch (err) {
    if (!clientReleased) {
      await linkClient.query("ROLLBACK").catch(() => undefined);
      linkClient.release(err instanceof Error ? err : true); // discard a possibly broken connection
      clientReleased = true;
    }
    throw err;
  } finally {
    if (!clientReleased) linkClient.release();
    releaseSlot();
  }

  // FH: this IS reachable — if capture takes past the reservation timeout a second request re-claims,
  // pays and finalizes first; we land here, answer 200, and the card was charged twice
  // MK: authorize+capture is under a second. 60s can't happen. unreachable
  if (!finalized) {
    // E29: with the row lock above this should no longer happen; kept as a
    // safety net. The card WAS charged (transaction txnId), so never answer
    // "paid" for a link we do not own: 409 with the transaction id, logged
    // for a refund.
    console.error(
      `payPaymentLink: finalize lost the reservation for link ${link.id} after capture ` +
        `(transaction ${txnId}) — refund needed`,
    );
    return { statusCode: 409, body: { error: "payment_link_reservation_lost", transactionId: txnId } };
  }

  // E50: apply the merchant's negotiated discount, exactly as the card API
  // capture route does (routes/transactions.ts). MK's note above ("applied for
  // both now, moved into capture.ts") was false: only that route called it.
  // Idempotent per capture event (its own count guard).
  await applyCaptureDiscountAdjustment(pool, { merchantId: link.merchantId, transactionId: txnId });

  return {
    statusCode: 200,
    body: {
      status: "paid",
      transactionId: txnId,
      amountFils: link.amountFils,
      paidAt: finalized.paid_at.toISOString(),
    },
  };
}

/**
 * Used by both decline branches above. Guarded by `status =
 * 'reserved'` for the same reason as the finalize UPDATE: this request
 * only ever releases the reservation it itself holds.
 */
async function releaseReservation(db: Pool | PoolClient, linkId: string, reservationToken: string): Promise<void> {
  // E29: only the claim this request holds (status alone matched anyone's).
  await db.query(
    `UPDATE payment_links SET status = 'active', reserved_at = NULL, reservation_token = NULL
      WHERE id = $1 AND status = 'reserved' AND reservation_token = $2`,
    [linkId, reservationToken],
  );
}

/**
 * The claim UPDATE matched 0 rows. This second read carries no race risk —
 * nothing further is decided from it, it only explains a decision already
 * made by the failed UPDATE.
 */
// FH: "This second read carries no race risk" — Claude disagrees, says we should SELECT
// ... FOR UPDATE here. TODO
// am: its only for the error message. ignore
async function classifyClaimFailure(
  pool: Pool,
  token: string,
  reservationTimeoutSeconds: number,
  expiryCheckTime: Date,
): Promise<PayPaymentLinkResult> {
  const result = await pool.query<LinkStatusRow>(`SELECT status, expires_at FROM payment_links WHERE token = $1`, [
    token,
  ]);
  const row = result.rows[0];

  if (!row) {
    return { statusCode: 404, body: { error: "payment_link_not_found" } };
  }
  if (row.status === "paid") {
    return { statusCode: 409, body: { error: "payment_link_already_paid" } };
  }
  if (row.status === "canceled") {
    return { statusCode: 409, body: { error: "payment_link_canceled" } };
  }
  if (row.status === "active" && row.expires_at.getTime() <= expiryCheckTime.getTime()) {
    return { statusCode: 410, body: { error: "payment_link_expired" } };
  }
  if (row.status === "reserved") {
    // A concurrent claim attempt raced us and won between our own UPDATE's
    // failure and this SELECT. It's still within the timeout (if it
    // weren't, our claim UPDATE would have matched it) — reachable only in
    // a genuine race, not a stale read.
    return { statusCode: 409, body: { error: "payment_link_processing" } };
  }
  // Defensive fallback, should be unreachable given the claim UPDATE's
  // WHERE clause exactly mirrors these cases.
  return { statusCode: 409, body: { error: "payment_link_not_payable", status: row.status } };
}

/**
 * E29: in-process limit on how many pay requests hold a payment_links row
 * lock (and its connection) at the same time. Waiting here holds no DB
 * connection.
 */
let lockSlotsInUse = 0;
const lockSlotWaiters: Array<() => void> = [];
async function acquireLockSlot(limit: number): Promise<() => void> {
  const max = Math.max(1, limit);
  while (lockSlotsInUse >= max) {
    await new Promise<void>((resolve) => lockSlotWaiters.push(resolve));
  }
  lockSlotsInUse += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockSlotsInUse -= 1;
    lockSlotWaiters.shift()?.();
  };
}
