import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

import { formatPrice } from "../../lib/currency";
import type { OfferSection } from "../../types/offer";
import Carousel from "../ui/Carousel";
import Reveal from "../ui/Reveal";
import SmartImage from "../ui/SmartImage";

interface OfferSectionBlockProps {
  section: OfferSection;
}

/**
 * A themed promotional section, for example a Diwali or Christmas sale.
 *
 * Renders nothing when the section has no purchasable products, so an
 * empty or fully sold-out promotion leaves the page exactly as it would
 * be without it.
 *
 * All prices come from the API already discounted. Nothing here does
 * arithmetic on money.
 */
function OfferSectionBlock({ section }: OfferSectionBlockProps) {
  if (section.items.length === 0) {
    return null;
  }

  /*
   * Preset themes are styled in CSS by data-theme. Any colour the
   * administrator supplied overrides the preset through these custom
   * properties, which is what makes the "custom" theme work.
   */
  const themeStyle: CSSProperties = {
    ...(section.background_color
      ? { ["--offer-bg" as string]: section.background_color }
      : {}),
    ...(section.accent_color
      ? { ["--offer-accent" as string]: section.accent_color }
      : {}),
    ...(section.text_color
      ? { ["--offer-text" as string]: section.text_color }
      : {}),
  };

  const topDiscount = section.items.reduce(
    (highest, item) => Math.max(highest, item.discount_percent),
    0,
  );

  return (
    <section
      aria-labelledby={`offer-${section.slug}`}
      className="offer-section"
      data-theme={section.theme}
      style={themeStyle}
    >
      {section.background_image_url && (
        <div
          aria-hidden="true"
          className="offer-section-media"
          style={{
            backgroundImage: `url("${section.background_image_url}")`,
          }}
        />
      )}

      <div aria-hidden="true" className="offer-section-glow" />

      <div className="shell offer-section-inner">
        <Reveal className="offer-section-head">
          <div className="offer-section-heading">
            {section.badge_label && (
              <span className="offer-badge">
                <span aria-hidden="true" className="offer-badge-spark" />
                {section.badge_label}
              </span>
            )}

            <h2 className="offer-section-title" id={`offer-${section.slug}`}>
              {section.title}
            </h2>

            {section.subtitle && (
              <p className="offer-section-subtitle">{section.subtitle}</p>
            )}
          </div>

          {topDiscount > 0 && (
            <p className="offer-section-headline">
              <span className="offer-section-headline-value">
                Up to {topDiscount}%
              </span>
              <span className="offer-section-headline-label">off</span>
            </p>
          )}
        </Reveal>

        <Reveal>
          <Carousel
            ariaLabel={`${section.title} products`}
            trackClassName="carousel-rail"
          >
            {section.items.map((item) => (
              <article className="offer-card" key={item.id}>
                <Link
                  className="offer-card-media"
                  to={`/products/${item.product.slug}`}
                >
                  <SmartImage
                    alt={item.product.name}
                    fallbackLabel={item.product.name}
                    ratio="4 / 5"
                    sizes="(max-width: 560px) 78vw, 300px"
                    src={item.product.thumbnail_url}
                  />

                  <span className="offer-card-flag">
                    {item.discount_percent}% off
                  </span>
                </Link>

                <div className="offer-card-body">
                  <h3 className="offer-card-title">
                    <Link to={`/products/${item.product.slug}`}>
                      {item.product.name}
                    </Link>
                  </h3>

                  <p className="offer-card-price">
                    <span className="offer-card-now">
                      {formatPrice(item.product.offer_price_paise)}
                    </span>

                    <s className="offer-card-was">
                      {formatPrice(item.product.base_price_paise)}
                    </s>
                  </p>

                  <p className="offer-card-saving">
                    You save {formatPrice(item.product.saving_paise)}
                  </p>
                </div>
              </article>
            ))}
          </Carousel>
        </Reveal>
      </div>
    </section>
  );
}

export default OfferSectionBlock;
