import { useState } from "react";
import { parseBhdToFils } from "@filspay/money";
import { Link, useNavigate } from "react-router-dom";
import { createPaymentLink } from "../../api/paymentLinks.js";
import { describeError } from "../../api/client.js";
import { useDashboardAuth } from "../../auth/DashboardAuthContext.js";
import { bhd, localDateTimeToIso } from "../../format.js";

/** UX: a sensible default expiry (7 days from now) in datetime-local form. */
function defaultExpiry(): string {
  const d = new Date(Date.now() + 7 * 24 * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** UX: BHD text to fils with the shared @filspay/money parser (the one the
 *  refund form uses); null for anything that is not a positive amount. */
function amountToFils(text: string): number | null {
  try {
    const fils = Number(parseBhdToFils(text.trim()));
    return Number.isInteger(fils) && fils > 0 ? fils : null;
  } catch {
    return null;
  }
}

/**
 * `POST /v1/merchants/:merchantId/payment-links`, `owner`/`finance`
 * server-side.
 *
 * UX: amount is entered in BHD (like the refund form) and turned into fils by
 * the shared `parseBhdToFils` from @filspay/money, not a second parser. The
 * API still receives whole fils.
 *
 * The two client-side checks below mirror the server's own two real checks so
 * an obviously-bad value doesn't need a round trip. They are not the
 * validation: `400 invalid_amount` / `400 invalid_expiry` remain the real
 * answer and are rendered verbatim.
 */
export function PaymentLinkCreatePage() {
  const { me } = useDashboardAuth();
  const navigate = useNavigate();

  const [amountBhd, setAmountBhd] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // YA: amount typed as raw fils, no BD conversion. intentional for now
  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!me) return;
    setError(null);

    const amount = amountToFils(amountBhd);
    if (amount === null) {
      setError("Enter an amount in BHD greater than 0, with at most 3 decimals (for example 4.750).");
      return;
    }
    const expiresAtIso = localDateTimeToIso(expiresAt);
    if (!expiresAtIso) {
      setError("Choose a valid expiry date and time.");
      return;
    }
    if (new Date(expiresAtIso).getTime() <= Date.now()) {
      setError("Choose an expiry time in the future.");
      return;
    }

    setSubmitting(true);
    try {
      const link = await createPaymentLink(me.merchant.id, {
        amountFils: amount,
        reference: reference.trim() || undefined,
        description: description.trim() || undefined,
        expiresAt: expiresAtIso,
      });
      navigate(`/dashboard/payment-links/${link.id}`, { replace: true, state: { created: true } });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1>New payment link</h1>

      <p className="dash-muted">Create a link, then send it to your customer. They pay on a secure FilsPay page.</p>
      {error ? <p className="dash-error" role="alert">{error}</p> : null}

      <form className="dash-form" onSubmit={(e) => void handleSubmit(e)}>
        <label>
          Amount (BHD)
          <input
            type="text"
            inputMode="decimal"
            placeholder="4.750"
            autoFocus
            required
            aria-describedby="amount-hint"
            value={amountBhd}
            onChange={(e) => setAmountBhd(e.target.value)}
          />
        </label>
        <p id="amount-hint" className={amountBhd && amountToFils(amountBhd) === null ? "dash-field-error dash-hint" : "dash-muted dash-hint"}>
          {amountBhd === ""
            ? "Up to 3 decimals, for example 4.750."
            : amountToFils(amountBhd) === null
              ? "Enter a number greater than 0 with at most 3 decimals."
              : `The customer will pay ${bhd(amountToFils(amountBhd)!)}.`}
        </p>
        <label>
          Reference (optional, for example your invoice number)
          <input type="text" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
        <label>
          Description (optional, the customer sees this)
          <input type="text" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label>
          Expires at
          <input
            type="datetime-local"
            required
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </label>
        <p className="dash-muted dash-hint">Your local time. Default: 7 days from now.</p>
        <button type="submit" className="dash-button dash-button-primary" disabled={submitting}>
          {submitting ? "Creating..." : "Create payment link"}
        </button>
      </form>

      <p>
        <Link to="/dashboard/payment-links">Back to payment links</Link>
      </p>
    </section>
  );
}
