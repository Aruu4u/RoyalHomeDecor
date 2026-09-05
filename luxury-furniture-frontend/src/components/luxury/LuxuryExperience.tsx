import { useEffect } from "react";

const REVEAL_SELECTOR = [
  ".about-luxury-copy",
  ".collection-introduction",
  ".shop-catalogue-header",
  ".shop-filter-panel",
  ".details-content",
  ".auth-shell",
].join(",");

function LuxuryExperience() {
  useEffect(() => {
    const body = document.body;
    body.classList.add("royal-luxury-theme");

    const registeredElements = new WeakSet<Element>();

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("luxury-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -48px 0px",
      },
    );

    function registerElement(element: Element, index: number): void {
      if (
        registeredElements.has(element) ||
        !element.matches(REVEAL_SELECTOR)
      ) {
        return;
      }

      registeredElements.add(element);
      element.classList.add("luxury-reveal");

      if (element instanceof HTMLElement) {
        element.style.setProperty(
          "--luxury-delay",
          `${Math.min(index % 6, 5) * 65}ms`,
        );
      }

      revealObserver.observe(element);
    }

    function registerTree(root: ParentNode): void {
      if (root instanceof Element) {
        registerElement(root, 0);
      }

      root
        .querySelectorAll(REVEAL_SELECTOR)
        .forEach((element, index) => {
          registerElement(element, index);
        });
    }

    registerTree(document);

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            registerTree(node);
          }
        });
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    function updateScrolledState(): void {
      body.classList.toggle(
        "luxury-scrolled",
        window.scrollY > 36,
      );
    }

    updateScrolledState();

    window.addEventListener(
      "scroll",
      updateScrolledState,
      { passive: true },
    );

    let animationFrameId: number | null = null;
let pointerX = 0;
let pointerY = 0;
let pointerTarget: Element | null = null;

function updateHeroSpotlight(): void {
  animationFrameId = null;

  if (!pointerTarget) {
    return;
  }

  const hero =
    pointerTarget.closest(".hero");

  if (!(hero instanceof HTMLElement)) {
    return;
  }

  const bounds =
    hero.getBoundingClientRect();

  if (
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return;
  }

  const x =
    ((pointerX - bounds.left) /
      bounds.width) *
    100;

  const y =
    ((pointerY - bounds.top) /
      bounds.height) *
    100;

  hero.style.setProperty(
    "--luxury-pointer-x",
    `${x}%`,
  );

  hero.style.setProperty(
    "--luxury-pointer-y",
    `${y}%`,
  );
}

function handlePointerMove(
  event: PointerEvent,
): void {
  if (!(event.target instanceof Element)) {
    return;
  }

  pointerX = event.clientX;
  pointerY = event.clientY;
  pointerTarget = event.target;

  if (animationFrameId !== null) {
    return;
  }

  animationFrameId =
    window.requestAnimationFrame(
      updateHeroSpotlight,
    );
}

document.addEventListener(
  "pointermove",
  handlePointerMove,
  {
    passive: true,
  },
);

    document.removeEventListener(
  "pointermove",
  handlePointerMove,
);
if (animationFrameId !== null) {
  window.cancelAnimationFrame(
    animationFrameId,
  );
}

    return () => {
      mutationObserver.disconnect();
      revealObserver.disconnect();

      window.removeEventListener(
        "scroll",
        updateScrolledState,
      );

      document.removeEventListener(
        "pointermove",
        handlePointerMove,
      );

      body.classList.remove(
        "royal-luxury-theme",
        "luxury-scrolled",
      );
    };
  }, []);

  return null;
}

export default LuxuryExperience;
