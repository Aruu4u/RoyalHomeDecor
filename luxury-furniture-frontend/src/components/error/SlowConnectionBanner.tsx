import { useEffect, useState } from "react";

import { useConnectionQuality } from "../../hooks/useConnectionQuality";

import "./service-notice.css";

/**
 * Notice shown when the connection is working but slow.
 *
 * Dismissible, and stays dismissed for the rest of the visit: repeatedly
 * telling someone their internet is slow does not help them. Kept
 * deliberately non-technical, with no mention of requests or latency.
 */
function SlowConnectionBanner() {
  const isSlow = useConnectionQuality();

  const [isDismissed, setIsDismissed] = useState(false);

  /* Allow it to reappear if the connection recovers and degrades again. */
  useEffect(() => {
    if (!isSlow) {
      setIsDismissed(false);
    }
  }, [isSlow]);

  if (!isSlow || isDismissed) {
    return null;
  }

  return (
    <div aria-live="polite" className="slow-banner" role="status">
      <span aria-hidden="true" className="slow-banner-icon">
        <svg
          fill="none"
          height="18"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
          viewBox="0 0 24 24"
          width="18"
        >
          <path d="M2 8.8a15 15 0 0 1 20 0" />
          <path d="M5.5 12.6a10 10 0 0 1 13 0" />
          <path d="M9 16.4a5 5 0 0 1 6 0" />
          <circle cx="12" cy="20" r="0.7" fill="currentColor" />
        </svg>
      </span>

      <span className="slow-banner-text">
        Your internet connection seems slow, so images may take a little
        longer to appear.
      </span>

      <button
        aria-label="Dismiss slow connection notice"
        className="slow-banner-close"
        onClick={() => setIsDismissed(true)}
        type="button"
      >
        &times;
      </button>
    </div>
  );
}

export default SlowConnectionBanner;
