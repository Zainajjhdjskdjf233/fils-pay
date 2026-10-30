import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { formatBhd, toFils } from "@filspay/money";
import { getPaymentLink, payPaymentLink } from "../../api/paymentLinks.js";
import { ApiError } from "../../api/client.js";
import { dateTime } from "../../format.js";
import type { PaymentLinkPublicDto, PayPaymentLinkResponse, SimulatedCardInput } from "../../types.js";
import "./CheckoutPage.css";

type LoadState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "loaded"; link: PaymentLinkPublicDto };

type PayState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; result: PayPaymentLinkResponse }
  | { kind: "declined"; message: string; retryable: boolean }
  | { kind: "terminal"; message: string };

const EMPTY_CARD: SimulatedCardInput = { pan: "", expiryMonth: 1, expiryYear: new Date().getFullYear() + 1, cvv: "" };

export function CheckoutPage() {
  const { token } = useParams<{ token: string }>();
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [payState, setPayState] = useState<PayState>({ kind: "idle" });
  const [card, setCard] = useState<SimulatedCardInput>(EMPTY_CARD);
  const [brandHint, setBrandHint] = useState<string | null>(null);
  // UX: a second click in the same frame (before React re-renders the disabled
  // button) must not send a second attempt with a new Idempotency-Key.
  const inFlight = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  // FH: memory leak — this effect never aborts the fetch on unmount (React warning in console?)
  // theres a cancelled flag in the cleanup tho. warning must be from somewhere else — am
  useEffect(() => {
    if (!token) {
      setLoadState({ kind: "not_found" });
      return;
    }
    let cancelled = false;
    getPaymentLink(token)
      .then((link) => {
        if (!cancelled) setLoadState({ kind: "loaded", link });
      })
      .catch(() => {
        // Never distinguishes "malformed token" from "doesn't exist" —
        // matches the API's own non-disclosure choice.
        if (!cancelled) setLoadState({ kind: "not_found" });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!token || inFlight.current) return;
    inFlight.current = true;

    // A fresh Idempotency-Key per explicit user action — every click,
    // including a "try again" after a decline, is a new attempt.
    const idempotencyKey = crypto.randomUUID();
    const submittedAt = new Date().toISOString();
    setPayState({ kind: "submitting" });

    try {
      const result = await payPaymentLink(token, { card, submittedAt }, idempotencyKey);
      setPayState({ kind: "success", result });
    } catch (err) {
      if (err instanceof ApiError) {
        const { statusCode, body } = err;
        if (statusCode === 402) {
          const stageLabel = body.stage === "capture"
            ? "Your payment could not be completed. You have not been charged. Please try again or use another card."
            : "Your card was declined. Please check the card details or use another card.";
          setPayState({ kind: "declined", message: stageLabel, retryable: true });
        } else if (statusCode === 502) {
          setPayState({ kind: "declined", message: "We could not reach the card network. You have not been charged. Please try again in a moment.", retryable: true });
        } else if (statusCode === 409 && body.error === "payment_link_already_paid") {
          setPayState({ kind: "terminal", message: "This invoice has already been paid." });
        } else if (statusCode === 409 && body.error === "payment_link_canceled") {
          setPayState({ kind: "terminal", message: "This payment link is no longer available." });
        } else if (statusCode === 409 && body.error === "payment_link_reservation_lost") {
          // E100: the card WAS charged (pay.ts:247 returns the transaction id); another
          // payment completed the link first. Never invite a retry; keep the reference.
          const ref = typeof body.transactionId === "string" ? ` Your reference: ${body.transactionId}.` : "";
          setPayState({
            kind: "terminal",
            message: `Your card was charged, but this invoice was paid at the same moment by another payment. Do not pay again. The merchant will refund you; please contact them with your reference.${ref}`,
          });
        } else if (statusCode === 409) {
          setPayState({ kind: "declined", message: "A payment is already being processed for this link. Please try again shortly.", retryable: true });
        } else if (statusCode === 410) {
          setPayState({ kind: "terminal", message: "This payment link has expired." });
        } else {
          setPayState({ kind: "declined", message: "Something went wrong and you have not been charged. Please try again.", retryable: true });
        }
      } else {
        setPayState({ kind: "declined", message: "We could not connect. Check your internet connection and try again.", retryable: true });
      }
    } finally {
      inFlight.current = false;
    }
  }

  // UX: the browser tab names the merchant being paid.
  useEffect(() => {
    document.title = loadState.kind === "loaded" ? `Pay ${loadState.link.merchantDisplayName} · FilsPay` : "Checkout · FilsPay";
  }, [loadState]);

  // UX: move keyboard and screen-reader focus to a new error so it is noticed.
  useEffect(() => {
    if (payState.kind === "declined") errorRef.current?.focus();
  }, [payState]);

  if (loadState.kind === "loading") {
    return (
      <main className="checkout-page" aria-busy="true">
        <div className="checkout-card checkout-state">
          <span className="checkout-spinner" aria-hidden="true" />
          <p>Loading payment details…</p>
        </div>
      </main>
    );
  }

  if (loadState.kind === "not_found") {
    return (
      <StatePage
        tone="error"
        title="Payment link not found"
        body="This link is not valid. Check that you copied the whole link, or ask the merchant to send it again."
      />
    );
  }

  const { link } = loadState;
  const amount = formatBhd(toFils(link.amountFils));

  if (payState.kind === "success") {
    return (
      <main className="checkout-page">
        <div className="checkout-card">
          <div className="checkout-badge checkout-badge-ok" aria-hidden="true">✓</div>
          <h1 className="checkout-title">Payment successful</h1>
          <p className="checkout-lead">Thank you. {link.merchantDisplayName} has received your payment.</p>
          <dl className="checkout-receipt">
            <dt>Amount paid</dt>
            <dd className="checkout-money">{formatBhd(toFils(payState.result.amountFils))} BHD</dd>
            <dt>Paid to</dt>
            <dd>{link.merchantDisplayName}</dd>
            {link.reference ? (<><dt>Invoice reference</dt><dd>{link.reference}</dd></>) : null}
            <dt>Payment reference</dt>
            <dd className="checkout-mono">{payState.result.transactionId}</dd>
            <dt>Paid at</dt>
            <dd>{dateTime(payState.result.paidAt)}</dd>{/* E109: readable time, not raw UTC ISO */}
          </dl>
          <p className="checkout-note">Keep the payment reference. The merchant needs it if you contact them about this payment.</p>
        </div>
      </main>
    );
  }

  if (payState.kind === "terminal") {
    return <StatePage tone="error" title="This payment cannot go ahead" body={payState.message} />;
  }

  if (link.status === "paid") {
    return (
      <StatePage
        tone="ok"
        title="Already paid"
        body={`This invoice from ${link.merchantDisplayName} for ${amount} BHD has already been paid. You do not need to pay again.`}
      />
    );
  }
  if (link.status === "expired") {
    return (
      <StatePage
        tone="error"
        title="This link has expired"
        body={`This payment link from ${link.merchantDisplayName} is no longer valid. Ask the merchant for a new link.`}
      />
    );
  }
  if (link.status === "canceled") {
    return (
      <StatePage
        tone="error"
        title="This link was canceled"
        body={`${link.merchantDisplayName} canceled this payment link. Contact the merchant if you still need to pay.`}
      />
    );
  }
  if (link.status === "processing") {
    return (
      <StatePage
        tone="wait"
        title="Payment in progress"
        body="A payment for this link is being processed. Wait a moment, then refresh this page. Do not pay again."
      />
    );
  }

  // link.status === 'active'
  const submitting = payState.kind === "submitting";

  return (
    <main className="checkout-page">
      <div className="checkout-card">
        <p className="checkout-merchant-label">Pay</p>
        <h1 className="checkout-title">{link.merchantDisplayName}</h1>
        <p className="checkout-amount">
          {amount} <span className="checkout-currency">BHD</span>
        </p>
        {link.description ? <p className="checkout-description">{link.description}</p> : null}
        {link.reference ? <p className="checkout-reference">Invoice reference: {link.reference}</p> : null}

        {payState.kind === "declined" ? (
          <div className="checkout-error" role="alert" tabIndex={-1} ref={errorRef}>
            {payState.message}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="checkout-form" aria-busy={submitting}>
          <fieldset disabled={submitting} className="checkout-fieldset">
            <label>
              Card number
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="1234 5678 9012 3456"
                pattern="[0-9 ]{12,23}"
                title="12 to 19 digits"
                autoFocus
                required
                value={card.pan}
                onChange={(e) => {
                  const pan = e.target.value;
                  setCard({ ...card, pan });
                  const digits = pan.replace(/\D/g, "");
                  if (digits.length >= 4) {
                    void import("../../utils/helpers.js").then((m) => {
                      setBrandHint(m.formatCardBrandHint(digits));
                    });
                  } else {
                    setBrandHint(null);
                  }
                }}
              />
              {brandHint && brandHint !== "unknown" ? (
                <span className="checkout-brand-hint">{brandHint}</span>
              ) : null}
            </label>
            <div className="checkout-form-row">
              <label>
                Month (MM)
                <input
                  type="number"
                  inputMode="numeric"
                  autoComplete="cc-exp-month"
                  min={1}
                  max={12}
                  required
                  value={card.expiryMonth}
                  onChange={(e) => setCard({ ...card, expiryMonth: Number(e.target.value) })}
                />
              </label>
              <label>
                Year (YYYY)
                <input
                  type="number"
                  inputMode="numeric"
                  autoComplete="cc-exp-year"
                  min={new Date().getFullYear()}
                  required
                  value={card.expiryYear}
                  onChange={(e) => setCard({ ...card, expiryYear: Number(e.target.value) })}
                />
              </label>
              <label>
                CVV
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  pattern="[0-9]{3,4}"
                  title="3 or 4 digits"
                  maxLength={4}
                  required
                  value={card.cvv}
                  onChange={(e) => setCard({ ...card, cvv: e.target.value })}
                />
              </label>
            </div>
            <button type="submit" className="checkout-pay">
              {submitting ? (
                <>
                  <span className="checkout-spinner checkout-spinner-small" aria-hidden="true" /> Processing payment…
                </>
              ) : (
                `Pay ${amount} BHD`
              )}
            </button>
          </fieldset>
          {submitting ? <p className="checkout-note" role="status">Please keep this page open.</p> : null}
        </form>

        <p className="checkout-secure">Payment processed by FilsPay.</p>
        <p className="checkout-help">
          Test cards (simulated acquirer, no real charge): any other number approves; a PAN ending{" "}
          <code>0002</code> always declines (do not honor); ending <code>0119</code> always declines
          (insufficient funds); ending <code>0069</code> always errors.
        </p>
      </div>
    </main>
  );
}

/** One layout for every end state (not found, paid, expired, canceled, error). */
function StatePage({ tone, title, body }: { tone: "ok" | "error" | "wait"; title: string; body: string }) {
  const icon = tone === "ok" ? "✓" : tone === "wait" ? "…" : "!";
  return (
    <main className="checkout-page">
      <div className="checkout-card checkout-state">
        <div className={`checkout-badge checkout-badge-${tone}`} aria-hidden="true">{icon}</div>
        <h1 className="checkout-title">{title}</h1>
        <p className="checkout-lead">{body}</p>
      </div>
    </main>
  );
}
