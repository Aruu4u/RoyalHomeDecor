/* =========================================================
   OFFER PRICING

   Offers are now managed by the administrator and calculated on the
   server, which is the only place that can be trusted with money: the
   cart and checkout apply the same discount, so the price shown here is
   the price charged.

   This module only reads what the API already computed. The one
   exception is variant pricing on the product detail page, where the
   server's percentage is applied to the selected variant's price using
   the same rounding rule as the backend.
   ========================================================= */

export interface Pricing {
  /** The amount charged, in paise. */
  pricePaise: number;

  /** Price before the offer, or null when nothing is on offer. */
  compareAtPaise: number | null;

  /** Whole-percent saving. 0 when there is no offer. */
  discountPercent: number;

  /** Absolute saving in paise. 0 when there is no offer. */
  savingPaise: number;

  label: string | null;
}

/** Shape of the offer fields every product response carries. */
export interface OfferBearingProduct {
  base_price_paise: number;
  offer_label?: string | null;
  offer_discount_percent?: number | null;
  offer_price_paise?: number | null;
}

function noOffer(pricePaise: number): Pricing {
  return {
    pricePaise,
    compareAtPaise: null,
    discountPercent: 0,
    savingPaise: 0,
    label: null,
  };
}

/**
 * Applies a percentage the same way the backend does.
 *
 * Integer paise with half-up rounding, matching
 * `app/services/offer_pricing.apply_discount`. Kept identical so a
 * variant price shown here cannot differ from what checkout charges.
 */
export function applyPercent(pricePaise: number, percent: number): number {
  if (percent <= 0 || pricePaise <= 0) {
    return pricePaise;
  }

  return Math.round((pricePaise * (100 - percent)) / 100);
}

/**
 * Pricing for a product card, taken straight from the API.
 */
export function resolveProductPricing(product: OfferBearingProduct): Pricing {
  const percent = product.offer_discount_percent ?? 0;
  const offerPrice = product.offer_price_paise;

  if (percent <= 0 || offerPrice == null) {
    return noOffer(product.base_price_paise);
  }

  return {
    pricePaise: offerPrice,
    compareAtPaise: product.base_price_paise,
    discountPercent: percent,
    savingPaise: product.base_price_paise - offerPrice,
    label: product.offer_label ?? null,
  };
}

/**
 * Pricing for a specific variant on the detail page.
 *
 * The offer percentage is defined per product, so it applies to whichever
 * variant is selected rather than only to the base price.
 */
export function resolveVariantPricing(
  variantPricePaise: number,
  product: OfferBearingProduct,
): Pricing {
  const percent = product.offer_discount_percent ?? 0;

  if (percent <= 0) {
    return noOffer(variantPricePaise);
  }

  const discounted = applyPercent(variantPricePaise, percent);

  return {
    pricePaise: discounted,
    compareAtPaise: variantPricePaise,
    discountPercent: percent,
    savingPaise: variantPricePaise - discounted,
    label: product.offer_label ?? null,
  };
}

/** True when the product has a live offer. */
export function hasOffer(pricing: Pricing): boolean {
  return pricing.compareAtPaise !== null && pricing.discountPercent > 0;
}
