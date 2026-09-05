import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";

import { CartItem } from "../components/cart/CartItem";
import { useCart } from "../hooks/useCart";
import { formatPrice } from "../lib/currency";
import { getProducts } from "../services/products";
import type { Product } from "../types/product";

function CartPage() {
  const {
    cart,
    isLoading,
    isMutating,
    error,
    refreshCart,
    updateItem,
    removeItem,
    clearCart,
  } = useCart();

  const [products, setProducts] =
    useState<Product[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadProducts(): Promise<void> {
      try {
        const productData = await getProducts(
          controller.signal,
        );

        if (isActive) {
          setProducts(productData);
        }
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        // The cart can still be used without
        // product images.
      }
    }

    void loadProducts();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const productsById = useMemo(() => {
    return new Map(
      products.map((product) => [
        product.id,
        product,
      ]),
    );
  }, [products]);

  if (isLoading) {
    return (
      <main className="cart-page">
        <p>Loading your cart...</p>
      </main>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <main className="cart-page">
        <section className="empty-cart">
          <p className="eyebrow">
            Your cart
          </p>

          <h1>Your cart is empty</h1>

          <p>
            Explore our collections and add a
            piece you love.
          </p>

          {error && (
            <p
              className="cart-error-message"
              role="alert"
            >
              {error}
            </p>
          )}

          {error?.includes(
            "Complete your profile",
          ) && (
            <Link
              className="cart-profile-link"
              to="/account"
            >
              Complete your profile
            </Link>
          )}

          <Link
            className="cart-primary-link"
            to="/"
          >
            Continue shopping
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="cart-page">
      <div className="cart-page-heading">
        <div>
          <p className="eyebrow">
            Your selections
          </p>

          <h1>Shopping cart</h1>
        </div>

        <button
          className="clear-cart-button"
          disabled={isMutating}
          onClick={() => void clearCart()}
          type="button"
        >
          Clear cart
        </button>
      </div>

      {error && (
        <div
          className="cart-error-message"
          role="alert"
        >
          <p>{error}</p>

          <button
            disabled={isLoading}
            onClick={() =>
              void refreshCart()
            }
            type="button"
          >
            Retry
          </button>
        </div>
      )}

      <div className="cart-layout">
        <section
          aria-label="Cart items"
          className="cart-items"
        >
          {cart.items.map((item) => (
            <CartItem
              disabled={isMutating}
              item={item}
              key={`${item.id}-${item.quantity}`}
              onQuantityChange={updateItem}
              onRemove={removeItem}
              product={
                productsById.get(
                  item.variant.product_id,
                ) ?? null
              }
            />
          ))}
        </section>

        <aside className="cart-summary">
          <h2>Order summary</h2>

          <div className="cart-summary-row">
            <span>
              Items ({cart.total_quantity})
            </span>

            <strong>
              {formatPrice(
                cart.subtotal_paise,
              )}
            </strong>
          </div>

          <div className="cart-summary-row">
            <span>Shipping</span>

            <span>
              Calculated at checkout
            </span>
          </div>

          <div className="cart-summary-total">
            <span>Subtotal</span>

            <strong>
              {formatPrice(
                cart.subtotal_paise,
              )}
            </strong>
          </div>

        <Link
        className="checkout-button"
        to="/checkout"
        >
        Continue to checkout
        </Link>

        <p className="cart-summary-note">
        Select a saved address and review your
        order before placing it.
        </p>

          <Link
            className="continue-shopping-link"
            to="/"
          >
            Continue shopping
          </Link>
        </aside>
      </div>
    </main>
  );
}

export default CartPage;