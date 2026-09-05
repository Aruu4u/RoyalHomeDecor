export interface CartVariant {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  size_label: string | null;
  colour: string | null;
  material: string | null;
  price_paise: number;
  is_active: boolean;
}

export interface CartItem {
  id: string;
  cart_id: string;
  variant_id: string;
  quantity: number;
  variant: CartVariant;

  /** The variant's normal price, before any offer. */
  list_unit_price_paise: number;

  /** What is actually charged per unit. Differs only when on offer. */
  unit_price_paise: number;

  discount_percent: number | null;

  /** Always quantity x unit_price_paise, so the maths on screen adds up. */
  line_total_paise: number;

  created_at: string;
  updated_at: string;
}

export interface Cart {
  id: string;
  user_id: string;
  items: CartItem[];

  /** Amount that will be charged, offers already applied. */
  subtotal_paise: number;

  /** What the same basket would cost with no offers, and the difference. */
  list_subtotal_paise: number;
  total_saving_paise: number;

  total_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface CartItemCreateRequest {
  variant_id: string;
  quantity?: number;
}

export interface CartItemUpdateRequest {
  quantity: number;
}

export interface CartContextValue {
  cart: Cart | null;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;

  refreshCart: () => Promise<void>;

  addItem: (
    variantId: string,
    quantity?: number,
  ) => Promise<void>;

  updateItem: (
    itemId: string,
    quantity: number,
  ) => Promise<void>;

  removeItem: (itemId: string) => Promise<void>;

  clearCart: () => Promise<void>;

  clearError: () => void;
}