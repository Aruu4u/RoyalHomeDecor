import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import CollectionMarquee from "../../components/home/CollectionMarquee";
import OfferSectionBlock from "../../components/home/OfferSectionBlock";
import ProductCard from "../../components/product/ProductCard";
import Accordion from "../../components/ui/Accordion";
import Carousel from "../../components/ui/Carousel";
import { ProductGridSkeleton } from "../../components/ui/Feedback";
import Reveal from "../../components/ui/Reveal";
import SectionHeading from "../../components/ui/SectionHeading";
import SmartImage from "../../components/ui/SmartImage";
import Toast, { type ToastMessage } from "../../components/ui/Toast";
import { useFirstLoadableImage } from "../../hooks/useFirstLoadableImage";
import {
  useCollectionNames,
  useCollections,
  useProducts,
} from "../../hooks/useCatalogue";
import { SITE_IMAGES, withCustomFirst } from "../../config/siteImages";
import { useAsync } from "../../hooks/useAsync";
import { usableImageUrls } from "../../lib/imageCandidates";
import { offerService } from "../../services/offers";
import { hasOffer, resolveProductPricing } from "../../lib/pricing";
import type { Product } from "../../types/product";
import heroFallback from "../../assets/hero.png";
import { FAQ_ITEMS, TESTIMONIALS, TRUST_POINTS } from "./homeContent";

import "../../components/home/marquee.css";
import "../../components/home/offer-section.css";
import "./home.css";

const NEW_ARRIVAL_WINDOW_DAYS = 45;

function isRecent(product: Product): boolean {
  const created = new Date(product.created_at).getTime();
  const cutoff = Date.now() - NEW_ARRIVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return created >= cutoff;
}

