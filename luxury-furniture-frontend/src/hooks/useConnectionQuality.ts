import { useEffect, useState } from "react";

import {
  isConnectionSlow,
  subscribeToConnectionQuality,
} from "../lib/connectionQuality";

/**
 * Tracks whether the connection currently looks slow.
 *
 * Distinct from useOnlineStatus: that reports a total loss of
 * connectivity, this reports a connection that works but is painful.
 */
export function useConnectionQuality(): boolean {
  const [isSlow, setIsSlow] = useState(() => isConnectionSlow());

  useEffect(() => {
    /* Re-sync in case samples arrived before this mounted. */
    setIsSlow(isConnectionSlow());

    return subscribeToConnectionQuality(setIsSlow);
  }, []);

  return isSlow;
}
