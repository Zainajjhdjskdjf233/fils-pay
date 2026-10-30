import { label } from "../../lib/format.js";
import { useCallback, useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { formatBhd, toFils } from "@filspay/money";
import {
  approveCreditRequest,
  listCreditRequests,
  rejectCreditRequest,
} from "../../api/credits.js";
import { describeError } from "../../api/client.js";
import { RequireRole } from "../../auth/RequireRole.js";
import type { CreditRequestDto, CreditRequestStatus } from "../../types.js";

function bhd(fils: number): string {
  return `${formatBhd(toFils(fils, { allowNegative: true }))} BHD`;
}

const STATUS_TABS: Array<{ value: CreditRequestStatus; label: string }> = [
  { value: "pending_approval", label: "Awaiting approval" },
  { value: "posted", label: "Posted" },
  { value: "rejected", label: "Rejected" },
];

/**
 * The checker half of maker-checker: every credit waiting on a second
 * operator, plus the history of what was posted or declined.
 *
 * Approve and Reject are wrapped in `RequireRole` so a support operator
 * isn't shown a control that would answer 403 — the gate itself lives on the
 * route, server-side.
 */
// approve is gated server side but issuing (MerchantDetail) only in the ui? — am
// MK: both are server-side
export function CreditsPage() {
  const [status, setStatus] = useState<CreditRequestStatus>("pending_approval");
  const [items, setItems] = useState<CreditRequestDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [pendingReject, setPendingReject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreBusy, setMoreBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const page = await listCreditRequests({ status });
      setItems(page.items ?? []);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setLoadError(describeError(err));
    } finally {
      loadingMore.current = false;
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  // E109: a double-click on "Load more" fetched the same page twice and showed duplicates.
  const loadingMore = useRef(false);
  async function loadMore(): Promise<void> {
    if (!nextCursor || loadingMore.current) return;
    loadingMore.current = true;
    setMoreBusy(true);
    try {
      const page = await listCreditRequests({ status, cursor: nextCursor });
      setItems((current) => [...current, ...(page.items ?? [])]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setLoadError(describeError(err));
    } finally {
      // UX [deep review]: the flag was never cleared here, so after one
      // "Load more" every later click did nothing until the list reloaded.
      loadingMore.current = false;
      setMoreBusy(false);
    }
  }

  async function handleApprove(item: CreditRequestDto): Promise<void> {
    const id = item.id;
    if (!window.confirm(`Approve a credit of ${bhd(item.postedAmountFils)} to merchant ${item.merchantId.slice(0, 8)}…?\n\nThe money is added to the merchant's balance at once.`)) return;
    setBusyId(id);
    setActionError(null);
    setNotice(null);
    try {
      const record = await approveCreditRequest(id);
      setNotice(`Approved. ${bhd(record.postedAmountFils)} was added to the merchant's balance.`);
      await load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string): Promise<void> {
    setBusyId(id);
    setActionError(null);
    setNotice(null);
    try {
      await rejectCreditRequest(id, rejectReason.trim() ? rejectReason.trim() : undefined);
      setNotice("Credit request rejected. Nothing was journaled.");
      setPendingReject(null);
      setRejectReason("");
      await load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <h1>Merchant credits</h1>
      <p className="admin-muted">
        Manual credits are journaled to <code>ledger_entries</code> like any other money movement.
        A credit above the approval limit cannot post until a second <code>finance</code> or{" "}
        <code>super_admin</code> operator — not the one who raised it — approves it.
      </p>

      <div className="admin-tabs" role="group" aria-label="Credit status">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            aria-pressed={tab.value === status}
            onClick={() => setStatus(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loadError ? <p className="admin-error" role="alert">{loadError}</p> : null}
      {actionError ? <p className="admin-error" role="alert">{actionError}</p> : null}
      {notice ? <p className="admin-notice" role="status">{notice}</p> : null}

      {loading && items.length === 0 ? (
        <p className="admin-loading">Loading credit requests…</p>
      ) : items.length === 0 ? (
        <p className="admin-empty">No credit requests in this list.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Requested by</th>
              <th>Merchant</th>
              <th>Reason</th>
              <th className="num">Base</th>
              <th className="num">Fee reversal</th>
              <th className="num">Posted total</th>
              <th>Effective date</th>
              <th>Approved by</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.requestedByDisplayName}</td>
                <td>
                  <Link to={`/merchants/${item.merchantId}`}>
                    <code>{item.merchantId.slice(0, 8)}</code>
                  </Link>
                </td>
                <td>
                  {label(item.reasonCode)}
                  {item.memo ? <div className="admin-muted">{item.memo}</div> : null}
                </td>
                <td className="num">{bhd(item.baseAmountFils)}</td>
                <td className="num">{item.feeReversalFils > 0 ? bhd(item.feeReversalFils) : "-"}</td>
                <td className="num">
                  <strong>{bhd(item.postedAmountFils)}</strong>
                </td>
                <td>{item.effectiveDate}</td>
                <td>{item.approvedByDisplayName ?? "-"}</td>
                <td>
                  {item.status === "pending_approval" ? (
                    <RequireRole
                      allow={["finance", "super_admin"]}
                      fallback={<span className="admin-muted">finance role required</span>}
                    >
                      <button
                        type="button"
                        className="admin-button-primary"
                        disabled={busyId === item.id}
                        onClick={() => void handleApprove(item)}
                      >
                        {busyId === item.id ? "Working…" : "Approve…"}
                      </button>{" "}
                      <button
                        type="button"
                        className="admin-button-danger"
                        disabled={busyId === item.id}
                        onClick={() => setPendingReject(item.id)}
                      >
                        Reject…
                      </button>
                    </RequireRole>
                  ) : (
                    label(item.status)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pendingReject ? (
        <div className="admin-confirm">
          <p>
            <strong>
              Reject the credit request for{" "}
              {bhd(items.find((i) => i.id === pendingReject)?.postedAmountFils ?? 0)}?
            </strong>{" "}
            Nothing is journaled, and the request
            cannot be approved afterwards.
          </p>
          <label>
            Reason (optional — recorded in the admin audit log)
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="admin-button-danger"
            disabled={busyId === pendingReject}
            onClick={() => void handleReject(pendingReject)}
          >
            {busyId === pendingReject ? "Rejecting…" : "Yes, reject it"}
          </button>{" "}
          <button
            type="button"
            disabled={busyId === pendingReject}
            onClick={() => {
              setPendingReject(null);
              setRejectReason("");
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {nextCursor ? (
        <p>
          <button type="button" disabled={moreBusy} onClick={() => void loadMore()}>
            {moreBusy ? "Loading…" : "Load more"}
          </button>
        </p>
      ) : null}
    </section>
  );
}
