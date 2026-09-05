import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface CarouselProps {
  children: ReactNode;
  ariaLabel: string;

  /** Extra class applied to the scrolling track. */
  trackClassName?: string;
}

/**
 * Horizontal rail built on native scroll-snap.
 *
 * Native scrolling gives us momentum, touch, keyboard and accessibility
 * behaviour for free, and it runs on the compositor rather than in JS.
 * The only JS here is enabling/disabling the arrow buttons.
 */
function Carousel({ children, ariaLabel, trackClassName }: CarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);

  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const syncArrows = useCallback(() => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    const maxScroll = track.scrollWidth - track.clientWidth;

    setCanScrollBack(track.scrollLeft > 4);
    setCanScrollForward(track.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    syncArrows();

    /* rAF-throttled so a fast flick cannot queue up state updates. */
    function handleScroll(): void {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        syncArrows();
      });
    }

    track.addEventListener("scroll", handleScroll, { passive: true });

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(syncArrows);

    resizeObserver?.observe(track);

    return () => {
      track.removeEventListener("scroll", handleScroll);
      resizeObserver?.disconnect();

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [syncArrows, children]);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    /* Advance by just under a full viewport so context is preserved. */
    track.scrollBy({
      left: direction * track.clientWidth * 0.86,
      behavior: "smooth",
    });
  }, []);

  const hasOverflow = canScrollBack || canScrollForward;

  return (
    <div className="carousel">
      <div
        aria-label={ariaLabel}
        className={
          trackClassName ? `carousel-track ${trackClassName}` : "carousel-track"
        }
        ref={trackRef}
        role="group"
        tabIndex={0}
      >
        {children}
      </div>

      {hasOverflow && (
        <div className="carousel-controls">
          <button
            aria-label="Scroll backward"
            className="carousel-button"
            disabled={!canScrollBack}
            onClick={() => scrollByPage(-1)}
            type="button"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="16"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              viewBox="0 0 16 16"
              width="16"
            >
              <path d="M10 3 5 8l5 5" />
            </svg>
          </button>

          <button
            aria-label="Scroll forward"
            className="carousel-button"
            disabled={!canScrollForward}
            onClick={() => scrollByPage(1)}
            type="button"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="16"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              viewBox="0 0 16 16"
              width="16"
            >
              <path d="M6 3l5 5-5 5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default Carousel;
