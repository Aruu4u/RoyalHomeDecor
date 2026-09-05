/*
 * Mirrors app/schemas/offer.py.
 *
 * All money is integer paise. Discounted prices are calculated on the
 * server and sent here ready to display, so the frontend never derives
 * a price from a percentage.
 */

/*
 * Free text, not a fixed union. Administrators name their own occasions,
 * so any short label is valid. A handful of well-known values have
 * styling presets in the storefront; anything else uses the colours
 * stored on the section.
 */
export type OfferTheme = string;

/** Themes with a built-in colour preset, offered as quick suggestions. */
export const THEME_SUGGESTIONS: string[] = [
  "diwali",
  "holi",
  "christmas",
  "new-year",
  "summer",
  "monsoon",
  "wedding",
  "clearance",
];

/** Product as it appears inside an offer section. */
export interface OfferProduct {
  id: string;
  collection_id: string;

  name: string;
  slug: string;
  short_description: string;

  thumbnail_url: string | null;

  top_material: string | null;
  base_material: string | null;
  finish: string | null;

  colour: string | null;
  style: string | null;

  is_active: boolean;
  is_recommended: boolean;

  /** So an offer card can disable buying rather than fail on click. */
  in_stock: boolean;
  available_quantity: number;

  /** Price before the offer. */
  base_price_paise: number;

  /** What the customer pays while the offer runs. */
  offer_price_paise: number;

  discount_percent: number;
  saving_paise: number;
}

export interface OfferItem {
  id: string;
  section_id: string;
  product_id: string;

  discount_percent: number;

  /** Null means this entry never expires. */
  ends_at: string | null;

  /**
   * Whether the entry is inside its window right now, decided by the
   * server. Trusted rather than recomputed here so a wrong device clock
   * cannot disagree with what the customer is actually charged.
   */
  is_live: boolean;

  display_order: number;

  product: OfferProduct;

  created_at: string;
  updated_at: string;
}

export interface OfferSection {
  id: string;

  title: string;
  slug: string;
  subtitle: string | null;

  theme: OfferTheme;

  background_image_url: string | null;
  background_color: string | null;
  accent_color: string | null;
  text_color: string | null;

  badge_label: string | null;

  display_order: number;

  /** False hides the section from the storefront entirely. */
  is_active: boolean;

  item_count: number;
  items: OfferItem[];

  created_at: string;
  updated_at: string;
}

/* ---------- Requests ---------- */

export interface OfferSectionCreateRequest {
  title: string;
  slug: string;
  subtitle?: string | null;
  theme?: OfferTheme;
  background_image_url?: string | null;
  background_color?: string | null;
  accent_color?: string | null;
  text_color?: string | null;
  badge_label?: string | null;
  display_order?: number;
  is_active?: boolean;
}

export type OfferSectionUpdateRequest = Partial<OfferSectionCreateRequest>;

export interface OfferItemCreateRequest {
  product_id: string;
  discount_percent: number;

  /**
   * How long the discount runs for, from now. Null (or omitted) means it
   * never expires.
   */
  duration_days?: number | null;

  display_order?: number;

  /**
   * Confirms that whatever is already discounting this product should be
   * withdrawn. Without it the server refuses with a 409 describing the
   * running offer, which is what drives the "remove the current offer?"
   * prompt in the dashboard.
   */
  replace_existing?: boolean;
}

export interface OfferItemUpdateRequest {
  discount_percent?: number;

  /** Omit to leave the deadline alone; null means never expires. */
  duration_days?: number | null;

  display_order?: number;
}

export interface ProductOfferUpdateRequest {
  /** Null clears the product's standalone offer, label and deadline. */
  offer_percent: number | null;
  offer_label?: string | null;

  /** Null means never expires. */
  offer_duration_days?: number | null;
}

/* ---------- Offer status for one product ---------- */

/** One offer section a product currently belongs to. */
export interface OfferMembership {
  section_id: string;
  section_title: string;
  section_slug: string;
  section_is_active: boolean;

  item_id: string;

  discount_percent: number;
  ends_at: string | null;

  /** False when the section is hidden or the entry has expired. */
  is_live: boolean;
}

/**
 * Everything currently discounting one product.
 *
 * Answers the two questions the dashboard needs: which offers already
 * exist before another is added, and which of them a customer is actually
 * getting right now.
 */
export interface ProductOfferStatus {
  product_id: string;
  product_name: string;

  offer_percent: number | null;
  offer_label: string | null;
  offer_ends_at: string | null;

  own_offer_is_live: boolean;

  memberships: OfferMembership[];

  effective_discount_percent: number | null;
  has_live_offer: boolean;
}

/**
 * Reduces a typed theme name to the same key the backend stores, so the
 * preview in the dashboard matches what the storefront will render.
 */
export function normaliseTheme(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
