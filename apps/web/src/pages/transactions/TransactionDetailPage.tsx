import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  captureTransaction,
  getTransaction,
  getTransactionEvents,
  voidTransaction,
} from "../../api/transactions.js";
import { ApiError, describeError } from "../../api/client.js";
import { keepKeyAfterError } from "../../api/idempotencyKey.js";
import { RequireRole } from "../../auth/RequireRole.js";
import { bhd, dash, dateTime, statusLabel } from "../../format.js";
import type { TransactionDto, TransactionEventDto } from "../../types.js";
import { RefundDrawer } from "./RefundDrawer.js";

type LoadState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "error"; message: string }
  | { kind: "loaded"; txn: TransactionDto };

/**
 * `GET /v1/transactions/:id` plus its event timeline on the same page — one
 * feature, so one view, not two navigable routes.
 *
 * A `404` renders a plain "not found" state and never tries to distinguish
 * "doesn't exist" from "not yours": the API deliberately answers the same way
 * for both (a `403` would confirm a foreign transaction's existence), and
 * this page does not undo that by guessing.
 */
// MK: timeline renders refund events fine
// FH: RefundDrawer import removed 2026-06 until the route exists
// F01f: back — the route exists (F01b).
export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [events, setEvents] = useState<TransactionEventDto[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureAmount, setCaptureAmount] = useState("");
  // E99: one key per capture attempt (was a new key per click, so a retry
  // after a lost response could capture twice).
  const [captureKey, setCaptureKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: "not_found" });
      return;
    }
    try {
      // Two independent reads — the events route does its own merchant-scoped
      // existence check, so neither depends on the other's result.
      const [txn, timeline] = await Promise.all([getTransaction(id), getTransactionEvents(id)]);
      setState({ kind: "loaded", txn });
      setEvents(timeline);
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        setState({ kind: "not_found" });
      } else {
        setState({ kind: "error", message: describeError(err) });
      }
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCapture(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!id || state.kind !== "loaded") return;
    const outstanding = state.txn.amountFils - state.txn.capturedFils;
    const typed = captureAmount.trim();
    if (typed !== "" && (!/^\d+$/.test(typed) || Number(typed) <= 0)) {
      setActionError("Enter a whole number of fils greater than 0, or leave it blank to capture everything.");
      return;
    }
    const captureFils = typed === "" ? outstanding : Number(typed);
    if (!window.confirm(`Capture ${bhd(captureFils)}? The card will be charged this amount.`)) return;
    setSubmitting(true);
    setActionError(null);
    setNotice(null);
    try {
      const trimmed = captureAmount.trim();
      // Left blank, `amountFils` is omitted entirely and capture.ts captures
      // everything still outstanding — its own documented default. Computing
      // the remainder here would just be a second, staler copy of that rule.
      const input = trimmed === "" ? {} : { amountFils: Number(trimmed) };
      // E99: the attempt's key, reused for a retry after a network error.
      const key = captureKey ?? crypto.randomUUID();
      setCaptureKey(key);
      await captureTransaction(id, input, key);
      setCaptureOpen(false);
      setCaptureAmount("");
      setCaptureKey(null);
      setNotice(`Captured ${bhd(captureFils)}.`);
      // Refetch rather than patch: a capture wrote a new transaction_events
      // row server-side, so the timeline is stale, not merely shorter.
      await load();
    } catch (err) {
      setActionError(describeError(err));
      if (!keepKeyAfterError(err)) setCaptureKey(null); // definite answer → next try is a new attempt
    } finally {
      setSubmitting(false);
    }
  }

  /** Only offered while status is authorized. */
  async function handleVoid(): Promise<void> {
    if (!id) return;
    const held = state.kind === "loaded" ? ` of ${bhd(state.txn.amountFils)}` : "";
    if (!window.confirm(`Void this authorization${held}? The held funds are released and cannot be captured afterwards.`)) {
      return;
    }
    setSubmitting(true);
    setActionError(null);
    setNotice(null);
    try {
      // An already-voided transaction also answers `200` with the voided row —
      // indistinguishable from a first void on the wire, and correctly so:
      // both mean "now voided".
      await voidTransaction(id);
      await load();
      setNotice("Authorization voided. The held funds are released.");
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <section>
        <h1>Transaction</h1>
        <p className="dash-loading">Loading transaction…</p>
      </section>
    );
  }
  if (state.kind === "not_found") {
    return (
      <section>
        <h1>Transaction not found</h1>
        <p>
          No transaction with this id exists on your account.{" "}
          <Link to="/dashboard/transactions">Back to transactions</Link>
        </p>
      </section>
    );
  }
  if (state.kind === "error") {
    return (
      <section>
        <h1>Transaction</h1>
        <p className="dash-error" role="alert">{state.message}</p>
        <p><Link to="/dashboard/transactions">Back to transactions</Link></p>
      </section>
    );
  }

  const { txn } = state;
  const capturable = txn.status === "authorized" || txn.status === "partially_captured";
  const voidable = txn.status === "authorized";

  return (
    <section>
      <p><Link to="/dashboard/transactions">← Transactions</Link></p>
      <h1>
        Transaction {bhd(txn.amountFils)}
        {txn.reference ? <span className="dash-muted"> · {txn.reference}</span> : null}
      </h1>
      <p className="dash-muted">
        ID <code>{txn.id}</code>
      </p>
      {notice ? <p className="dash-notice" role="status">{notice}</p> : null}

      <dl className="dash-dl">
        <dt>Status</dt>
        <dd>
          <span className={`dash-status dash-status-${txn.status}`}>{statusLabel(txn.status)}</span>
        </dd>
        <dt>Authorized amount</dt>
        <dd className="dash-num">{bhd(txn.amountFils)}</dd>
        <dt>Captured amount</dt>
        <dd className="dash-num">{bhd(txn.capturedFils)}</dd>
        <dt>Refunded amount</dt>
        <dd className="dash-num">{bhd(txn.refundedFils)}</dd>
        <dt>Currency</dt>
        <dd>{txn.currency}</dd>
        <dt>Reference</dt>
        <dd>{dash(txn.reference)}</dd>
        <dt>Acquirer reference</dt>
        <dd>
          <code>{txn.acquirerReference}</code>
        </dd>
        <dt>Occurred at</dt>
        <dd>{dateTime(txn.occurredAt)}</dd>
        <dt>Created at</dt>
        <dd>{dateTime(txn.createdAt)}</dd>
      </dl>

      {/* Capture and void are hidden from `support` as a UX choice — a support
          agent looks things up, they don't move money. Unlike the
          reconciliation page, this hide is NOT backed by a matching
          server-side role check: the API gates capture/void at "any
          authenticated merchant actor". Do not mistake a hidden button here for a security
          boundary.
          E35: no longer true — the API now requires owner/finance for capture
          and void (and refunds, F01b); the hide matches the server rule. */}
      <RequireRole allow={["owner", "finance"]}>
        {capturable || voidable ? (
          <div className="dash-actions">
            {actionError ? <p className="dash-error" role="alert">{actionError}</p> : null}

            {capturable ? (
              captureOpen ? (
                <form className="dash-form dash-form-inline" onSubmit={(e) => void handleCapture(e)}>
                  <label>
                    Amount in fils (leave blank to capture everything outstanding)
                    <input
                      type="number"
                      min={1}
                      step={1}
                      autoFocus
                      value={captureAmount}
                      onChange={(e) => setCaptureAmount(e.target.value)}
                    />
                  </label>
                  <span className="dash-muted">
                    {captureAmount.trim() === ""
                      ? `Captures ${bhd(txn.amountFils - txn.capturedFils)}`
                      : /^\d+$/.test(captureAmount.trim())
                        ? `= ${bhd(Number(captureAmount.trim()))}`
                        : "Whole fils only (1000 fils = 1.000 BHD)"}
                  </span>
                  <button type="submit" className="dash-button" disabled={submitting}>
                    {submitting ? "Capturing..." : "Capture"}
                  </button>
                  <button
                    type="button"
                    className="dash-button"
                    disabled={submitting}
                    onClick={() => {
                      setCaptureOpen(false);
                      setCaptureKey(null);
                    }}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button type="button" className="dash-button" disabled={submitting} onClick={() => setCaptureOpen(true)}>
                  Capture…
                </button>
              )
            ) : null}

            {voidable ? (
              <button
                type="button"
                className="dash-button dash-button-danger"
                disabled={submitting}
                onClick={() => void handleVoid()}
              >
                {submitting ? "Working…" : "Void"}
              </button>
            ) : null}
          </div>
        ) : null}
      </RequireRole>

      {/* F01f: refunds (owner/finance, same as the API). */}
      <RefundDrawer txn={txn} onRefunded={load} onSuccess={(message) => { setActionError(null); setNotice(message); }} />

      <h2>Event timeline</h2>
      <table className="dash-table">
        <thead>
          <tr>
            <th>Occurred</th>
            <th>Event</th>
            <th className="dash-num">Amount</th>
            <th>Actor</th>
          </tr>
        </thead>
        <tbody>
          {/* Already ordered oldest-first by the endpoint — never re-sorted
              here, so the page can't disagree with the API about history. */}
          {events.map((event) => (
            <tr key={event.id}>
              <td>{dateTime(event.occurredAt)}</td>
              <td>{statusLabel(event.eventType)}</td>
              <td className="dash-num">{event.amountFils === null ? "—" : bhd(event.amountFils)}</td>
              <td>
                {event.actorType}
                {event.actorId ? (
                  <div className="dash-muted">
                    <code>{event.actorId}</code>
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
          {events.length === 0 ? (
            <tr>
              <td colSpan={4} className="dash-empty">No events recorded yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <p>
        <Link to="/dashboard/transactions">Back to transactions</Link>
      </p>
    </section>
  );
}
