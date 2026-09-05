import { useContext } from "react";

import { CartContext } from "../context/cart-context";
import type { CartContextValue } from "../types/cart";

export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used inside CartProvider.",
    );
  }

  return context;
}