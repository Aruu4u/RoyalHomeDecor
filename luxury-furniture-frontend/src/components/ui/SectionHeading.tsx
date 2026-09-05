import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;

  /** Optional trailing "view all" affordance. */
  actionLabel?: string;
  actionTo?: string;

  /** Centres the block, used by the testimonial and FAQ sections. */
  align?: "left" | "center";

  id?: string;
}

function SectionHeading({
  eyebrow,
  title,
  description,
  actionLabel,
  actionTo,
  align = "left",
  id,
}: SectionHeadingProps) {
  return (
    <header
      className={`section-heading section-heading-${align}`}
      id={id}
    >
      <div className="section-heading-main">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}

        <h2 className="section-heading-title">{title}</h2>

        {description && (
          <p className="section-heading-description">{description}</p>
        )}
      </div>

      {actionLabel && actionTo && (
        <Link className="link-underline section-heading-action" to={actionTo}>
          {actionLabel}

          <svg
            aria-hidden="true"
            fill="none"
            height="12"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 14 12"
            width="14"
          >
            <path d="M1 6h11M8 2l4 4-4 4" />
          </svg>
        </Link>
      )}
    </header>
  );
}

export default SectionHeading;
