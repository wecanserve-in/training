import { Suspense } from "react";
import { Outlet } from "react-router-dom";

/**
 * <Outlet /> with a loading state while a page's code downloads.
 * Pages are loaded on demand (see App.jsx), so the layout and sidebar stay put.
 */
function PageOutlet() {
  return (
    <Suspense
      fallback={
        <div className="page-loading" role="status" aria-live="polite">
          <span className="page-loading-spinner" aria-hidden="true" />
          <span>Loading…</span>
        </div>
      }
    >
      <Outlet />
    </Suspense>
  );
}

export default PageOutlet;
