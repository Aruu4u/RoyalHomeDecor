import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ToastMessage {
  message: string;
  isError: boolean;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;

  /** How long it stays before dismissing itself. */
  durationMs?: number;
}

const DEFAULT_DURATION_MS = 4200;

/**
 * Transient confirmation, bottom right.
 *
 * Dismisses itself. The close button is a shortcut, not the only way
 * out, which is what made the previous version feel stuck.
 *
 * The countdown pauses while the pointer is over the toast or while it
 * holds focus, so it cannot vanish mid-read or while a keyboard user is
 * on the close button.
 *
 * Portalled to <body> because `position: fixed` resolves against a
 * transformed ancestor, and these are raised from inside scroll-reveal
 * sections.
 */
function Toast({
  toast,
  onDismiss,
  durationMs = DEFAULT_DURATION_MS,
}: ToastProps) {
  const [isPaused, setIsPaused] = useState(false);

  /* Keeps the latest handler without restarting the timer. */
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const message = toast?.message ?? null;

  useEffect(() => {
    if (!message || isPaused) {
      return;
    }

    const timer = window.setTimeout(() => {
      dismissRef.current();
    }, durationMs);

    return () => {
      window.clearTimeout(timer);
    };
    /* `message` rather than `toast`: a new message restarts the clock. */
  }, [message, isPaused, durationMs]);

  /* Escape closes it, matching the rest of the dismissible UI. */
  useEffect(() => {
    if (!message) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        dismissRef.current();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [message]);

  if (!toast) {
    return null;
  }

  return createPortal(
    <div
      aria-live="polite"
      className={`toast ${toast.isError ? "is-error" : "is-success"}`}
      onBlur={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="status"
    >
      <span aria-hidden="true" className="toast-icon">
        {toast.isError ? (
          <svg
            fill="none"
            height="16"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
            viewBox="0 0 16 16"
            width="16"
          >
            <circle cx="8" cy="8" r="6.6" />
            <path d="M8 5v4" />
            <circle cx="8" cy="11.2" r="0.6" fill="currentColor" />
          </svg>
        ) : (
          <svg
            fill="none"
            height="16"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.9"
            viewBox="0 0 16 16"
            width="16"
          >
            <circle cx="8" cy="8" r="6.6" />
            <path d="M5.2 8.3l1.9 1.9 3.7-4" />
          </svg>
        )}
      </span>

      <p className="toast-message">{toast.message}</p>

      <button
        aria-label="Dismiss"
        className="toast-close"
        onClick={onDismiss}
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="12"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
          viewBox="0 0 12 12"
          width="12"
        >
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
        </svg>
      </button>

      {/* Depletes to show the remaining time before it closes. */}
      <span
        aria-hidden="true"
        className="toast-progress"
        style={{
          animationDuration: `${durationMs}ms`,
          animationPlayState: isPaused ? "paused" : "running",
        }}
      />
    </div>,
    document.body,
  );
}

export default Toast;
