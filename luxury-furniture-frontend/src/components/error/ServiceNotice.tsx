import "./service-notice.css";

export type ServiceNoticeVariant = "surveillance" | "offline";

interface ServiceNoticeProps {
  variant: ServiceNoticeVariant;

  /** Retry handler. Omit to show a reload button instead. */
  onRetry?: () => void;

  /** Renders without the brand header, for use inside a page. */
  inline?: boolean;
}

/*
 * Deliberately free of technical language: no status codes, no
 * identifiers, no mention of servers, APIs or requests. The shopper is
 * told what is happening and what they can do, nothing more.
 */
const COPY = {
  surveillance: {
    eyebrow: "Please bear with us",
    title: "Website Under Surveillance",
    body: "Our team is keeping a close watch on the store while we sort out a hiccup on our end. Nothing you did caused this, and your cart and account are safe.",
    hint: "Please try again in a few moments.",
    action: "Try again",
  },
  offline: {
    eyebrow: "Connection lost",
    title: "You're Offline",
    body: "We can't reach the store because your device isn't connected to the internet at the moment. Your cart and account are safe.",
    hint: "Check your Wi-Fi or mobile data, then try again.",
    action: "Retry",
  },
} as const;

function ServiceNotice({
  variant,
  onRetry,
  inline = false,
}: ServiceNoticeProps) {
  const copy = COPY[variant];

  function handleAction(): void {
    if (onRetry) {
      onRetry();
      return;
    }

    window.location.reload();
  }

  return (
    <div
      className={inline ? "service-notice is-inline" : "service-notice"}
      role="alert"
    >
      <div className="service-notice-card">
        <span aria-hidden="true" className="service-notice-mark">
          {variant === "offline" ? (
            <svg
              fill="none"
              height="34"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
              width="34"
            >
              <path d="M2 8.8a15 15 0 0 1 20 0" />
              <path d="M5.5 12.6a10 10 0 0 1 13 0" />
              <path d="M9 16.4a5 5 0 0 1 6 0" />
              <circle cx="12" cy="20" r="0.6" fill="currentColor" />
              <path d="M3 3l18 18" />
            </svg>
          ) : (
            /* An eye inside a shield: watched over, and protected. */
            <svg
              fill="none"
              height="34"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
              width="34"
            >
              <path d="M12 2.6l7.5 3.2v6c0 4.4-3.1 8.1-7.5 9.6-4.4-1.5-7.5-5.2-7.5-9.6v-6z" />
              <path d="M7.6 12c1.2-2 2.7-3 4.4-3s3.2 1 4.4 3c-1.2 2-2.7 3-4.4 3s-3.2-1-4.4-3z" />
              <circle cx="12" cy="12" r="1.1" fill="currentColor" />
            </svg>
          )}
        </span>

        <p className="eyebrow service-notice-eyebrow">{copy.eyebrow}</p>

        <h1 className="service-notice-title">{copy.title}</h1>

        <p className="service-notice-body">{copy.body}</p>

        <p className="service-notice-hint">{copy.hint}</p>

        <div className="service-notice-actions">
          <button
            className="btn btn-gold btn-lg"
            onClick={handleAction}
            type="button"
          >
            {copy.action}
          </button>

          <a className="btn btn-outline btn-lg" href="/">
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}

export default ServiceNotice;
