import type { ReactNode } from "react";
import {
  Link,
  Navigate,
  useLocation,
} from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({
  children,
}: AdminRouteProps) {
  const {
    session,
    isLoading,
    isAdmin,
  } = useAuth();

  const location = useLocation();

  if (isLoading) {
    return (
      <main
        aria-live="polite"
        className="details-page"
      >
        <p>
          Checking administrator access...
        </p>
      </main>
    );
  }

  if (!session) {
    return (
      <Navigate
        replace
        state={{ from: location }}
        to="/login"
      />
    );
  }

  if (!isAdmin) {
    return (
      <main className="admin-access-page">
        <section className="admin-access-card">
          <p className="eyebrow">
            Restricted area
          </p>

          <h1>
            Administrator access required
          </h1>

          <p>
            This account does not have
            permission to open the
            store-management dashboard.
          </p>

          <Link
            className="cart-primary-link"
            to="/"
          >
            Return to storefront
          </Link>
        </section>
      </main>
    );
  }

  return children;
}