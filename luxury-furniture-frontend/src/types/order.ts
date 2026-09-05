export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

export interface CheckoutCreateRequest {
  address_id: string;
  customer_note?: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  sku: string;
  size_label: string | null;
  colour: string | null;
  material: string | null;
  quantity: number;
  unit_price_paise: number;
  line_total_paise: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;

  recipient_name: string;
  recipient_phone: string;

  address_line_1: string;
  address_line_2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;

  customer_note: string | null;

  subtotal_paise: number;
  shipping_paise: number;
  total_paise: number;

  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;

  items: OrderItem[];

  created_at: string;
  updated_at: string;
}

export interface OrderSummary {
  id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total_paise: number;
  created_at: string;
}


export interface AdminOrderStatusUpdateRequest {
  status: OrderStatus;
}