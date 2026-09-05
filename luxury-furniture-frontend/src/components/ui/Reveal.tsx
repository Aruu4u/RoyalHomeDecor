import {
  useEffect,
  useRef,
  type ElementType,
  type ReactNode,
} from "react";

import { observeReveal } from "../../lib/revealObserver";

interface RevealProps {
  children: ReactNode;

  /** Rendered element. Defaults to a div. */
  as?: ElementType;

  /** Stagger, in milliseconds. Capped so long lists never feel slow. */
  delay?: number;

  className?: string;
  id?: string;
}

const MAX_DELAY = 320;

/**
 * Fades and lifts its children into view once, on first intersection.
 */
function Reveal({
  children,
  as: Component = "div",
  delay = 0,
  className,
  id,
}: RevealProps) {
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    return observeReveal(element);
  }, []);

  return (
    <Component
      className={className ? `reveal ${className}` : "reveal"}
      id={id}
      ref={elementRef}
      style={
        delay > 0
          ? {
              ["--reveal-delay" as string]: `${Math.min(delay, MAX_DELAY)}ms`,
            }
          : undefined
      }
    >
      {children}
    </Component>
  );
}

export default Reveal;
