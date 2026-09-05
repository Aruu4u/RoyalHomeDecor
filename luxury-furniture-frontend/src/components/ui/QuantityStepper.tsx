import { useEffect, useState } from "react";

interface QuantityStepperProps {
  value: number;
  onChange: (quantity: number) => void;

  /** The API accepts 1-99 per cart item. */
  min?: number;
  max?: number;

  disabled?: boolean;
  ariaLabel?: string;
}

const API_MAX_QUANTITY = 99;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Number stepper with a locally editable field.
 *
 * Typing is kept in local state so a half-typed value never fires a
 * request; the change is committed on blur or Enter.
 */
function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = API_MAX_QUANTITY,
  disabled = false,
  ariaLabel = "Quantity",
}: QuantityStepperProps) {
  const upperBound = Math.max(min, Math.min(max, API_MAX_QUANTITY));

  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit(rawValue: string): void {
    const parsed = Number.parseInt(rawValue, 10);

    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }

    const next = clamp(parsed, min, upperBound);

    setDraft(String(next));

    if (next !== value) {
      onChange(next);
    }
  }

  function step(delta: number): void {
    const next = clamp(value + delta, min, upperBound);

    if (next !== value) {
      onChange(next);
    }
  }

  return (
    <div className="stepper">
      <button
        aria-label="Decrease quantity"
        className="stepper-button"
        disabled={disabled || value <= min}
        onClick={() => step(-1)}
        type="button"
      >
        &minus;
      </button>

      <input
        aria-label={ariaLabel}
        className="stepper-input"
        disabled={disabled}
        inputMode="numeric"
        max={upperBound}
        min={min}
        onBlur={(event) => commit(event.target.value)}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(draft);
          }
        }}
        type="number"
        value={draft}
      />

      <button
        aria-label="Increase quantity"
        className="stepper-button"
        disabled={disabled || value >= upperBound}
        onClick={() => step(1)}
        type="button"
      >
        +
      </button>
    </div>
  );
}

export default QuantityStepper;
