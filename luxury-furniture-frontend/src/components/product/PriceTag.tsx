import { formatPrice } from "../../lib/currency";
import { hasOffer, type Pricing } from "../../lib/pricing";

interface PriceTagProps {
  pricing: Pricing;

  /** Larger treatment for the product detail page. */
  size?: "card" | "detail";

  /** Shows the absolute rupee saving alongside the percentage. */
  showSaving?: boolean;
}

/**
 * Price display with an optional struck-through former price.
 *
 * The live price is always the prominent figure. `<s>` marks the former
 * price so assistive technology announces it as no longer applicable,
 * and the accessible label spells the relationship out.
 */
function PriceTag({
  pricing,
  size = "card",
  showSaving = false,
}: PriceTagProps) {
  const onOffer = hasOffer(pricing);

  if (!onOffer) {
    return (
      <p className={`price-tag price-tag-${size}`}>
        <span className="price-now">{formatPrice(pricing.pricePaise)}</span>
      </p>
    );
  }

  return (
    <p className={`price-tag price-tag-${size} is-on-offer`}>
      <span className="price-now">{formatPrice(pricing.pricePaise)}</span>

      <s className="price-was">
        {formatPrice(pricing.compareAtPaise as number)}
      </s>

      <span className="price-off">{pricing.discountPercent}% off</span>

      {showSaving && (
        <span className="price-saving">
          You save {formatPrice(pricing.savingPaise)}
        </span>
      )}

      <span className="visually-hidden">
        Reduced from {formatPrice(pricing.compareAtPaise as number)} to{" "}
        {formatPrice(pricing.pricePaise)}.
      </span>
    </p>
  );
}

export default PriceTag;
