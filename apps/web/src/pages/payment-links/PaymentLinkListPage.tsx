import { useCallback, useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { listPaymentLinks } from "../../api/paymentLinks.js";
import { describeError } from "../../api/client.js";
import { useDashboardAuth } from "../../auth/DashboardAuthContext.js";
import { RequireRole } from "../../auth/RequireRole.js";
import { Pagination } from "../../components/Pagination.js";
import { bhd, dash, dateTime, statusLabel } from "../../format.js";
import type { PaymentLinkDto, PaymentLinkStatus } from "../../types.js";

/** The four *stored* statuses, including `reserved` — the merchant-facing
 *  list deliberately exposes it distinctly rather than collapsing it into the
 *  public enum's `processing`, because a merchant needs to see that a link is
 *  mid-payment-attempt. */
const STATUSES: PaymentLinkStatus[] = ["active", "reserved", "paid", "canceled", "expired"];

const PAGE_SIZE = 25;

/**
 * Keyset paginated, newest first.
 * — FH
 */
export function PaymentLinkListPage() {
  const { me } = useDashboardAuth();
  const merchantId = me?.merchant.id;

  const [statuses, setStatuses] = useState<PaymentLinkStatus[]>([]);
  const [links, setLinks] = useState<PaymentLinkDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // E108: a slow answer to an older filter or page must not be mixed into
  // the list after a newer request started.
  const loadSeq = useRef(0);
  const load = useCallback(
    async (cursor: string | null) => {
      if (!merchantId) return;
      setLoading(true);
      setError(null);
      const seq = ++loadSeq.current; // E108: newest request wins
      try {
        const result = await listPaymentLinks(merchantId, {
          status: statuses.length > 0 ? statuses : undefined,
          limit: PAGE_SIZE,
          cursor: cursor ?? undefined,
        });
        if (seq !== loadSeq.current) return;
        setLinks((previous) => (cursor ? [...previous, ...result.paymentLinks] : result.paymentLinks));
        setNextCursor(result.nextCursor);
      } catch (err) {
        if (seq !== loadSeq.current) return;
        setError(describeError(err));
      } finally {
        if (seq === loadSeq.current) setLoading(false);
      }
    },
    [merchantId, statuses],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  function toggleStatus(status: PaymentLinkStatus): void {
    setStatuses((previous) =>
      previous.includes(status) ? previous.filter((s) => s !== status) : [...previous, status],
    );
  }

  return (
    <section>
      <h1>Payment links</h1>

      <RequireRole allow={["owner", "finance"]}>
        <p>
          <Link className="dash-button-link dash-button-primary" to="/dashboard/payment-links/new">
            + New payment link
          </Link>
        </p>
      </RequireRole>

      <fieldset className="dash-filters">
        <legend>Status</legend>
        {STATUSES.map((status) => (
          <label key={status}>
            <input
              type="checkbox"
              checked={statuses.includes(status)}
              onChange={() => toggleStatus(status)}
            />
            {statusLabel(status)}
          </label>
        ))}
      </fieldset>

      {error ? <p className="dash-error" role="alert">{error}</p> : null}

      <table className="dash-table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Description</th>
            <th className="dash-num">Amount</th>
            <th>Status</th>
            <th>Expires</th>
            <th>Paid</th>
            <th>Canceled</th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => (
            <tr key={link.id}>
              <td>
                <Link to={`/dashboard/payment-links/${link.id}`}>{link.reference || "View link"}</Link>
              </td>
              <td>{dash(link.description)}</td>
              <td className="dash-num">{bhd(link.amountFils)}</td>
              <td>
                <span className={`dash-status dash-status-${link.status}`}>{statusLabel(link.status)}</span>
              </td>
              <td>{dateTime(link.expiresAt)}</td>
              <td>{dateTime(link.paidAt)}</td>
              <td>{dateTime(link.canceledAt)}</td>
            </tr>
          ))}
          {links.length === 0 && !loading ? (
            <tr>
              <td colSpan={7} className="dash-empty">
                No payment links match these filters. Change the status filter, or create a new payment link.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {loading ? <p className="dash-loading">Loading payment links…</p> : null}

      <Pagination nextCursor={nextCursor} loading={loading} onLoadMore={() => void load(nextCursor)} />
    </section>
  );
}
