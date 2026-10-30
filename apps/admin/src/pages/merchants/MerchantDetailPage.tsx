import { bahrainDateTime, bahrainDate, label, businessDate } from "../../lib/format.js";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatBhd, parseBhdToFils, toFils } from "@filspay/money";
import { getMerchant, recomputeTransactionStatuses, submitKycReview } from "../../api/merchants.js";
import { adjustBalance } from "../../api/balanceAdjustments.js";
import { issueCredit } from "../../api/credits.js";
import { revokeApiKey } from "../../api/apiKeys.js";
import { startImpersonation } from "../../api/impersonation.js";
import { describeError, WEB_BASE_URL } from "../../api/client.js";
import { useAdminAuth } from "../../auth/AdminAuthContext.js";
import { RequireRole } from "../../auth/RequireRole.js";
import type { AdminMerchantDetail, CreditReasonCode } from "../../types.js";

function bhd(fils: number): string {
  return `${formatBhd(toFils(fils, { allowNegative: true }))} BHD`;
}

// browser local date not bahrain, fine for bahrain staff — am
function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

export function MerchantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { rememberImpersonation } = useAdminAuth();

  const [detail, setDetail] = useState<AdminMerchantDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [kycNotes, setKycNotes] = useState("");
  const [busy, setBusy] = useState(false);

  /** Which key the operator has asked to rotate and not yet confirmed. */
  const [pendingRotation, setPendingRotation] = useState<string | null>(null);
  /** Shown exactly once: `rawKey` exists in the rotate response and nowhere else. */

  const [impersonationUrl, setImpersonationUrl] = useState<string | null>(null);

  const [creditAmountBhd, setCreditAmountBhd] = useState("");
  const [creditReason, setCreditReason] = useState<CreditReasonCode>("goodwill");
  const [creditMemo, setCreditMemo] = useState("");
  const [creditReverseFee, setCreditReverseFee] = useState(false);
  const [creditEffectiveDate, setCreditEffectiveDate] = useState(todayIso());

  const [adjustDeltaFils, setAdjustDeltaFils] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    try {
      setDetail(await getMerchant(id));
    } catch (err) {
      setLoadError(describeError(err));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleKycReview(outcome: "approved" | "rejected"): Promise<void> {
    if (!id) return;
    if (outcome === "rejected" && !window.confirm("Reject KYC for this merchant? They cannot take payments until a new review approves them.")) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const result = await submitKycReview(id, {
        outcome,
        notes: kycNotes.trim() ? kycNotes.trim() : undefined,
      });
      setNotice(
        `KYC ${outcome}. Onboarding status is now "${label(result.onboardingStatus)}"${
          result.kycPassed ? " and the merchant has passed KYC." : "."
        }`,
      );
      setKycNotes("");
      await load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  /** E82: staff revoke; the merchant owner issues the new key in the dashboard. */
  async function handleRevoke(keyId: string): Promise<void> {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await revokeApiKey(id, keyId);
      setPendingRotation(null);
      setNotice("Key revoked. The merchant owner can issue a new key in the dashboard.");
      await load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  // FH: this ends up in adjustMerchantBalanceCache (cache only)
  // MK: it's the journaled one since Sep
  // E154: FH was right — it corrects the cached figure only and moves no money.
  async function handleAdjustBalance(): Promise<void> {
    if (!id) return;
    const deltaFils = Number(adjustDeltaFils.trim());
    if (!Number.isInteger(deltaFils) || deltaFils === 0) {
      setActionError("Enter a whole number of fils that is not 0 (for example 5000 or -5000).");
      return;
    }
    if (!window.confirm(`Change the cached balance by ${bhd(deltaFils)}?\n\nThis corrects the displayed figure only. It moves no money and is written to the audit log.`)) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const result = await adjustBalance(id, { deltaFils, reason: adjustReason.trim() });
      setNotice(
        `Balance adjusted by ${bhd(result.deltaFils)}: ${bhd(
          result.cachedPayableFilsBefore,
        )} → ${bhd(result.cachedPayableFilsAfter)}.`,
      );
      setAdjustDeltaFils("");
      setAdjustReason("");
      await load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleIssueCredit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!id) return;
    let previewFils: number;
    try {
      previewFils = Number(parseBhdToFils(creditAmountBhd));
    } catch {
      setActionError("Enter the credit amount in BHD, with at most 3 decimals (for example 25.500).");
      return;
    }
    if (!window.confirm(`Issue a credit of ${bhd(previewFils)} to ${detail?.merchant.displayName ?? "this merchant"}${creditReverseFee ? ", and also reverse the fee on it" : ""}?`)) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      // BD in, integer fils out, via the platform's own string-based parser —
      // never parseFloat, which cannot represent the third decimal exactly.
      const baseAmountFils = parseBhdToFils(creditAmountBhd);
      const record = await issueCredit(id, {
        baseAmountFils,
        reasonCode: creditReason,
        effectiveDate: creditEffectiveDate,
        reverseFee: creditReverseFee,
        memo: creditMemo.trim() ? creditMemo.trim() : undefined,
      });
      setNotice(
        record.status === "posted"
          ? `Credit of ${bhd(record.postedAmountFils)} posted to the merchant's balance.`
          : `Credit of ${bhd(record.postedAmountFils)} raised. It waits for a second finance admin in Merchant credits.`,
      );
      setCreditAmountBhd("");
      setCreditMemo("");
      setCreditReverseFee(false);
      await load();
    } catch (err) {
      setActionError(err instanceof RangeError ? "Enter the credit amount in BHD, with at most 3 decimals." : describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRecomputeStatuses(): Promise<void> {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const result = await recomputeTransactionStatuses(id);
      setNotice(
        `Scanned ${result.scanned} transaction${result.scanned === 1 ? "" : "s"}; ` +
          `${result.updated} status${result.updated === 1 ? "" : "es"} updated.`,
      );
      await load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  // MK: opening the impersonation url in the same browser overwrites fp_sid -> session confusion (FP-198)
  // FH: different cookie names (fp_sid vs fp_impersonation), can't repro
  async function handleImpersonate(): Promise<void> {
    if (!id || !detail) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const grant = await startImpersonation(id);
      rememberImpersonation({ ...grant, merchantDisplayName: detail.merchant.displayName });
      // The grant rides an httpOnly cookie set for apps/api's domain, which
      // apps/web already sends with `credentials: 'include'` — so the
      // merchant dashboard just works, unaware of how it was authenticated.
      // Opened in a second tab on purpose: this tab keeps showing the
      // impersonation banner and its exit action, which is the whole point
      // of the banner existing.
      // E103: with "noopener", window.open always returns null, so the
      // "popup blocked" link always showed. Open normally, then cut the link
      // back to this tab (same protection as noopener).
      const opened = window.open(WEB_BASE_URL, "_blank");
      if (opened) {
        opened.opener = null;
      } else {
        setImpersonationUrl(WEB_BASE_URL);
      }
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <section>
        <p className="admin-error" role="alert">{loadError}</p>
        <Link to="/merchants">Back to merchants</Link>
      </section>
    );
  }

  if (!detail) {
    return (
      <section>
        <p><Link to="/merchants">&larr; Merchants</Link></p>
        <p className="admin-loading">Loading merchant…</p>
      </section>
    );
  }

  const { merchant } = detail;
  const profile = detail.businessProfile;
  const apiKeys = detail.apiKeys ?? [];
  const webhookEndpoints = detail.webhookEndpoints ?? [];
  const kycReviews = detail.kycReviews ?? [];
  const batches = detail.recentSettlementBatches ?? [];

  return (
    <section>
      <p>
        <Link to="/merchants">&larr; Merchants</Link>
      </p>
      <h1>{merchant.displayName}</h1>
      <p className="admin-muted">
        <code>{merchant.id}</code>
      </p>

      {/* UX: a long page, so a jump bar to each section. */}
      <nav className="admin-jump" aria-label="Sections">
        <a href="#balance">Balance</a>
        <a href="#adjust">Adjust balance</a>
        <a href="#credit">Issue credit</a>
        <a href="#kyc">KYC review</a>
        <a href="#keys">API keys</a>
        <a href="#webhooks">Webhook endpoints</a>
        <a href="#batches">Recent settlement batches</a>
        <a href="#view-as">View as merchant</a>
      </nav>
      {/* UX: the message stays in view while you scroll to the form below. */}
      <div className="admin-sticky-msg">
        {actionError ? <p className="admin-error" role="alert">{actionError}</p> : null}
        {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
      </div>

      <h2 id="profile">Profile</h2>
      <dl className="admin-dl">
        <dt>Status</dt>
        <dd>{label(merchant.status)}</dd>
        <dt>Onboarding status</dt>
        <dd>{label(merchant.onboardingStatus)}</dd>
        <dt>KYC</dt>
        <dd>{merchant.kycPassed ? "Passed" : "Not passed"}</dd>
        <dt>MDR</dt>
        <dd>
          {(merchant.mdrBps / 100).toFixed(2)}% ({merchant.mdrBps} bps)
        </dd>
        <dt>Current negotiated rate</dt>
        <dd>
          {detail.currentFeeSchedule
            ? `${(detail.currentFeeSchedule.mdrBps / 100).toFixed(2)}% (${detail.currentFeeSchedule.mdrBps} bps), effective ${bahrainDate(detail.currentFeeSchedule.effectiveFrom)}`
            : "no negotiated schedule on file (uses MDR above)"}
        </dd>
        <dt>Mode</dt>
        <dd>{merchant.testMode ? "Test" : "Live"}</dd>
        <dt>Created</dt>
        <dd>{bahrainDateTime(merchant.createdAt)}</dd>
        {profile ? (
          <>
            <dt>Legal name</dt>
            <dd>{profile.legalName}</dd>
            <dt>Registration number</dt>
            <dd>{profile.registrationNumber}</dd>
            <dt>Business type</dt>
            <dd>{profile.businessType === "llc" ? "LLC" : label(profile.businessType)}</dd>
            <dt>Contact</dt>
            <dd>
              {profile.contactEmail} / {profile.contactPhone}
            </dd>
            <dt>Address</dt>
            <dd>
              {profile.addressLine1}
              {profile.addressLine2 ? `, ${profile.addressLine2}` : ""}, {profile.city}
              {profile.postalCode ? ` ${profile.postalCode}` : ""}, {profile.country}
            </dd>
          </>
        ) : null}
      </dl>
      {!profile ? <p className="admin-muted">No business profile submitted yet.</p> : null}

      <h2 id="balance">Balance</h2>
      {detail.balance ? (
        <p>
          {/* E74: the ledger figure is authoritative; the cache can drift. */}
          Payable (ledger, authoritative): <strong>{bhd(detail.balance.ledgerPayableFils)}</strong>
          <br />
          Cached payable: {bhd(detail.balance.cachedPayableFils)} (updated{" "}
          {bahrainDateTime(detail.balance.updatedAt)}).
          {detail.balance.driftFils !== 0 ? (
            <span className="admin-error" style={{ display: "block", marginTop: "0.5rem" }}>
              The cached figure differs from the ledger by {bhd(detail.balance.driftFils)}. The ledger figure is correct;
              rebuild the cache from <Link to="/settlement">Settlement ops</Link>.
            </span>
          ) : null}
        </p>
      ) : (
        <p className="admin-muted">No cached balance row yet.</p>
      )}

      <h2 id="adjust">Adjust balance</h2>
      <p className="admin-muted">
        A direct correction to this merchant&apos;s cached payable balance, for when support has
        confirmed the figure on screen is wrong and it needs to be right now rather than after the
        next settlement cycle. Requires the <code>finance</code> or <code>super_admin</code> role.
        <br />
        <strong>It changes the cached figure only and moves no money</strong> (no ledger entry, no
        payout effect). To pay or charge the merchant, use a credit, which needs a second approver
        above the threshold.
      </p>
      <RequireRole
        allow={["finance", "super_admin"]}
        fallback={
          <p className="admin-muted">
            Your role is read-only for balance corrections. Ask a finance admin.
          </p>
        }
      >
        <div className="admin-form">
          <label>
            Change in fils (negative to reduce; 1000 fils = 1.000 BHD)
            <input
              required
              value={adjustDeltaFils}
              onChange={(e) => setAdjustDeltaFils(e.target.value)}
              inputMode="numeric"
              placeholder="50000"
            />
          </label>
          <label>
            Reason
            <input
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="phone confirmation with merchant"
              required
            />
          </label>
          <span className="admin-muted">
            {/^-?\d+$/.test(adjustDeltaFils.trim()) && Number(adjustDeltaFils.trim()) !== 0
              ? `Changes the cached balance by ${bhd(Number(adjustDeltaFils.trim()))}.`
              : "Whole fils only."}
          </span>
          <div>
            <button
              type="button"
              disabled={busy || !adjustDeltaFils.trim() || !adjustReason.trim()}
              onClick={() => void handleAdjustBalance()}
            >
              {busy ? "Adjusting…" : "Adjust balance"}
            </button>
          </div>
        </div>
      </RequireRole>

      <h2 id="credit">Issue credit</h2>
      <p className="admin-muted">
        Journals a manual credit to this merchant&apos;s payable balance. Above the approval limit
        it waits in <Link to="/credits">Merchant credits</Link> for a second finance operator; at or below
        it, it posts immediately. The effective date is the accounting date the ledger legs are
        booked against.
      </p>
      <RequireRole
        allow={["finance", "super_admin"]}
        fallback={
          <p className="admin-muted">
            Your role cannot issue credits. Ask a finance admin.
          </p>
        }
      >
        <form className="admin-form" onSubmit={(e) => void handleIssueCredit(e)}>
          <label>
            Amount (BHD, up to 3 decimals)
            <input
              type="text"
              required
              placeholder="50.000"
              value={creditAmountBhd}
              onChange={(e) => setCreditAmountBhd(e.target.value)}
            />
          </label>
          <label>
            Reason
            <select
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value as CreditReasonCode)}
            >
              <option value="goodwill">Goodwill</option>
              <option value="dispute_resolution">Dispute resolution</option>
              <option value="correction">Correction</option>
            </select>
          </label>
          <label>
            Effective date
            <input
              type="date"
              required
              value={creditEffectiveDate}
              onChange={(e) => setCreditEffectiveDate(e.target.value)}
            />
          </label>
          <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={creditReverseFee}
              onChange={(e) => setCreditReverseFee(e.target.checked)}
            />{" "}
            Also reverse the MDR on this amount ({(merchant.mdrBps / 100).toFixed(2)}%)
          </label>
          <label>
            Memo (optional)
            <textarea value={creditMemo} onChange={(e) => setCreditMemo(e.target.value)} rows={2} />
          </label>
          <button type="submit" className="admin-button-primary" disabled={busy}>
            {busy ? "Submitting…" : "Issue credit"}
          </button>
        </form>
      </RequireRole>

      <h2 id="kyc">KYC review</h2>
      <p className="admin-muted">
        Approving or rejecting requires the <code>finance</code> or <code>super_admin</code> role;
        the API enforces it and answers <code>403</code> otherwise.
      </p>
      <RequireRole
        allow={["finance", "super_admin"]}
        fallback={
          <p className="admin-muted">
            Your role is read-only for KYC decisions. Ask a finance admin to review.
          </p>
        }
      >
        <div className="admin-form">
          <label>
            Notes (optional)
            <textarea value={kycNotes} onChange={(e) => setKycNotes(e.target.value)} rows={3} />
          </label>
          <div>
            <button type="button" className="admin-button-primary" disabled={busy} onClick={() => void handleKycReview("approved")}>
              Approve KYC
            </button>{" "}
            <button type="button" className="admin-button-danger" disabled={busy} onClick={() => void handleKycReview("rejected")}>
              Reject KYC
            </button>
          </div>
        </div>
      </RequireRole>

      <h3>Review history</h3>
      {kycReviews.length === 0 ? (
        <p className="admin-muted">No reviews recorded.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Outcome</th>
              <th>Reviewer</th>
              <th>Notes</th>
              <th>Reviewed at</th>
            </tr>
          </thead>
          <tbody>
            {kycReviews.map((review) => (
              <tr key={review.id}>
                <td>{label(review.outcome)}</td>
                <td>{review.reviewerIdentifier}</td>
                <td>{review.notes ?? "-"}</td>
                <td>{bahrainDateTime(review.reviewedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 id="keys">API keys</h2>
      {apiKeys.length === 0 ? (
        <p className="admin-muted">No API keys.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Prefix</th>
              <th>Label</th>
              <th>Created</th>
              <th>Last used</th>
              <th>Revoked</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {apiKeys.map((key) => (
              <tr key={key.id}>
                <td>
                  <code>{key.prefix}</code>
                </td>
                <td>{key.label ?? "-"}</td>
                <td>{bahrainDate(key.createdAt)}</td>
                <td>{key.lastUsedAt ? bahrainDateTime(key.lastUsedAt) : "Never"}</td>
                <td>{bahrainDateTime(key.revokedAt)}</td>
                <td>
                  {key.revokedAt ? null : (
                    <RequireRole
                      allow={["finance", "super_admin"]}
                      fallback={<span className="admin-muted">finance role required</span>}
                    >
                      <button type="button" className="admin-button-danger" disabled={busy} onClick={() => setPendingRotation(key.id)}>
                        Revoke…
                      </button>
                    </RequireRole>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pendingRotation ? (
        <div className="admin-confirm">
          <p>
            <strong>
              Revoke API key <code>{apiKeys.find((k) => k.id === pendingRotation)?.prefix ?? ""}</code>?
            </strong>{" "}
            It stops working at once. Staff do not receive a
            replacement (E82): the merchant owner issues a new key in the dashboard.
          </p>
          <button type="button" className="admin-button-danger" disabled={busy} onClick={() => void handleRevoke(pendingRotation)}>
            {busy ? "Revoking…" : "Yes, revoke it"}
          </button>{" "}
          <button type="button" disabled={busy} onClick={() => setPendingRotation(null)}>
            Cancel
          </button>
        </div>
      ) : null}

      <h2 id="webhooks">Webhook endpoints</h2>
      {webhookEndpoints.length === 0 ? (
        <p className="admin-muted">No endpoints registered.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>URL</th>
              <th>Status</th>
              <th>Secret prefix</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {webhookEndpoints.map((endpoint) => (
              <tr key={endpoint.id}>
                <td>{endpoint.url}</td>
                <td>{endpoint.status}</td>
                <td>
                  <code>{endpoint.secretPrefix}</code>
                </td>
                <td>{bahrainDate(endpoint.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p>
        <Link to={`/webhooks/${merchant.id}`}>Replay a batch of deliveries for this merchant</Link>
      </p>

      <h2 id="batches">Recent settlement batches</h2>
      {batches.length === 0 ? (
        <p className="admin-muted">No batches yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th className="num">Gross</th>
              <th className="num">Fee</th>
              <th className="num">Net payout</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr key={batch.id}>
                <td>{businessDate(batch.batchDate)}</td>
                <td>{label(batch.status)}</td>
                <td className="num">{bhd(batch.grossFils)}</td>
                <td className="num">{bhd(batch.feeFils)}</td>
                <td className="num">{bhd(batch.netPayoutFils)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 id="recompute">Recompute transaction statuses</h2>
      <p className="admin-muted">
        Re-derives this merchant&apos;s transaction statuses from their own captured/refunded
        amounts. Rows written before the refunds release can carry a status that predates the
        derivation rule; this backfills them. Rows that already agree are left alone.
      </p>
      <RequireRole
        allow={["finance", "super_admin"]}
        fallback={
          <p className="admin-muted">
            Your role cannot run this backfill. Ask a finance admin.
          </p>
        }
      >
        <button type="button" disabled={busy} onClick={() => void handleRecomputeStatuses()}>
          {busy ? "Working..." : "Recompute statuses"}
        </button>
      </RequireRole>

      <h2 id="view-as">View as merchant</h2>
      <p className="admin-muted">
        Starts a short-lived, audited impersonation grant. It always acts with this merchant&apos;s
        least-privileged <code>support</code> role — never with your admin role — and it expires on
        its own. A banner stays on screen until you exit it.
      </p>
      <button type="button" disabled={busy} onClick={() => void handleImpersonate()}>
        {busy ? "Starting…" : "View as merchant"}
      </button>
      {impersonationUrl ? (
        <p>
          Your browser blocked the new tab —{" "}
          <a href={impersonationUrl} target="_blank" rel="noreferrer">
            open the merchant dashboard
          </a>
          .
        </p>
      ) : null}
    </section>
  );
}
