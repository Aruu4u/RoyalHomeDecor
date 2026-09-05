import { apiClient } from "./api";
import type {
  Cart,
  CartItemCreateRequest,
  CartItemUpdateRequest,
} from "../types/cart";

export const cartService = {
  getCart(signal?: AbortSignal): Promise<Cart> {
    return apiClient<Cart>("/cart", {
      signal,
    });
  },

  addItem(data: CartItemCreateRequest): Promise<Cart> {
    return apiClient<Cart>("/cart/items", {
      method: "POST",
      data,
    });
  },

  updateItem(
    itemId: string,
    data: CartItemUpdateRequest,
  ): Promise<Cart> {
    return apiClient<Cart>(`/cart/items/${itemId}`, {
      method: "PATCH",
      data,
    });
  },

  removeItem(itemId: string): Promise<void> {
    return apiClient<void>(`/cart/items/${itemId}`, {
      method: "DELETE",
    });
  },

  clearCart(): Promise<void> {
    return apiClient<void>("/cart", {
      method: "DELETE",
    });
  },
};