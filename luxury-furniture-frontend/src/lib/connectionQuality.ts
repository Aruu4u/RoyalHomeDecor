/* =========================================================
   CONNECTION QUALITY

   Answers one question: is this shopper's connection slow enough
   that we should say so?

   Two signals are combined, because neither is sufficient alone:

   1. The Network Information API (`navigator.connection`), which is
      only implemented in Chromium browsers and can be stale or
      absent entirely.
   2. Measured latency of our own requests and images. This is the
      signal that actually matters, because it reflects the real
      round trip to Supabase rather than the device's link speed.

   Deliberately conservative: a single slow request is not enough,
   since one unlucky request happens on any connection. We require
   repeated slow samples before showing anything.
   ========================================================= */

/** A single sample slower than this counts against the connection. */
const SLOW_SAMPLE_MS = 2200;

/** How many recent samples to keep. */
const SAMPLE_WINDOW = 6;

/** Slow samples needed within the window before we announce it. */
const SLOW_SAMPLE_THRESHOLD = 3;

/** Once things recover, stop reporting slow after this many fast samples. */
const RECOVERY_SAMPLES = 4;

type Listener = (isSlow: boolean) => void;

const samples: number[] = [];
const listeners = new Set<Listener>();

let isSlow = false;

interface NetworkInformation {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

function getConnection(): NetworkInformation | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  return (
    (navigator as Navigator & { connection?: NetworkInformation }).connection ??
    null
  );
}

/** True when the browser itself reports a poor link. */
function reportedAsSlowLink(): boolean {
  const connection = getConnection();

  if (!connection) {
    return false;
  }

  if (connection.saveData === true) {
    return true;
  }

  const effectiveType = connection.effectiveType;

  return effectiveType === "2g" || effectiveType === "slow-2g";
}

function publish(next: boolean): void {
  if (next === isSlow) {
    return;
  }

  isSlow = next;

  for (const listener of listeners) {
    listener(isSlow);
  }
}

function evaluate(): void {
  if (reportedAsSlowLink()) {
    publish(true);
    return;
  }

  const slowCount = samples.filter(
    (duration) => duration >= SLOW_SAMPLE_MS,
  ).length;

  if (!isSlow && slowCount >= SLOW_SAMPLE_THRESHOLD) {
    publish(true);
    return;
  }

  /*
   * Clear the warning only after a decent run of fast samples, so the
   * banner does not flicker on a connection that is merely uneven.
   */
  if (isSlow && samples.length >= RECOVERY_SAMPLES) {
    const recent = samples.slice(-RECOVERY_SAMPLES);
    const allFast = recent.every((duration) => duration < SLOW_SAMPLE_MS);

    if (allFast) {
      publish(false);
    }
  }
}

/**
 * Records how long a request or image took.
 *
 * Called from the catalogue cache and the hero image loader, so the
 * measurement reflects the assets shoppers actually wait on.
 */
export function reportLatency(durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return;
  }

  samples.push(durationMs);

  if (samples.length > SAMPLE_WINDOW) {
    samples.shift();
  }

  evaluate();
}

/** Times a promise and records how long it took, pass or fail. */
export async function timed<T>(work: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();

  try {
    return await work();
  } finally {
    reportLatency(Date.now() - startedAt);
  }
}

export function isConnectionSlow(): boolean {
  return isSlow || reportedAsSlowLink();
}

/** Subscribes to changes. Returns an unsubscribe function. */
export function subscribeToConnectionQuality(listener: Listener): () => void {
  listeners.add(listener);

  const connection = getConnection();
  const handleChange = (): void => evaluate();

  connection?.addEventListener?.("change", handleChange);

  return () => {
    listeners.delete(listener);
    connection?.removeEventListener?.("change", handleChange);
  };
}
