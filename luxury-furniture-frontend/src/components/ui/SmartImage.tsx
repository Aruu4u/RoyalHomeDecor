import { useCallback, useEffect, useRef, useState } from "react";

import { reportLatency } from "../../lib/connectionQuality";

interface SmartImageProps {
  src: string | null | undefined;

  /**
   * Tried if `src` fails to load. Used for custom imagery: a missing or
   * misnamed file in public/images falls back to the catalogue image
   * rather than dropping straight to the placeholder.
   */
  fallbackSrc?: string | null;

  alt: string;

  /** CSS aspect-ratio for the frame. Prevents layout shift. */
  ratio?: string;

  /** Above-the-fold images should opt out of lazy loading. */
  priority?: boolean;

  /** Text shown when there is no image or every source fails. */
  fallbackLabel?: string;

  className?: string;
  sizes?: string;
}

/*
 * Safety valve. If neither load nor error has fired by this point the
 * image is revealed anyway, so a missed event can never leave a card
 * stuck behind the shimmer.
 */
const REVEAL_TIMEOUT_MS = 4000;

/** Ordered, de-duplicated list of sources to attempt. */
function buildSources(
  src: string | null | undefined,
  fallbackSrc: string | null | undefined,
): string[] {
  const sources: string[] = [];

  for (const candidate of [src, fallbackSrc]) {
    if (candidate && !sources.includes(candidate)) {
      sources.push(candidate);
    }
  }

  return sources;
}

/**
 * Image frame that reserves its space, shimmers while loading and
 * cross-fades in.
 *
 * Walks its source list on error, so a custom image that is not there
 * yet degrades to the catalogue image and finally to a branded
 * placeholder.
 */
function SmartImage({
  src,
  fallbackSrc = null,
  alt,
  ratio = "4 / 5",
  priority = false,
  fallbackLabel = "Image coming soon",
  className,
  sizes,
}: SmartImageProps) {
  const sources = buildSources(src, fallbackSrc);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  /*
   * True when the image was already in cache. Such images skip the
   * fade entirely: animating something that is instantly available
   * only makes the page feel slower than it is.
   */
  const [isInstant, setIsInstant] = useState(false);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  const activeSource = sources[sourceIndex] ?? null;

  /* Restart the walk whenever the inputs change. */
  useEffect(() => {
    setSourceIndex(0);
    setIsLoaded(false);
    setIsInstant(false);
    startedAtRef.current = Date.now();
  }, [src, fallbackSrc]);

  const markLoaded = useCallback((measure: boolean) => {
    if (measure) {
      reportLatency(Date.now() - startedAtRef.current);
    }

    setIsLoaded(true);
  }, []);

  /*
   * A cached image can finish decoding before React attaches onLoad, in
   * which case that event never fires. Checking `complete` after commit
   * catches exactly that case, which is why cards whose images were
   * already cached used to sit behind the shimmer indefinitely.
   */
  useEffect(() => {
    if (!activeSource) {
      return;
    }

    const image = imageRef.current;

    if (image?.complete && image.naturalWidth > 0) {
      /* Already in cache: reveal at once and do not skew latency stats. */
      setIsInstant(true);
      markLoaded(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setIsLoaded(true);
    }, REVEAL_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeSource, markLoaded]);

  const handleLoad = useCallback(() => {
    markLoaded(true);
  }, [markLoaded]);

  const handleError = useCallback(() => {
    /* Advance to the next source; render falls through to the
       placeholder once the list is exhausted. */
    setIsLoaded(false);
    setSourceIndex((current) => current + 1);
  }, []);

  const frameClassName = [
    "smart-image",
    isLoaded ? "is-loaded" : "",
    isInstant ? "is-instant" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={frameClassName} style={{ aspectRatio: ratio }}>
      {activeSource ? (
        <img
          alt={alt}
          decoding="async"
          /*
           * fetchPriority tells the browser to pull hero imagery ahead
           * of everything else, which measurably improves LCP.
           */
          fetchPriority={priority ? "high" : "auto"}
          /* Keying on the URL forces a fresh element per source. */
          key={activeSource}
          loading={priority ? "eager" : "lazy"}
          onError={handleError}
          onLoad={handleLoad}
          ref={imageRef}
          sizes={sizes}
          src={activeSource}
        />
      ) : (
        <span className="smart-image-fallback">{fallbackLabel}</span>
      )}
    </div>
  );
}

export default SmartImage;