function HomePage() {
  const [feedback, setFeedback] = useState<ToastMessage | null>(null);

  const { data: collections, isLoading: isLoadingCollections } =
    useCollections();

  /*
   * Active offer sections. A failure here is deliberately non-fatal: the
   * rest of the home page still renders, it simply shows no promotion.
   */
  const { data: offerSections } = useAsync(
    useCallback(
      (signal: AbortSignal) => offerService.listSections({ signal }),
      [],
    ),
    [],
    "Offers are unavailable just now.",
  );

  const collectionNames = useCollectionNames(collections);

  /*
   * Four queries cover the whole page, each a real backend filter rather
   * than a slice of one big response:
   *
   *   Recommended  - the curated rail
   *   catalogue    - new arrivals, and the padding for best selling
   *   mostSold     - ranked from actual order lines, which only the
   *                  database can work out
   *   onOffer      - every discounted piece, for the offers strip
   *
   * They are all cached and deduplicated by `catalogueCache`, so this is
   * four requests on a cold load and none on a return visit.
   */
  const { data: Recommended, isLoading: isLoadingRecommended } = useProducts(
    useMemo(() => ({ recommendedOnly: true, limit: 12 }), []),
  );

  const { data: catalogue, isLoading: isLoadingCatalogue } = useProducts(
    useMemo(() => ({ limit: 24 }), []),
  );

  const { data: mostSold, isLoading: isLoadingMostSold } = useProducts(
    useMemo(() => ({ orderBy: "most_sold" as const, limit: 16 }), []),
  );

  /*
   * Every piece currently discounted, whether by its own offer or through
   * an offer section. Expired offers are excluded by the server, so an
   * empty result genuinely means nothing is on sale.
   */
  const { data: onOffer, isLoading: isLoadingOnOffer } = useProducts(
    useMemo(() => ({ inOffer: true, limit: 16 }), []),
  );

  /*
   * Hero artwork is resolved from the catalogue rather than a bundled
   * asset. Landscape collection banners are tried first because they
   * suit a full-bleed crop, then product photography as a backstop.
   * Placeholder and dead-host URLs are filtered out beforehand.
   */
  const heroCandidates = useMemo(
    () =>
      usableImageUrls(
        /* A custom hero wins; catalogue art is the safety net. */
        withCustomFirst(SITE_IMAGES.hero, [
          ...(collections ?? []).map((collection) => collection.hero_image_url),
          ...(Recommended ?? []).map((product) => product.thumbnail_url),
          ...(catalogue ?? []).map((product) => product.thumbnail_url),
        ]),
      ),
    [collections, Recommended, catalogue],
  );

  const heroImage = useFirstLoadableImage(heroCandidates);

  /* The API sorts by is_recommended then created_at; newest first here. */
  const newArrivals = useMemo(() => {
    if (!catalogue) {
      return [];
    }

    return [...catalogue]
      .sort(
        (first, second) =>
          new Date(second.created_at).getTime() -
          new Date(first.created_at).getTime(),
      )
      .slice(0, 8);
  }, [catalogue]);

  /*
   * Discounted pieces lead the best-selling rail, so the offers are the
   * first thing a shopper sees rather than being buried mid-grid.
   */
  /* Averaged from the reviews actually displayed, so the two agree. */
  const averageRating = useMemo(() => {
    if (TESTIMONIALS.length === 0) {
      return 0;
    }

    const total = TESTIMONIALS.reduce(
      (sum, testimonial) => sum + testimonial.rating,
      0,
    );

    return total / TESTIMONIALS.length;
  }, []);

  /*
   * Best selling leads with pieces that genuinely sell, then falls back
   * to the rest of the catalogue to fill the row.
   *
   * The ranking comes from `order_by=most_sold`, which counts units on
   * real order lines and ignores cancelled orders. That list can be short
   * or empty on a young catalogue, and a rail with two cards in it looks
   * broken, so default picks top it up to a full row. The order is
   * preserved: anything that has actually sold still comes first.
   *
   * Recommended pieces are excluded because they have their own section
   * further down, and showing the same product twice on one page wastes
   * the slot and makes the catalogue look smaller than it is.
   */
  const bestSelling = useMemo(() => {
    const eligible = (product: Product) => !product.is_recommended;

    const ranked = (mostSold ?? []).filter(eligible);

    const seen = new Set(ranked.map((product) => product.id));

    const padding = (catalogue ?? []).filter(
      (product) => eligible(product) && !seen.has(product.id),
    );

    return [...ranked, ...padding].slice(0, 8);
  }, [mostSold, catalogue]);

  /* True once the rail has something to show, or has finished trying. */
  const isLoadingBestSelling = isLoadingMostSold && isLoadingCatalogue;

  /*
   * Discounted pieces, ordered by the size of the saving so the strongest
   * offer leads. Filtered again on `hasOffer` rather than trusted
   * blindly: the query and the render happen at different moments, and a
   * piece whose offer lapsed in between should quietly drop out instead
   * of appearing under an offers heading at full price.
   */
  const offerProducts = useMemo(() => {
    return (onOffer ?? [])
      .filter((product) => hasOffer(resolveProductPricing(product)))
      .sort(
        (first, second) =>
          (second.offer_discount_percent ?? 0) -
          (first.offer_discount_percent ?? 0),
      )
      .slice(0, 12);
  }, [onOffer]);

  /* Headline saving, used in the offers section description. */
  const topDiscount = useMemo(() => {
    let best = 0;

    for (const product of offerProducts) {
      const pricing = resolveProductPricing(product);

      if (pricing.discountPercent > best) {
        best = pricing.discountPercent;
      }
    }

    return best;
  }, [offerProducts]);

  function handleFeedback(message: string, isError: boolean): void {
    setFeedback({ message, isError });
  }

  return (
    <div className="home page-enter">
      <Toast onDismiss={() => setFeedback(null)} toast={feedback} />

      {/* ================= HERO ================= */}

      <section className="hero">
        {/*
          The gradient backdrop is always painted, so the hero looks
          finished from the first frame and never flashes empty while
          the photograph is still resolving.
        */}
        <div aria-hidden="true" className="hero-backdrop" />

        {/*
          Bundled fallback texture. The asset is only 343x361, far too
          small to fill a banner sharply, so it is blurred and scaled and
          used purely as a photographic wash. It guarantees the hero has
          depth even when the catalogue is unreachable, and the real
          photograph fades in over the top once one resolves.
        */}
        <div
          aria-hidden="true"
          className="hero-fallback"
          style={{ backgroundImage: `url("${heroFallback}")` }}
        />

        {heroImage && (
          <div
            aria-hidden="true"
            className="hero-media is-ready"
            style={{ backgroundImage: `url("${heroImage}")` }}
          />
        )}

        <div aria-hidden="true" className="hero-scrim" />

        <div className="shell hero-inner">
          <p className="eyebrow hero-eyebrow">Handcrafted in India</p>

          <h1 className="hero-title">
            Pieces made
            <span className="hero-title-accent"> by hand,</span>
            <br />
            kept for decades
          </h1>

          <p className="hero-copy">
            Marble, brass and resin furniture finished in small workshops
            in Moradabad and Jaipur. Cut, poured, polished and packed by
            the same hands that shaped it.
          </p>

          <div className="hero-actions">
            <Link className="btn btn-lg btn-gold" to="/shop">
              Shop the collection
            </Link>

            <a className="btn btn-lg hero-secondary" href="#collections">
              Browse categories
            </a>
          </div>

          <dl className="hero-stats">
            <div>
              <dt>2,400+</dt>
              <dd>Homes furnished</dd>
            </div>

            <div>
              <dt>4.9 / 5</dt>
              <dd>Average rating</dd>
            </div>

            <div>
              <dt>Pan India</dt>
              <dd>Crated delivery</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ================= TRUST STRIP ================= */}

      <section className="trust-strip">
        <div className="shell trust-strip-inner">
          {TRUST_POINTS.map((point, index) => (
            <Reveal className="trust-point" delay={index * 60} key={point.title}>
              <span aria-hidden="true" className="trust-icon">
                {point.icon}
              </span>

              <div>
                <h3>{point.title}</h3>
                <p>{point.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= COLLECTIONS (moving rail) ================= */}

      <section className="section section-sunk collections-section" id="collections">
        <div className="shell">
          <Reveal>
            <SectionHeading
              align="center"
              description="Each collection is built around a single material and the technique it demands."
              eyebrow="Crafted with care"
              title="Shop by collection"
            />
          </Reveal>
        </div>

        <Reveal>
          <CollectionMarquee
            collections={collections ?? []}
            isLoading={isLoadingCollections}
          />
        </Reveal>

        <div className="shell collections-section-foot">
          <Link className="link-underline" to="/shop">
            Browse every piece
          </Link>
        </div>
      </section>

      {/* ================= SPECIAL OFFERS ================= */}

      {/*
        Sits directly after the collections rail. The API only returns
        active sections, so when every offer is hidden this renders
        nothing at all and the page reads exactly as it did before the
        feature existed.
      */}
      {(offerSections ?? []).map((section) => (
        <OfferSectionBlock key={section.id} section={section} />
      ))}

      {/* ================= EVERYTHING ON OFFER ================= */}

      {/*
        Follows the collections rail and any themed offer sections, and
        gathers every discounted piece in one place regardless of where the
        discount came from.

        The whole section is omitted when nothing is on offer, rather than
        rendered with an empty grid or an apology. While it is still
        loading nothing is shown either: a skeleton would promise a section
        that may turn out not to exist, and the page would jump when it
        vanished.
      */}
      {!isLoadingOnOffer && offerProducts.length > 0 && (
        <section className="section shell offers-strip">
          <Reveal>
            <SectionHeading
              actionLabel="See every offer"
              actionTo="/shop?offers=true"
              description={
                topDiscount > 0
                  ? `Currently reduced, with savings of up to ${topDiscount}%. Prices shown are what you pay at checkout.`
                  : "Currently reduced. Prices shown are what you pay at checkout."
              }
              eyebrow="On offer now"
              title="Current offers"
            />
          </Reveal>

          <Reveal>
            <Carousel ariaLabel="Products on offer" trackClassName="carousel-rail">
              {offerProducts.map((product) => (
                <ProductCard
                  collectionName={collectionNames.get(product.collection_id)}
                  key={product.id}
                  onFeedback={handleFeedback}
                  product={product}
                />
              ))}
            </Carousel>
          </Reveal>
        </section>
      )}

      {/* ================= BEST SELLING ================= */}

      <section className="section shell">
        <Reveal>
          <SectionHeading
            actionLabel="Shop all"
            actionTo="/shop?sort=best-selling"
            description="Ranked by what our customers actually order, topped up with pieces worth a look."
            eyebrow="Most loved"
            title="Best selling"
          />
        </Reveal>

        {isLoadingBestSelling ? (
          <ProductGridSkeleton count={8} />
        ) : (
          <div className="product-grid">
            {bestSelling.map((product, index) => (
              <Reveal delay={(index % 4) * 60} key={product.id}>
                <ProductCard
                  collectionName={collectionNames.get(product.collection_id)}
                  onFeedback={handleFeedback}
                  product={product}
                />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* ================= Recommended ================= */}

      <section className="section shell">
        <Reveal>
          <SectionHeading
            actionLabel="View all"
            actionTo="/shop?recommended=true"
            description="A rotating selection of the pieces our artisans are proudest of this season."
            eyebrow="Curated"
            title="Recommended pieces"
          />
        </Reveal>

        {isLoadingRecommended ? (
          <ProductGridSkeleton count={4} />
        ) : Recommended && Recommended.length > 0 ? (
          <Reveal>
            <Carousel ariaLabel="Recommended pieces" trackClassName="carousel-rail">
              {Recommended.map((product) => (
                <ProductCard
                  collectionName={collectionNames.get(product.collection_id)}
                  key={product.id}
                  onFeedback={handleFeedback}
                  product={product}
                />
              ))}
            </Carousel>
          </Reveal>
        ) : (
          <p className="muted-text">
            Recommended pieces are being restocked. Explore the full catalogue
            in the meantime.
          </p>
        )}
      </section>

      {/* ================= NEW ARRIVALS ================= */}

      {newArrivals.length > 0 && (
        <section className="section shell">
          <Reveal>
            <SectionHeading
              actionLabel="Shop all"
              actionTo="/shop"
              description="Fresh out of the workshop and ready to ship."
              eyebrow="Arrivals"
              title="New this season"
            />
          </Reveal>

          <Reveal>
            <Carousel ariaLabel="New arrivals" trackClassName="carousel-rail">
              {newArrivals.map((product) => (
                <ProductCard
                  collectionName={collectionNames.get(product.collection_id)}
                  isNew={isRecent(product)}
                  key={product.id}
                  onFeedback={handleFeedback}
                  product={product}
                />
              ))}
            </Carousel>
          </Reveal>
        </section>
      )}

      {/* ================= WHAT WE MAKE ================= */}

      <section className="section story">
        <div className="shell story-inner">
          <Reveal className="story-media">
            <SmartImage
              alt="An artisan polishing a marble table top by hand"
              fallbackLabel="In the workshop"
              /* Falls back to catalogue art if the custom file is absent. */
              fallbackSrc={heroCandidates[1] ?? heroCandidates[0] ?? null}
              ratio="4 / 5"
              src={SITE_IMAGES.workshop}
            />
          </Reveal>

          <Reveal className="story-body" delay={80}>
            <p className="eyebrow">Our workshop</p>

            <h2 className="story-title">
              Six pairs of hands touch every table
            </h2>

            <p className="lede">
              A marble top is quarried, cut, ground, honed and hand-polished
              before it ever meets its frame. The brass is bent cold, brazed,
              then buffed to a warm satin finish. Nothing is stamped out, so
              the veining in your piece belongs only to you.
            </p>

            <ul className="story-points">
              <li>Natural stone, never reconstituted composite</li>
              <li>Solid brass and powder-coated steel frames</li>
              <li>Felt-padded feet fitted before crating</li>
              <li>Protective wooden crate on every shipment</li>
            </ul>

            <Link className="btn btn-outline" to="/shop">
              See what we make
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ================= TESTIMONIALS ================= */}

      <section className="section reviews-section">
        <div className="shell">
          <Reveal className="reviews-header">
            <p className="eyebrow reviews-eyebrow">Reviews</p>

            <h2 className="reviews-title">What our customers say</h2>

            {/* Aggregate rating, computed from the reviews shown below. */}
            <div className="reviews-score">
              <span className="reviews-score-value">
                {averageRating.toFixed(1)}
              </span>

              <span className="reviews-score-detail">
                <span
                  aria-label={`${averageRating.toFixed(1)} out of 5 stars`}
                  className="reviews-score-stars"
                  role="img"
                >
                  {"\u2605".repeat(Math.round(averageRating))}
                </span>

                <span className="reviews-score-count">
                  from {TESTIMONIALS.length} verified buyers
                </span>
              </span>
            </div>

            <p className="reviews-lede">
              Real stories from homes across India, in their own words.
            </p>
          </Reveal>

          <Reveal>
            <Carousel
              ariaLabel="Customer reviews"
              trackClassName="testimonial-rail"
            >
              {TESTIMONIALS.map((testimonial) => (
                <figure className="testimonial" key={testimonial.name}>
                  <div className="testimonial-head">
                    <span aria-hidden="true" className="testimonial-avatar">
                      {testimonial.name.charAt(0)}
                    </span>

                    <div>
                      <p className="testimonial-name">
                        {testimonial.name}

                        <span className="testimonial-verified">
                          Verified buyer
                        </span>
                      </p>

                      <p className="testimonial-location">
                        {testimonial.location}
                      </p>
                    </div>
                  </div>

                  {/* Always five glyphs, so a 4-star rating reads as 4 of 5. */}
                  <div
                    aria-label={`${testimonial.rating} out of 5 stars`}
                    className="testimonial-stars"
                    role="img"
                  >
                    <span className="testimonial-stars-filled">
                      {"\u2605".repeat(testimonial.rating)}
                    </span>

                    <span className="testimonial-stars-empty">
                      {"\u2605".repeat(5 - testimonial.rating)}
                    </span>
                  </div>

                  <blockquote className="testimonial-quote">
                    <span aria-hidden="true" className="testimonial-mark">
                      &ldquo;
                    </span>
                    {testimonial.quote}
                  </blockquote>

                  <figcaption className="testimonial-product">
                    {testimonial.product}
                  </figcaption>
                </figure>
              ))}
            </Carousel>
          </Reveal>
        </div>
      </section>

      {/* ================= FAQ ================= */}

      <section className="section shell faq-section">
        <Reveal className="faq-intro">
          <p className="eyebrow">Good to know</p>

          <h2 className="section-heading-title">Frequently asked questions</h2>

          <p className="lede">
            Still unsure about something? Anything not covered here, our
            team is happy to answer.
          </p>
        </Reveal>

        <Reveal className="faq-body" delay={80}>
          <Accordion items={FAQ_ITEMS} />
        </Reveal>
      </section>

      {/* ================= CLOSING COPY ================= */}

      <section className="section shell">
        <Reveal className="closing-copy">
          <h2 className="closing-title">
            Handcrafted furniture &amp; home decor, made in India
          </h2>

          <div className="closing-columns">
            <p>
              Royal Home Decor works directly with artisan families rather
              than factories. That means shorter runs, natural material
              variation and a finish you can inspect up close. Marble tops
              arrive with their own veining. Brass develops a patina. Resin
              rivers are poured once and never repeated.
            </p>

            <p>
              Every order ships in a purpose-built wooden crate with corner
              protection, and shipping is free once your basket passes
              &#8377;500. If a piece is not right for the room, you have
              three days from delivery to start a return.
            </p>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

export default HomePage;
