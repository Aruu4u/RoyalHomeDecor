import { useId, useState } from "react";

import { MAX_RATING, MIN_RATING } from "../../types/review";

interface StarRatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}

const RATING_WORDS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very good",
  5: "Excellent",
};

/**
 * Star rating picker.
 *
 * Built from radio inputs rather than buttons. A rating is one choice from
 * five, which is exactly what a radio group is, and it gets keyboard
 * arrow-key navigation and screen-reader announcement for free instead of
 * needing them reimplemented.
 *
 * The inputs are visually hidden but never `display: none`, so they stay
 * focusable and the focus ring can be drawn on the star beside them.
 */
function StarRatingInput({
  value,
  onChange,
  disabled = false,
}: StarRatingInputProps) {
  const groupName = useId();

  /* Preview follows the pointer without committing a choice. */
  const [hovered, setHovered] = useState<number | null>(null);

  const shown = hovered ?? value;

  const stars = Array.from(
    { length: MAX_RATING - MIN_RATING + 1 },
    (_, index) => MIN_RATING + index,
  );

  return (
    <div className="star-input-wrap">
      <div
        className="star-input"
        onMouseLeave={() => setHovered(null)}
        role="radiogroup"
        aria-label="Your rating"
      >
        {stars.map((star) => (
          <label
            className={
              star <= shown ? "star-input-star is-on" : "star-input-star"
            }
            key={star}
            onMouseEnter={() => !disabled && setHovered(star)}
          >
            <input
              checked={value === star}
              disabled={disabled}
              name={groupName}
              onChange={() => onChange(star)}
              type="radio"
              value={star}
            />

            <span aria-hidden="true">{"\u2605"}</span>

            {/* The only text a screen reader announces for the option. */}
            <span className="visually-hidden">
              {star} star{star === 1 ? "" : "s"} &ndash; {RATING_WORDS[star]}
            </span>
          </label>
        ))}
      </div>

      <span aria-hidden="true" className="star-input-word">
        {shown > 0 ? RATING_WORDS[shown] : "Tap to rate"}
      </span>
    </div>
  );
}

export default StarRatingInput;
