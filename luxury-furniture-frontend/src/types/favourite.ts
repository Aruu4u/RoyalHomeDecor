/*
 * Mirrors app/schemas/favourite.py.
 *
 * The product shape here deliberately carries the same offer and stock
 * fields as a catalogue product, because the favourites page renders the
 * ordinary product card. Without them a saved piece would show its full
 * price while every other card showed the discount.
 */
export interface FavouriteProduct {
  id: string;
  collection_id: string;
  name: string;
  slug: string;
  short_description: string;
  base_price_paise: number;

  top_material: string | null;
  base_material: string | null;
  finish: string | null;

  colour: string | null;
  style: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
  is_recommended: boolean;

  offer_percent: number | null;
  offer_label: string | null;
  offer_ends_at: string | null;
  offer_discount_percent: number | null;
  offer_price_paise: number | null;

  in_stock: boolean;
  available_quantity: number;

  review_count: number;
  review_average: number | null;
}

export interface Favourite {
  id: string;
  user_id: string;
  product_id: string;
  product: FavouriteProduct;
  created_at: string;
  updated_at: string;
}
