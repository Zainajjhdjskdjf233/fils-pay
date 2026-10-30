import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";

/** UX: a plain page for an address that does not exist (was the router's raw 404 screen). */
export function NotFoundPage() {
  return (
    <main className="admin-centered">
      <h1>Page not found</h1>
      <p>This address does not exist in the admin console.</p>
      <p>
        <Link to="/merchants">Go to Merchants</Link>
      </p>
    </main>
  );
}

/** UX: shown instead of a stack trace if a screen fails to render. */
export function AppErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <main className="admin-centered">
      <h1>Something went wrong</h1>
      <p>This page could not be shown. Nothing was changed. Reload the page, or go back and try again.</p>
      <p>
        <button type="button" className="admin-button-primary" onClick={() => window.location.reload()}>
          Reload
        </button>{" "}
        <Link to="/merchants">Go to Merchants</Link>
      </p>
    </main>
  );
}
