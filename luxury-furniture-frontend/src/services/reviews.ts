import { apiClient } from "./api";
import type {
  ProductReview,
  ProductReviewCreateRequest,
  ProductReviewList,
} from "../types/review";

export const reviewService = {
  /**
   * Reviews for one product, newest first.
   *
   * The summary is calculated across every published review rather than
   * just this page, so the headline score does not shift as the shopper
   * pages through.
   */
  list(
    slug: string,
    options: { offset?: number; limit?: number; signal?: AbortSignal } = {},
  ): Promise<ProductReviewList> {
    const params = new URLSearchParams({
      offset: String(options.offset ?? 0),
      limit: String(options.limit ?? 10),
    });

    return apiClient<ProductReviewList>(
      `/products/${slug}/reviews?${params.toString()}`,
      { signal: options.signal },
    );
  },

  /**
   * Submits a review.
   *
   * Signing in is optional. `apiClient` attaches the access token when
   * there is a session, and the server uses it to link the review to the
   * account and check the order history for the verified-purchase badge.
   */
  create(
    slug: string,
    data: ProductReviewCreateRequest,
  ): Promise<ProductReview> {
    return apiClient<ProductReview>(`/products/${slug}/reviews`, {
      method: "POST",
      data,
    });
  },

  /** Hides a review from the storefront without deleting it. Admin only. */
  setApproval(reviewId: string, isApproved: boolean): Promise<ProductReview> {
    return apiClient<ProductReview>(
      `/reviews/${reviewId}/approval?is_approved=${isApproved}`,
      { method: "PATCH" },
    );
  },

  /** Permanently deletes a review. Admin only. */
  remove(reviewId: string): Promise<void> {
    return apiClient<void>(`/reviews/${reviewId}`, { method: "DELETE" });
  },
};
