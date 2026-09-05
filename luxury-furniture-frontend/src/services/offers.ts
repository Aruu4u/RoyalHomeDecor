import { apiClient } from "./api";
import type {
  OfferItemCreateRequest,
  OfferItemUpdateRequest,
  OfferSection,
  OfferSectionCreateRequest,
  OfferSectionUpdateRequest,
  ProductOfferStatus,
  ProductOfferUpdateRequest,
} from "../types/offer";
import type { ProductDetails } from "../types/product";

export const offerService = {
  /**
   * Lists offer sections.
   *
   * The storefront uses the default `activeOnly`, so hidden sections
   * disappear from the site while staying editable in the dashboard.
   */
  listSections(
    options: { activeOnly?: boolean; signal?: AbortSignal } = {},
  ): Promise<OfferSection[]> {
    const activeOnly = options.activeOnly ?? true;

    return apiClient<OfferSection[]>(
      `/offers/sections?active_only=${activeOnly ? "true" : "false"}`,
      { signal: options.signal },
    );
  },

  getSection(slug: string, signal?: AbortSignal): Promise<OfferSection> {
    return apiClient<OfferSection>(`/offers/sections/${slug}`, { signal });
  },

  createSection(data: OfferSectionCreateRequest): Promise<OfferSection> {
    return apiClient<OfferSection>("/offers/sections", {
      method: "POST",
      data,
    });
  },

  updateSection(
    sectionId: string,
    data: OfferSectionUpdateRequest,
  ): Promise<OfferSection> {
    return apiClient<OfferSection>(`/offers/sections/${sectionId}`, {
      method: "PATCH",
      data,
    });
  },

  deleteSection(sectionId: string): Promise<void> {
    return apiClient<void>(`/offers/sections/${sectionId}`, {
      method: "DELETE",
    });
  },

  /** Adding, updating or removing a product returns the whole section. */
  addItem(
    sectionId: string,
    data: OfferItemCreateRequest,
  ): Promise<OfferSection> {
    return apiClient<OfferSection>(`/offers/sections/${sectionId}/items`, {
      method: "POST",
      data,
    });
  },

  updateItem(
    itemId: string,
    data: OfferItemUpdateRequest,
  ): Promise<OfferSection> {
    return apiClient<OfferSection>(`/offers/items/${itemId}`, {
      method: "PATCH",
      data,
    });
  },

  removeItem(itemId: string): Promise<void> {
    return apiClient<void>(`/offers/items/${itemId}`, {
      method: "DELETE",
    });
  },

  /** Sets or clears a single product's own offer. */
  setProductOffer(
    productId: string,
    data: ProductOfferUpdateRequest,
  ): Promise<ProductDetails> {
    return apiClient<ProductDetails>(`/offers/products/${productId}`, {
      method: "PATCH",
      data,
    });
  },

  /**
   * Every offer attached to one product, including hidden sections and
   * expired entries.
   *
   * Used to show section membership on the product edit page, and to
   * explain the conflict when a second offer is about to be added on top
   * of a running one.
   */
  getProductOfferStatus(
    productId: string,
    signal?: AbortSignal,
  ): Promise<ProductOfferStatus> {
    return apiClient<ProductOfferStatus>(`/offers/products/${productId}`, {
      signal,
    });
  },
};
