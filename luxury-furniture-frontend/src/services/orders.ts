import { apiClient } from "./api";

import type {
  AdminOrderStatusUpdateRequest,
  CheckoutCreateRequest,
  Order,
  OrderSummary,
} from "../types/order";

export const orderService = {
  checkout(
    data: CheckoutCreateRequest,
  ): Promise<Order> {
    return apiClient<Order>(
      "/orders/checkout",
      {
        method: "POST",
        data,
      },
    );
  },

  listOrders(
    signal?: AbortSignal,
  ): Promise<OrderSummary[]> {
    return apiClient<OrderSummary[]>(
      "/orders",
      {
        signal,
      },
    );
  },

  listAdminOrders(
    signal?: AbortSignal,
  ): Promise<OrderSummary[]> {
    return apiClient<OrderSummary[]>(
      "/admin/orders",
      {
        signal,
      },
    );
  },

  getOrder(
    orderId: string,
    signal?: AbortSignal,
  ): Promise<Order> {
    return apiClient<Order>(
      `/orders/${orderId}`,
      {
        signal,
      },
    );
  },

  getAdminOrder(
    orderId: string,
    signal?: AbortSignal,
  ): Promise<Order> {
    return apiClient<Order>(
      `/admin/orders/${orderId}`,
      {
        signal,
      },
    );
  },

  updateAdminOrderStatus(
    orderId: string,
    data: AdminOrderStatusUpdateRequest,
  ): Promise<Order> {
    return apiClient<Order>(
      `/admin/orders/${orderId}/status`,
      {
        method: "PATCH",
        data,
      },
    );
  },
};