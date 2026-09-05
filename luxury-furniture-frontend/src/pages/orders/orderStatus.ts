import type { OrderStatus, PaymentStatus } from "../../types/order";

/* =========================================================
   Order status presentation.

   The stage order mirrors the backend transition matrix in
   OrderService._validate_status_transition. "cancelled" is a
   terminal branch rather than a stage, so it is handled apart.
   ========================================================= */

export const ORDER_STAGES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Being made",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  pending: "We have your order and are confirming stock.",
  confirmed: "Confirmed and queued for the workshop.",
  processing: "Your piece is being prepared and crated.",
  shipped: "On its way to your delivery address.",
  delivered: "Delivered. We hope it looks the part.",
  cancelled: "This order was cancelled.",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Payment pending",
  paid: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
};

type BadgeTone = "badge-neutral" | "badge-gold" | "badge-success" | "badge-danger" | "badge-warning";

export function orderStatusTone(status: OrderStatus): BadgeTone {
  switch (status) {
    case "delivered":
      return "badge-success";

    case "cancelled":
      return "badge-danger";

    case "shipped":
      return "badge-gold";

    case "pending":
      return "badge-warning";

    default:
      return "badge-neutral";
  }
}

export function paymentStatusTone(status: PaymentStatus): BadgeTone {
  switch (status) {
    case "paid":
      return "badge-success";

    case "failed":
      return "badge-danger";

    case "refunded":
      return "badge-neutral";

    default:
      return "badge-warning";
  }
}

export function formatOrderDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Short, stable reference shown to the shopper instead of a raw UUID. */
export function orderReference(orderId: string): string {
  return orderId.split("-")[0].toUpperCase();
}
