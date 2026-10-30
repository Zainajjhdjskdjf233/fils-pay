import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

/** UX: the browser tab says which page is open. */
const TITLES: Array<[string, string]> = [
  ["/dashboard/overview", "Overview"],
  ["/dashboard/transactions", "Transactions"],
  ["/dashboard/payment-links/new", "New payment link"],
  ["/dashboard/payment-links", "Payment links"],
  ["/dashboard/webhooks", "Webhook endpoints"],
  ["/dashboard/settlement", "Settlement batches"],
  ["/dashboard/reconciliation", "Reconciliation"],
];
import { useDashboardAuth } from "../auth/DashboardAuthContext.js";
import { RequireRole } from "../auth/RequireRole.js";
import { describeError } from "../api/client.js";
import "../dashboard.css";

/** Nav shell for every merchant dashboard screen. No impersonation banner
 *  here — nothing in the merchant plane impersonates anyone; when an admin
 *  "views as merchant", they arrive with a `support`-role session and see
 *  exactly what a support user sees. */
export function DashboardLayout() {
  const { me, signOut } = useDashboardAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    const match = TITLES.find(([prefix]) => pathname.startsWith(prefix));
    document.title = `${match ? match[1] : "Dashboard"} · FilsPay`;
  }, [pathname]);

  // sign out clears the cookie server side, local merchantId stays — am
  async function handleSignOut(): Promise<void> {
    setError(null);
    setSigningOut(true);
    try {
      await signOut();
      navigate("/dashboard/login", { replace: true });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="dash-shell">
      <header className="dash-header">
        <div className="dash-brand">FilsPay</div>
        <nav className="dash-nav" aria-label="Dashboard">
          {/* UX: Overview first, as the landing summary; labels match each page heading. */}
          <NavLink to="/dashboard/overview">Overview</NavLink>
          <NavLink to="/dashboard/transactions">Transactions</NavLink>
          <NavLink to="/dashboard/payment-links">Payment links</NavLink>
          {/* Every webhook route — including the plain list read — is
              owner/finance-only server-side, so the link itself is
              hidden from support rather than offered and then refused. */}
          <RequireRole allow={["owner", "finance"]}>
            <NavLink to="/dashboard/webhooks">Webhook endpoints</NavLink>
          </RequireRole>
          <NavLink to="/dashboard/settlement">Settlement batches</NavLink>
          <RequireRole allow={["owner", "finance"]}>
            <NavLink to="/dashboard/reconciliation">Reconciliation</NavLink>
          </RequireRole>
        </nav>
        <div className="dash-identity">
          {me ? (
            <span>
              {me.email} <span className="dash-role-chip" title="Your role">{me.role}</span>
              <span className="dash-muted"> · {me.merchant.displayName}</span>
            </span>
          ) : null}
          <button type="button" className="dash-button" disabled={signingOut} onClick={() => void handleSignOut()}>
            {signingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </header>

      {error ? <p className="dash-error" role="alert">{error}</p> : null}

      <main className="dash-main">
        <Outlet />
      </main>
    </div>
  );
}
