// YA (Mar): parked until the refunds API exists — FP-212
// MK: drawer is done, just uncomment + add the route. 30 min job
// FH: claude review: posts to /v1/refunds but initiateMerchantRefund expects /v1/merchants/:id/refunds,
// and it makes a new idempotency key per click. check before uncommenting
// max refund = captured is right, partial refunds are tracked server side — am
// F01f (un-parked): the API exists (F01b). Fixed on the way in: amount typed in
// BD (the API requires a positive amountFils, so "blank = everything" is gone);
// one Idempotency-Key per refund attempt, reused on retry (FH was right — a new
// key per click could refund twice after a network error); partially_refunded
// is refundable; max = captured - refunded (am's "max = captured" was wrong
// after a first partial refund); optional reason (API max 500).
import { useState } from "react";
import { request } from "../../api/client.js";
import { describeError } from "../../api/client.js";
import { useDashboardAuth } from "../../auth/DashboardAuthContext.js";
import { RequireRole } from "../../auth/RequireRole.js";
import { bhd } from "../../format.js";
import type { TransactionDto } from "../../types.js";
import { isRefundable, parseRefundAmount } from "./refundForm.js";

interface RefundResponse {
  id: string;
  transactionId: string;
  amountFils: number;
  feeReversedFils: number;
  status: string;
  transactionStatus: string;
  refundedTotalFils: number;
  occurredAt: string;
}

interface RefundDrawerProps {
  txn: TransactionDto;
  onRefunded: () => Promise<void>;
}

export function RefundDrawer({ txn, onRefunded }: RefundDrawerProps) {
  const { me } = useDashboardAuth();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per refund attempt: created when the form opens, reused for
  // retries of the same attempt, dropped after success or cancel.
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const merchantId = me?.merchant.id;
  const remainingFils = txn.capturedFils - txn.refundedFils;

  function openForm(): void {
    setIdempotencyKey(crypto.randomUUID());
    setError(null);
    setOpen(true);
  }

  function closeForm(): void {
    setOpen(false);
    setAmount("");
    setReason("");
    setIdempotencyKey(null);
  }

  async function handleRefund(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!merchantId || !idempotencyKey) return;
    const parsed = parseRefundAmount(amount, remainingFils);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (!window.confirm(`Refund ${bhd(parsed.fils)}? The money goes back to the cardholder and cannot be recalled.`)) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const body: { transactionId: string; amountFils: number; reason?: string } = {
        transactionId: txn.id,
        amountFils: parsed.fils,
      };
      if (reason.trim() !== "") body.reason = reason.trim();
      await request<RefundResponse>(`/v1/merchants/${encodeURIComponent(merchantId)}/refunds`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(body),
      });
      closeForm();
      // Refetch rather than patch: the refund wrote a new transaction_events
      // row server-side, so the timeline is stale, not merely shorter.
      await onRefunded();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isRefundable(txn)) return null;

  return (
    <RequireRole allow={["owner", "finance"]}>
      <div className="dash-actions">
        {error ? <p className="dash-error">{error}</p> : null}
        {open ? (
          <form className="dash-form dash-form-inline" onSubmit={(e) => void handleRefund(e)}>
            <label>
              Amount (BD)
              <input
                inputMode="decimal"
                placeholder="1.250"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
            <label>
              Reason (optional)
              <input maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <p className="dash-muted">
              Captured {bhd(txn.capturedFils)} · refunded {bhd(txn.refundedFils)} · still refundable {bhd(remainingFils)}
            </p>
            <button type="submit" className="dash-button" disabled={submitting}>
              {submitting ? "Refunding..." : "Refund"}
            </button>
            <button type="button" className="dash-button" disabled={submitting} onClick={closeForm}>
              Cancel
            </button>
          </form>
        ) : (
          <button type="button" className="dash-button" onClick={openForm}>
            Refund
          </button>
        )}
      </div>
    </RequireRole>
  );
}
