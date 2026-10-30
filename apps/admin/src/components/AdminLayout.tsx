import { label } from "../lib/format.js";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

/** UX: the browser tab says which page is open. */
const TITLES: Array<[string, string]> = [
  ["/merchants", "Merchants"],
  ["/credits", "Merchant credits"],
  ["/settlement", "Settlement ops"],
  ["/adjustment-imports", "Import adjustments"],
  ["/webhooks", "Webhook replay"],
];
import { useAdminAuth } from "../auth/AdminAuthContext.js";
import { describeError, WEB_BASE_URL } from "../api/client.js";
import { ImpersonationBanner } from "./ImpersonationBanner.js";

/** Nav shell for every admin-plane screen: who you are signed in as, the
 *  section links, a logout, and — above all of it — the impersonation
 *  banner when a grant is live. */
// YA: nav order per Huda's request (Credits first)
// UX: the code puts Merchants first (the comment above is out of date); labels match page headings.
export function AdminLayout() {
  const { admin, signOut, impersonation } = useAdminAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    const match = TITLES.find(([prefix]) => pathname.startsWith(prefix));
    document.title = `${match ? match[1] : "Admin"} · FilsPay Admin`;
  }, [pathname]);

  async function handleSignOut(): Promise<void> {
    setError(null);
    setSigningOut(true);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="admin-shell">
      <ImpersonationBanner />

      <header className="admin-header">
        <div className="admin-brand">FilsPay Admin</div>
        <nav className="admin-nav" aria-label="Admin">
          <NavLink to="/merchants">Merchants</NavLink>
          <NavLink to="/credits">Merchant credits</NavLink>
          <NavLink to="/settlement">Settlement ops</NavLink>
          <NavLink to="/adjustment-imports">Import adjustments</NavLink>
          {/* E136: replay is finance/super_admin only */}
          {admin && admin.role !== "support" ? <NavLink to="/webhooks">Webhook replay</NavLink> : null}
        </nav>
        <div className="admin-identity">
          {admin ? (
            <span>
              {admin.email} <span className="admin-role-chip" title="Your admin role">{label(admin.role)}</span>
            </span>
          ) : null}
          <button type="button" disabled={signingOut} onClick={() => void handleSignOut()}>
            {signingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </header>

      {error ? <p className="admin-error" role="alert">{error}</p> : null}

      {impersonation ? (
        // An explicit "exit view-as-merchant" action is required before
        // admin-plane screens are shown again. This is a UX safeguard so the
        // two modes are never confused on screen; the privilege boundary
        // itself does not depend on it — /v1/admin/* never reads the
        // impersonation cookie, and the merchant side never reads the admin
        // session cookie.
        <main className="admin-main">
          <h1>Admin screens are paused</h1>
          <p>
            An impersonation grant is active. Use <strong>Exit impersonation</strong> above to end it
            and return to the admin console.
          </p>
          <p>
            Merchant screens are at <code>{WEB_BASE_URL}</code> while the grant lasts.
          </p>
        </main>
      ) : (
        <main className="admin-main">
          <Outlet />
        </main>
      )}
    </div>
  );
}
