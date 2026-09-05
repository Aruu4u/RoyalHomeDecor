interface StarRatingProps {
  /** The score, 0 to 5. Fractions are shown as a partial star. */
  value: number;

  /** Optional review count, appended after the stars. */
  count?: number;
}

/**
 * Read-only star display.
 *
 * Two stacked copies of the same five glyphs, the gold one clipped to the
 * score. That renders 4.3 as four and a bit stars rather than rounding to
 * a whole number, which would overstate or understate the rating.
 *
 * One `img` role carrying the numeric label, so a screen reader hears
 * "4.3 out of 5 stars" instead of ten star characters.
 */
function StarRating({ value, count }: StarRatingProps) {
  const clamped = Math.max(0, Math.min(5, value));

  const label = `${clamped.toFixed(1)} out of 5 stars`;

  return (
    <span className="star-rating">
      <span
        aria-label={count === undefined ? label : `${label}, ${count} reviews`}
        className="star-rating-stars"
        role="img"
        style={{ ["--rating-fill" as string]: `${(clamped / 5) * 100}%` }}
      >
        <span aria-hidden="true" className="star-rating-empty">
          {"\u2605\u2605\u2605\u2605\u2605"}
        </span>

        <span aria-hidden="true" className="star-rating-filled">
          {"\u2605\u2605\u2605\u2605\u2605"}
        </span>
      </span>

      {count !== undefined && (
        <span aria-hidden="true" className="star-rating-count">
          {count} review{count === 1 ? "" : "s"}
        </span>
      )}
    </span>
  );
}

export default StarRating;
