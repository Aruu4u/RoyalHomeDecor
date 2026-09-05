import { useOnlineStatus } from "../../hooks/useOnlineStatus";

import "./service-notice.css";

/**
 * Persistent strip shown while the device has no connection.
 *
 * Used alongside the full-page notice: the banner covers the case where
 * the shopper is mid-browse on already-loaded content, where replacing
 * the whole page would be more disruptive than helpful.
 */
function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div aria-live="polite" className="offline-banner" role="status">
      <span aria-hidden="true" className="offline-banner-dot" />

      <span>
        You&rsquo;re offline. Some things may not work until your connection
        comes back.
      </span>
    </div>
  );
}

export default OfflineBanner;
