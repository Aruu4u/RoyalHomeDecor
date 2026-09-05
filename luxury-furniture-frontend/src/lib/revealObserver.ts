/*
 * One IntersectionObserver for the whole application.
 *
 * The previous implementation created an observer plus a MutationObserver
 * that walked the entire document on every DOM change. This version keeps
 * a single lazily created observer and unobserves each element as soon as
 * it has been revealed, so the work per element is constant and there is
 * no document-wide scanning.
 */

const VISIBLE_CLASS = "is-visible";

type Cleanup = () => void;

let observer: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") {
    return null;
  }

  if (observer) {
    return observer;
  }

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        entry.target.classList.add(VISIBLE_CLASS);
        observer?.unobserve(entry.target);
      }
    },
    {
      /*
       * A negative bottom margin means an element has to be
       * meaningfully on screen before it animates, which reads as
       * intentional rather than twitchy.
       */
      threshold: 0.08,
      rootMargin: "0px 0px -56px 0px",
    },
  );

  return observer;
}

/**
 * Registers an element for scroll reveal.
 *
 * If IntersectionObserver is unavailable, or the user prefers reduced
 * motion, the element is revealed immediately so content is never
 * left invisible.
 */
export function observeReveal(element: HTMLElement): Cleanup {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const activeObserver = getObserver();

  if (!activeObserver || prefersReducedMotion) {
    element.classList.add(VISIBLE_CLASS);
    return () => {};
  }

  activeObserver.observe(element);

  return () => {
    activeObserver.unobserve(element);
  };
}
