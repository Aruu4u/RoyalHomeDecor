import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  isOpen: boolean;

  title: string;
  message: string;

  /** Name of the thing being acted on, quoted back to the shopper. */
  subject?: string | null;

  confirmLabel?: string;
  cancelLabel?: string;

  /** Styles the confirm button as destructive. */
  tone?: "danger" | "primary";

  /** Disables both buttons while the action runs. */
  isBusy?: boolean;

  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal confirmation for actions that throw work away.
 *
 * Behaviour that matters for a dialog: Escape cancels, the confirm
 * button takes focus on open so Enter completes the common path, focus
 * is returned to whatever opened it on close, and page scroll is locked
 * so the background cannot move underneath.
 */
function ConfirmDialog({
  isOpen,
  title,
  message,
  subject,
  confirmLabel = "Remove",
  cancelLabel = "Keep it",
  tone = "danger",
  isBusy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.body.dataset.scrollLocked = "true";

    const focusTimer = window.setTimeout(() => {
      confirmRef.current?.focus();
    }, 40);

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      delete document.body.dataset.scrollLocked;

      /* Returning focus keeps keyboard users where they left off. */
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  /*
   * Rendered into <body> rather than in place.
   *
   * `position: fixed` resolves against the nearest ancestor that has a
   * transform, filter or containing-block property rather than against
   * the viewport. Scroll-reveal wrappers animate with translate3d, so a
   * dialog rendered inside one gets clipped to that element instead of
   * covering the screen. A portal sidesteps that entirely.
   */
  return createPortal(
    <div className="confirm-overlay">
      <button
        aria-label={cancelLabel}
        className="confirm-backdrop"
        disabled={isBusy}
        onClick={onCancel}
        tabIndex={-1}
        type="button"
      />

      <div
        aria-describedby="confirm-message"
        aria-labelledby="confirm-title"
        aria-modal="true"
        className="confirm-dialog"
        role="alertdialog"
      >
        <span aria-hidden="true" className="confirm-mark">
          <svg
            fill="none"
            height="24"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
            viewBox="0 0 24 24"
            width="24"
          >
            <path d="M12 3.2 21 19H3z" />
            <path d="M12 9.5v4.2" />
            <circle cx="12" cy="16.4" r="0.7" fill="currentColor" />
          </svg>
        </span>

        <h2 className="confirm-title" id="confirm-title">
          {title}
        </h2>

        <p className="confirm-message" id="confirm-message">
          {message}
        </p>

        {subject && <p className="confirm-subject">{subject}</p>}

        <div className="confirm-actions">
          <button
            className={
              tone === "danger"
                ? "btn btn-danger-solid"
                : "btn btn-primary"
            }
            disabled={isBusy}
            onClick={onConfirm}
            ref={confirmRef}
            type="button"
          >
            {isBusy ? "Working..." : confirmLabel}
          </button>

          <button
            className="btn btn-outline"
            disabled={isBusy}
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default ConfirmDialog;
