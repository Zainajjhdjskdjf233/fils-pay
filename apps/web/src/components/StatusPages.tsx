import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import "../dashboard.css";

/** UX: a plain page for an address that does not exist (was the router's raw 404 screen). */
export function NotFoundPage() {
  return (
    <main className="dash-centered">
      <h1>Page not found</h1>
      <p>This address does not exist. It may have been typed wrongly, or the page has moved.</p>
      <p>
        <Link to="/dashboard">Go to the dashboard</Link>
      </p>
    </main>
  );
}

/** UX: shown instead of a stack trace if a screen fails to render. */
export function AppErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <main className="dash-centered">
      <h1>Something went wrong</h1>
      <p>This page could not be shown. Nothing was changed. Reload the page, or go back and try again.</p>
      <p>
        <button type="button" className="dash-button dash-button-primary" onClick={() => window.location.reload()}>
          Reload
        </button>{" "}
        <Link to="/dashboard">Go to the dashboard</Link>
      </p>
    </main>
  );
}
