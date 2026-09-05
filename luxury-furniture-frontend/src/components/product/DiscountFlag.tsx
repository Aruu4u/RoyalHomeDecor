interface DiscountFlagProps {
  discountPercent: number;
  label?: string | null;
}

/**
 * Corner flag on a product card showing the saving.
 *
 * The scissors-style tag glyph reads as a price cut at small sizes,
 * where a percentage alone is easy to skim past.
 */
function DiscountFlag({ discountPercent, label }: DiscountFlagProps) {
  return (
    <span className="discount-flag">
      <svg
        aria-hidden="true"
        fill="none"
        height="13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
        viewBox="0 0 24 24"
        width="13"
      >
        {/* Price-tag outline with its punch hole. */}
        <path d="M20.6 12.3 12.9 20a1.7 1.7 0 0 1-2.4 0l-7-7a1.7 1.7 0 0 1-.5-1.2V4.4c0-.9.7-1.6 1.6-1.6h7.4c.5 0 .9.2 1.2.5l7 7c.7.7.7 1.8 0 2.5z" />
        <circle cx="7.6" cy="7.6" r="1.3" />
      </svg>

      <span className="discount-flag-value">{discountPercent}% off</span>

      {label && <span className="discount-flag-label">{label}</span>}
    </span>
  );
}

export default DiscountFlag;
