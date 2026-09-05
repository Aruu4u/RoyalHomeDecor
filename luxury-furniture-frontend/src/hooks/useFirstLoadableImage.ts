import { useEffect, useState } from "react";

import { reportLatency } from "../lib/connectionQuality";

/**
 * Resolves the first URL in `candidates` that the browser can actually
 * decode, testing them in order.
 *
 * Used for the hero, where a single hardcoded asset is fragile: a row
 * may point at a dead host, and the bundled placeholder was far too
 * small to fill a full-bleed banner. Trying real catalogue imagery in
 * priority order means the hero degrades to the next best photograph
 * rather than to something stretched or blank.
 *
 * Returns null until one resolves, so callers can keep showing their
 * gradient backdrop in the meantime.
 */
export function useFirstLoadableImage(
  candidates: string[],
  /** Give up on a candidate that has not loaded in this many ms. */
  timeoutMs = 6000,
): string | null {
  /* Stable dependency: the array identity changes on every render. */
  const key = candidates.join("|");

  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    const urls = key === "" ? [] : key.split("|");

    if (urls.length === 0) {
      setResolved(null);
      return;
    }

    let isCurrent = true;
    let timer: number | undefined;
    let image: HTMLImageElement | null = null;

    function attempt(index: number): void {
      if (!isCurrent || index >= urls.length) {
        return;
      }

      const url = urls[index];
      const startedAt = Date.now();

      image = new Image();

      /* Decoding off the main thread keeps the hero paint smooth. */
      image.decoding = "async";

      function cleanup(): void {
        window.clearTimeout(timer);

        if (image) {
          image.onload = null;
          image.onerror = null;
        }
      }

      image.onload = () => {
        cleanup();

        /* Hero artwork is the heaviest asset, so it is a good sample. */
        reportLatency(Date.now() - startedAt);

        if (isCurrent) {
          setResolved(url);
        }
      };

      image.onerror = () => {
        cleanup();
        attempt(index + 1);
      };

      /* A host that never answers should not stall the hero forever. */
      timer = window.setTimeout(() => {
        cleanup();
        attempt(index + 1);
      }, timeoutMs);

      image.src = url;
    }

    attempt(0);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);

      if (image) {
        image.onload = null;
        image.onerror = null;
      }
    };
  }, [key, timeoutMs]);

  return resolved;
}
