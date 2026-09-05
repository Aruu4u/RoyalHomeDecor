export interface Product {
  id: string;
  collection_id: string;
  name: string;
  slug: string;
  short_description: string | null;
  base_price_paise: number;

  /*
   * Materials are split because furniture is rarely one thing: a marble
   * top on a brass base, with a finish applied over both. Each is
   * filterable on its own.
   */
  top_material: string | null;
  base_material: string | null;
  finish: string | null;

  colour: string | null;
  style: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
  is_recommended: boolean;

  /*
   * Offers. `offer_percent` is the product's own standalone discount and
   * can be null while an offer still applies, because the product may be
   * discounted through an offer section instead.
   *
   * `offer_discount_percent` and `offer_price_paise` are what to display:
   * the discount actually in effect and the resulting price, both
   * calculated on the server. Null means nothing is on offer.
   *
   * `offer_ends_at` is when the product's own offer stops. Null means it
   * never expires. The server already excludes expired offers from the
   * fields above, so this is only for telling the shopper how long they
   * have left.
   */
  offer_percent: number | null;
  offer_label: string | null;
  offer_ends_at: string | null;
  offer_discount_percent: number | null;
  offer_price_paise: number | null;

  /*
   * Stock, summed across the product's active variants. The list endpoint
   * returns no variants, so without these a card cannot tell a sold-out
   * piece from an available one.
   */
  in_stock: boolean;
  available_quantity: number;

  /* Published review score, for the stars on a card. */
  review_count: number;
  review_average: number | null;

  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  id: string;
  variant_id: string;
  quantity_on_hand: number;
  reserved_quantity: number;
  low_stock_threshold: number;
  available_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  size_label: string | null;
  colour: string | null;
  material: string | null;
  price_paise: number;
  length_cm: string | null;
  width_cm: string | null;
  height_cm: string | null;
  weight_grams: number | null;
  is_active: boolean;
  inventory: Inventory | null;
  created_at: string;
  updated_at: string;
}

export interface ProductDetails extends Product {
  description: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
}

export interface ProductUpdateRequest {
  collection_id?: string;
  name?: string;
  slug?: string;
  short_description?: string | null;
  description?: string | null;
  base_price_paise?: number;
  top_material?: string | null;
  base_material?: string | null;
  finish?: string | null;
  colour?: string | null;
  style?: string | null;
  thumbnail_url?: string | null;
  is_active?: boolean;
  is_recommended?: boolean;

  /* Standalone offer. Null clears it. */
  offer_percent?: number | null;
  offer_label?: string | null;

  /*
   * How long the offer runs for, counted from when the server receives
   * it. Three distinct meanings, so the property has to be omitted rather
   * than sent as undefined when nothing should change:
   *
   *   omitted -> leave the existing end date alone
   *   null    -> never expires
   *   N       -> ends N days from now
   */
  offer_duration_days?: number | null;
}

export interface InventoryCreateRequest {
  quantity_on_hand: number;
  reserved_quantity: number;
  low_stock_threshold: number;
}

export interface ProductImageCreateRequest {
  image_url: string;
  alt_text: string;
  display_order: number;
  is_primary: boolean;
}

export interface ProductVariantCreateRequest {
  sku: string;
  name: string;
  size_label?: string | null;
  colour?: string | null;
  material?: string | null;
  price_paise: number;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  weight_grams?: number | null;
  is_active: boolean;
  inventory: InventoryCreateRequest;
}

export interface ProductCreateRequest {
  collection_id: string;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  base_price_paise: number;
  top_material?: string | null;
  base_material?: string | null;
  finish?: string | null;
  colour?: string | null;
  style?: string | null;
  thumbnail_url?: string | null;
  is_active: boolean;
  is_recommended: boolean;
  images: ProductImageCreateRequest[];
  variants: ProductVariantCreateRequest[];
}

export interface ProductImageUpdateRequest {
  image_url?: string;
  alt_text?: string;
  display_order?: number;
  is_primary?: boolean;
}

export interface ProductVariantUpdateRequest {
  sku?: string;
  name?: string;
  size_label?: string | null;
  colour?: string | null;
  material?: string | null;
  price_paise?: number;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  weight_grams?: number | null;
  is_active?: boolean;
}

export interface InventoryUpdateRequest {
  quantity_on_hand?: number;
  reserved_quantity?: number;
  low_stock_threshold?: number;
}