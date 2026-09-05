import { useEffect, useState } from "react";

/**
 * Tracks whether the browser currently has a network connection.
 *
 * `navigator.onLine` only tells us the device has *a* connection, not
 * that our store is reachable, so this is used for the "you're offline"
 * case while genuine request failures are classified separately.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );

  useEffect(() => {
    function handleOnline(): void {
      setIsOnline(true);
    }

    function handleOffline(): void {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
