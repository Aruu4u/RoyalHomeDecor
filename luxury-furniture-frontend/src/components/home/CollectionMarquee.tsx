import { Link } from "react-router-dom";

import { customCollectionImage } from "../../config/siteImages";
import SmartImage from "../ui/SmartImage";
import type { Collection } from "../../types/collection";

interface CollectionMarqueeProps {
  collections: Collection[];
  isLoading: boolean;
}

/** Enough copies that the rail stays full even with only a few collections. */
const MIN_CARDS_PER_LOOP = 8;

/**
 * Continuously scrolling collection rail.
 *
 * The track holds two identical halves and translates by exactly -50%,
 * so the loop is seamless. It runs entirely in CSS on the compositor:
 * no scroll listeners, no rAF loop, no layout thrash.
 *
 * Hovering or focusing pauses it so a shopper can actually read and
 * click a card, which is the usual failing of marquees.
 */
function CollectionMarquee({ collections, isLoading }: CollectionMarqueeProps) {
  if (isLoading) {
    return (
      <div aria-hidden="true" className="marquee">
        <div className="marquee-track is-static">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="skeleton collection-card-skeleton" key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (collections.length === 0) {
    return null;
  }

  /*
   * Repeat the source list until there are enough cards for a full
   * loop, then render that sequence twice to form the two halves.
   */
  const loop: Collection[] = [];

  while (loop.length < MIN_CARDS_PER_LOOP) {
    loop.push(...collections);
  }

  function renderCard(collection: Collection, index: number, clone: boolean) {
    return (
      <Link
        aria-hidden={clone ? "true" : undefined}
        className="collection-card"
        key={`${clone ? "clone" : "card"}-${collection.id}-${index}`}
        tabIndex={clone ? -1 : undefined}
        to={`/collections/${collection.slug}`}
      >
        <span className="collection-card-media">
          <SmartImage
            alt={clone ? "" : collection.name}
            fallbackLabel={collection.name}
            /* If no custom file exists, use whatever admin set. */
            fallbackSrc={collection.hero_image_url}
            ratio="3 / 4"
            sizes="290px"
            src={customCollectionImage(collection.slug)}
          />
        </span>

        <span className="collection-card-body">
          <span className="collection-card-name">{collection.name}</span>

          <span className="collection-card-cta">
            Explore
            <svg
              aria-hidden="true"
              fill="none"
              height="10"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 14 12"
              width="12"
            >
              <path d="M1 6h11M8 2l4 4-4 4" />
            </svg>
          </span>
        </span>
      </Link>
    );
  }

  return (
    <div className="marquee">
      <div className="marquee-track">
        <div className="marquee-half">
          {loop.map((collection, index) => renderCard(collection, index, false))}
        </div>

        {/* Second half is decorative: it exists only to close the loop. */}
        <div className="marquee-half">
          {loop.map((collection, index) => renderCard(collection, index, true))}
        </div>
      </div>
    </div>
  );
}

export default CollectionMarquee;
