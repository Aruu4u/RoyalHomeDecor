import {
  Children,
  cloneElement,
  createRef,
  forwardRef,
  isValidElement,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import type {
  HTMLAttributes,
  ReactElement,
  ReactNode,
  RefAttributes,
  RefObject,
} from "react";

import gsap from "gsap";

import "./CardSwap.css";

export interface CardSwapProps {
  width?: number | string;
  height?: number | string;
  cardDistance?: number;
  verticalDistance?: number;
  delay?: number;
  pauseOnHover?: boolean;
  onCardClick?: (
    index: number,
  ) => void;
  skewAmount?: number;
  easing?: "linear" | "elastic";
  children: ReactNode;
}

export interface CardProps
  extends HTMLAttributes<HTMLDivElement> {
  customClass?: string;
}

export const Card =
  forwardRef<
    HTMLDivElement,
    CardProps
  >(
    (
      {
        customClass = "",
        className = "",
        ...rest
      },
      ref,
    ) => (
      <div
        className={[
          "about-swap-card",
          customClass,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        ref={ref}
        {...rest}
      />
    ),
  );

Card.displayName = "Card";

type CardRef =
  RefObject<HTMLDivElement | null>;

interface Slot {
  x: number;
  y: number;
  z: number;
  zIndex: number;
}

function makeSlot(
  index: number,
  horizontalDistance: number,
  verticalDistance: number,
  total: number,
): Slot {
  return {
    x:
      index *
      horizontalDistance,

    y:
      -index *
      verticalDistance,

    z:
      -index *
      horizontalDistance *
      1.5,

    zIndex:
      total - index,
  };
}

function placeImmediately(
  element: HTMLElement,
  slot: Slot,
  skew: number,
): void {
  gsap.set(element, {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin:
      "center center",
    zIndex: slot.zIndex,
    force3D: true,
  });
}

function CardSwap({
  width = 520,
  height = 410,
  cardDistance = 52,
  verticalDistance = 54,
  delay = 3600,
  pauseOnHover = true,
  onCardClick,
  skewAmount = 4,
  easing = "elastic",
  children,
}: CardSwapProps) {
  const childArray =
    useMemo(
      () =>
        Children.toArray(
          children,
        ).filter(
          isValidElement,
        ) as ReactElement<CardProps>[],
      [children],
    );

  const references =
    useMemo<CardRef[]>(
      () =>
        childArray.map(() =>
          createRef<HTMLDivElement>(),
        ),
      [childArray],
    );

  const order =
    useRef<number[]>([]);

  const timelineRef =
    useRef<
      gsap.core.Timeline | null
    >(null);

  const intervalRef =
    useRef<number | null>(
      null,
    );

  const containerRef =
    useRef<HTMLDivElement>(
      null,
    );

  useLayoutEffect(() => {
    const total =
      references.length;

    if (total === 0) {
      return;
    }

    order.current =
      Array.from(
        {
          length: total,
        },
        (_, index) => index,
      );

    references.forEach(
      (reference, index) => {
        const element =
          reference.current;

        if (!element) {
          return;
        }

        placeImmediately(
          element,
          makeSlot(
            index,
            cardDistance,
            verticalDistance,
            total,
          ),
          skewAmount,
        );
      },
    );

    const animationConfig =
      easing === "elastic"
        ? {
            ease:
              "elastic.out(0.55, 0.88)",

            dropDuration: 1.3,
            moveDuration: 1.35,
            returnDuration: 1.35,
            overlap: 0.72,
            returnDelay: 0.08,
          }
        : {
            ease:
              "power2.inOut",

            dropDuration: 0.7,
            moveDuration: 0.75,
            returnDuration: 0.75,
            overlap: 0.45,
            returnDelay: 0.16,
          };

    function swapCards(): void {
      if (
        order.current.length < 2
      ) {
        return;
      }

      const [
        frontCardIndex,
        ...remainingIndexes
      ] = order.current;

      const frontElement =
        references[
          frontCardIndex
        ]?.current;

      if (!frontElement) {
        return;
      }

      timelineRef.current?.kill();

      const timeline =
        gsap.timeline();

      timelineRef.current =
        timeline;

      timeline.to(
        frontElement,
        {
          y: "+=520",
          opacity: 0.96,
          duration:
            animationConfig
              .dropDuration,
          ease:
            animationConfig.ease,
        },
      );

      timeline.addLabel(
        "promote",
        `-=${
          animationConfig
            .dropDuration *
          animationConfig.overlap
        }`,
      );

      remainingIndexes.forEach(
        (
          cardIndex,
          position,
        ) => {
          const element =
            references[
              cardIndex
            ]?.current;

          if (!element) {
            return;
          }

          const slot =
            makeSlot(
              position,
              cardDistance,
              verticalDistance,
              total,
            );

          timeline.set(
            element,
            {
              zIndex:
                slot.zIndex,
            },
            "promote",
          );

          timeline.to(
            element,
            {
              x: slot.x,
              y: slot.y,
              z: slot.z,
              duration:
                animationConfig
                  .moveDuration,
              ease:
                animationConfig
                  .ease,
            },
            `promote+=${
              position * 0.12
            }`,
          );
        },
      );

      const backSlot =
        makeSlot(
          total - 1,
          cardDistance,
          verticalDistance,
          total,
        );

      timeline.addLabel(
        "return",
        `promote+=${
          animationConfig
            .moveDuration *
          animationConfig
            .returnDelay
        }`,
      );

      timeline.call(
        () => {
          gsap.set(
            frontElement,
            {
              zIndex:
                backSlot.zIndex,
            },
          );
        },
        undefined,
        "return",
      );

      timeline.to(
        frontElement,
        {
          x: backSlot.x,
          y: backSlot.y,
          z: backSlot.z,
          opacity: 1,
          duration:
            animationConfig
              .returnDuration,
          ease:
            animationConfig.ease,
        },
        "return",
      );

      timeline.call(() => {
        order.current = [
          ...remainingIndexes,
          frontCardIndex,
        ];
      });
    }

    function startAutomaticSwap():
      void {
      if (
        intervalRef.current !==
        null
      ) {
        window.clearInterval(
          intervalRef.current,
        );
      }

      intervalRef.current =
        window.setInterval(
          swapCards,
          delay,
        );
    }

    function pauseAnimation():
      void {
      timelineRef.current?.pause();

      if (
        intervalRef.current !==
        null
      ) {
        window.clearInterval(
          intervalRef.current,
        );

        intervalRef.current =
          null;
      }
    }

    function resumeAnimation():
      void {
      timelineRef.current?.play();
      startAutomaticSwap();
    }

    startAutomaticSwap();

    const container =
      containerRef.current;

    if (
      pauseOnHover &&
      container
    ) {
      container.addEventListener(
        "mouseenter",
        pauseAnimation,
      );

      container.addEventListener(
        "mouseleave",
        resumeAnimation,
      );
    }

    return () => {
      if (
        intervalRef.current !==
        null
      ) {
        window.clearInterval(
          intervalRef.current,
        );
      }

      timelineRef.current?.kill();

      references.forEach(
        (reference) => {
          if (
            reference.current
          ) {
            gsap.killTweensOf(
              reference.current,
            );
          }
        },
      );

      if (
        pauseOnHover &&
        container
      ) {
        container.removeEventListener(
          "mouseenter",
          pauseAnimation,
        );

        container.removeEventListener(
          "mouseleave",
          resumeAnimation,
        );
      }
    };
  }, [
    references,
    cardDistance,
    verticalDistance,
    delay,
    pauseOnHover,
    skewAmount,
    easing,
  ]);

  const renderedChildren =
    childArray.map(
      (child, index) => {
        if (
          !isValidElement<CardProps>(
            child,
          )
        ) {
          return child;
        }

        return cloneElement(
          child,
          {
            key: index,

            ref:
              references[index],

            style: {
              width,
              height,
              ...child.props.style,
            },

            onClick: (
              event,
            ) => {
              child.props
                .onClick?.(
                  event,
                );

              onCardClick?.(
                index,
              );
            },
          } as CardProps &
            RefAttributes<HTMLDivElement>,
        );
      },
    );

  return (
    <div
      className="about-card-swap-container"
      ref={containerRef}
      style={{
        width,
        height,
      }}
    >
      {renderedChildren}
    </div>
  );
}

export default CardSwap;