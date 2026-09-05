import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/* =========================================================
   Loading, empty and error states shared by every page.
   ========================================================= */

interface ProductGridSkeletonProps {
  count?: number;
}

/** Placeholder cards sized exactly like real product cards. */
export function ProductGridSkeleton({ count = 8 }: ProductGridSkeletonProps) {
  return (
    <div aria-hidden="true" className="product-grid">
      {Array.from({ length: count }, (_, index) => (
        <div className="product-card-skeleton" key={index}>
          <div className="skeleton product-card-skeleton-image" />
          <div className="skeleton product-card-skeleton-line" />
          <div className="skeleton product-card-skeleton-line is-short" />
        </div>
      ))}
    </div>
  );
}

interface PageLoaderProps {
  label?: string;
}

/** Full-page fallback used by route-level Suspense boundaries. */
export function PageLoader({ label = "Loading" }: PageLoaderProps) {
  return (
    <div aria-live="polite" className="page-loader" role="status">
      <span className="page-loader-mark" />
      <p>{label}</p>
    </div>
  );
}

interface EmptyStateProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actionLabel?: string;
  actionTo?: string;
  children?: ReactNode;
}

export function EmptyState({
  eyebrow,
  title,
  description,
  actionLabel,
  actionTo,
  children,
}: EmptyStateProps) {
  return (
    <section className="empty-state">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}

      <h2>{title}</h2>

      {description && <p className="empty-state-description">{description}</p>}

      {actionLabel && actionTo && (
        <Link className="btn btn-primary" to={actionTo}>
          {actionLabel}
        </Link>
      )}

      {children}
    </section>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

/**
 * Inline failure panel for problems the shopper may be able to resolve.
 *
 * Our-side failures should use ServiceNotice instead, which is why the
 * default wording here stays gentle and non-technical.
 */
export function ErrorState({
  title = "We hit a snag",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <section className="empty-state" role="alert">
      <h2>{title}</h2>

      <p className="empty-state-description">{message}</p>

      {onRetry && (
        <button className="btn btn-outline" onClick={onRetry} type="button">
          Try again
        </button>
      )}
    </section>
  );
}
