import {
  useMemo,
} from "react";

import type {
  Collection,
} from "../../types/collection";

import CardSwap, {
  Card,
} from "./CardSwap";

import "./AboutUsSection.css";

interface AboutUsSectionProps {
  collections: Collection[];
}

interface AboutCardItem {
  number: string;
  title: string;
  description: string;
  imageUrl: string | null;
  collectionSlug: string | null;
}

const aboutCardCopy = [
  {
    number: "01",
    title:
      "Curated with intention",

    description:
      "Every piece is selected for proportion, material richness and lasting visual presence.",
  },
  {
    number: "02",
    title:
      "Made for refined homes",

    description:
      "Our collections balance modern restraint with warm, expressive details.",
  },
  {
    number: "03",
    title:
      "Quiet luxury, every day",

    description:
      "We choose furniture and décor that feel special without overpowering the room.",
  },
];

function AboutUsSection({
  collections,
}: AboutUsSectionProps) {
  const cards =
    useMemo<AboutCardItem[]>(
      () => {
        const activeCollections =
          collections.filter(
            (collection) =>
              collection.is_active,
          );

        return aboutCardCopy.map(
          (card, index) => {
            const collection =
              activeCollections[
                index %
                  Math.max(
                    activeCollections.length,
                    1,
                  )
              ];

            return {
              ...card,

              imageUrl:
                collection
                  ?.hero_image_url ??
                null,

              collectionSlug:
                collection?.slug ??
                null,
            };
          },
        );
      },
      [collections],
    );

  function handleCardClick(
    index: number,
  ): void {
    const slug =
      cards[index]
        ?.collectionSlug;

    if (!slug) {
      return;
    }

    document
      .getElementById(
        `collection-${slug}`,
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  return (
    <section
      className="about-luxury-section"
      id="about"
    >
      <div className="about-luxury-glow" />

      <div className="about-luxury-inner">
        <div className="about-luxury-copy">
          <p className="about-luxury-eyebrow">
            About us
          </p>

          <h2>
            Homes should feel collected,
            calm and unmistakably personal.
          </h2>

          <span className="about-luxury-line" />

          <p>
            Royal Home Decor brings
            together thoughtfully selected
            mirrors, wall décor, side
            tables and centre tables for
            elegant modern interiors.
          </p>

          <p>
            We focus on pieces with
            sculptural form, beautiful
            finishes and a timeless
            quality—objects that do more
            than fill a space. They shape
            how the room feels.
          </p>

          <div className="about-luxury-values">
            <article>
              <strong>
                Curated
              </strong>

              <span>
                Not mass selected
              </span>
            </article>

            <article>
              <strong>
                Refined
              </strong>

              <span>
                Designed to endure
              </span>
            </article>

            <article>
              <strong>
                Personal
              </strong>

              <span>
                Made for real homes
              </span>
            </article>
          </div>

          <a
            className="about-luxury-link"
            href="#collections"
          >
            Discover our collections

            <span aria-hidden="true">
              →
            </span>
          </a>
        </div>

        <div
          aria-label="Royal Home Decor values"
          className="about-luxury-cards"
        >
          <CardSwap
            cardDistance={54}
            delay={4200}
            easing="linear"
            height={450}
            onCardClick={
              handleCardClick
            }
            pauseOnHover
            skewAmount={2}
            verticalDistance={48}
            width={510}
          >
            {cards.map(
              (card) => (
                <Card
                  className="about-story-card"
                  key={card.number}
                  tabIndex={0}
                >
                  {card.imageUrl && (
                    <img
  alt=""
  aria-hidden="true"
  decoding="async"
  loading="eager"
  src={card.imageUrl}
/>
                  )}

                  <div className="about-story-card-overlay" />

                  <div className="about-story-card-content">
                    <span>
                      {card.number}
                    </span>

                    <h3>
                      {card.title}
                    </h3>

                    <p>
                      {
                        card.description
                      }
                    </p>

                    <small>
                      Explore the collection
                    </small>
                  </div>
                </Card>
              ),
            )}
          </CardSwap>

          <p className="about-card-instruction">
           
          </p>
        </div>
      </div>
    </section>
  );
}

export default AboutUsSection;