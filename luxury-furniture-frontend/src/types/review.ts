/*
 * Mirrors app/schemas/review.py.
 *
 * Note there is no `author_email` on the response. The backend collects
 * it so the shop can follow up privately, but never returns it, because a
 * public review list is the last place a customer's address should show
 * up.
 */

export const MIN_RATING = 1;
export const MAX_RATING = 5;

/** Matches the backend's cap, so the form can stop before a 422. */
export const MAX_REVIEW_PHOTOS = 6;

export interface ProductReview {
  id: string;
  product_id: string;

  author_name: string;

  rating: number;
  title: string | null;
  body: string;

  photo_urls: string[];

  /**
   * Decided by the server from the reviewer's order history, never from
   * the submitted form, so the badge cannot be self-awarded.
   */
  is_verified_purchase: boolean;

  created_at: string;
  updated_at: string;
}

export interface ProductReviewSummary {
  review_count: number;
  average_rating: number | null;

  /**
   * Counts per star, always with all five keys present including zeros.
   * JSON object keys are strings, so this is indexed by "1".."5".
   */
  breakdown: Record<string, number>;
}

export interface ProductReviewList {
  summary: ProductReviewSummary;
  reviews: ProductReview[];
}

export interface ProductReviewCreateRequest {
  rating: number;
  author_name: string;
  author_email?: string | null;
  title?: string | null;
  body: string;
  photo_urls?: string[];
}
