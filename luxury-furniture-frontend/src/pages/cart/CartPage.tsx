import { useCallback, useState } from "react";
import { Link } from "react-router-dom";

import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { EmptyState, PageLoader } from "../../components/ui/Feedback";
import QuantityStepper from "../../components/ui/QuantityStepper";
import SmartImage from "../../components/ui/SmartImage";
import { useAsync } from "../../hooks/useAsync";
import { useCart } from "../../hooks/useCart";
import { formatPrice } from "../../lib/currency";
import { loadProductIndex } from "../../services/catalogueCache";

import "./cart.css";

/*
 * Shipping mirrors the backend rule in OrderService: free at or above
 * 50000 paise, otherwise a flat 5000 paise. The cart endpoint does not
 * return shipping, so it is shown here as an estimate and the order
 * total is confirmed at checkout.
 */
const FREE_SHIPPING_THRESHOLD_PAISE = 50_000;
const FLAT_SHIPPING_PAISE = 5_000;

function estimateShipping(subtotalPaise: number): number {
  return subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE
    ? 0
    : FLAT_SHIPPING_PAISE;
}

function CartPage() {
  const {
    cart,
    isLoading,
    isMutating,
    error,
    updateItem,
    removeItem,
    clearCart,
    clearError,
  } = useCart();

  /* Product records supply the name, image and link per line item. */
  const { data: productIndex } = useAsync(
    useCallback((signal: AbortSignal) => loadProductIndex(signal), []),
    [],
  );

  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  /* Holds the item awaiting confirmation, with a label for the dialog. */
  const [pendingRemoval, setPendingRemoval] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const handleQuantityChange = useCallback(
    async (itemId: string, quantity: number) => {
      setBusyItemId(itemId);

      try {
        await updateItem(itemId, quantity);
      } catch {
        /* The cart provider surfaces the error. */
      } finally {
        setBusyItemId(null);
      }
    },
    [updateItem],
  );

  /* Removals are confirmed first, so a mis-tap cannot empty the cart. */
  const handleRemove = useCallback(async () => {
    if (!pendingRemoval) {
      return;
    }

    setBusyItemId(pendingRemoval.id);

    try {
      await removeItem(pendingRemoval.id);
    } catch {
      /* The cart provider surfaces the error. */
    } finally {
      setBusyItemId(null);
      setPendingRemoval(null);
    }
  }, [pendingRemoval, removeItem]);

  const handleClearCart = useCallback(async () => {
    try {
      await clearCart();
    } catch {
      /* The cart provider surfaces the error. */
    } finally {
      setIsConfirmingClear(false);
    }
  }, [clearCart]);

  if (isLoading && !cart) {
    return <PageLoader label="Loading your cart" />;
  }

  const items = cart?.items ?? [];

  /* Already discounted by the API, so this is what will be charged. */
  const subtotal = cart?.subtotal_paise ?? 0;
  const totalSaving = cart?.total_saving_paise ?? 0;

  const shipping = estimateShipping(subtotal);
  const total = subtotal + shipping;
  const remainingForFreeShipping = FREE_SHIPPING_THRESHOLD_PAISE - subtotal;

  if (items.length === 0) {
    return (
      <div className="shell cart-page page-enter">
        {error && (
          <div className="notice notice-error cart-error" role="alert">
            <span>{error}</span>

            <button className="btn-quiet" onClick={clearError} type="button">
              Dismiss
            </button>
          </div>
        )}

        <EmptyState
          actionLabel="Start shopping"
          actionTo="/shop"
          description="Once you add a piece it will appear here, along with shipping and totals."
          eyebrow="Your cart"
          title="Your cart is empty"
        />
      </div>
    );
  }

  return (
    <div className="shell cart-page page-enter">
      <header className="cart-header">
        <div>
          <p className="eyebrow">Your cart</p>

          <h1 className="cart-title">
            {cart?.total_quantity ?? 0} item
            {(cart?.total_quantity ?? 0) === 1 ? "" : "s"}
          </h1>
        </div>

        <button
          className="btn-danger-quiet"
          disabled={isMutating}
          onClick={() => setIsConfirmingClear(true)}
          type="button"
        >
          Clear cart
        </button>
      </header>

      {error && (
        <div className="notice notice-error cart-error" role="alert">
          <span>{error}</span>

          <button className="btn-quiet" onClick={clearError} type="button">
            Dismiss
          </button>
        </div>
      )}

      <div className="cart-layout">
        {/* ---------- Line items ---------- */}

        <ul className="cart-items">
          {items.map((item) => {
            const product = productIndex?.get(item.variant.product_id) ?? null;
            const isBusy = busyItemId === item.id;

            return (
              <li className="cart-item" key={item.id}>
                <Link
                  aria-label={product ? `View ${product.name}` : "View product"}
                  className="cart-item-media"
                  to={product ? `/products/${product.slug}` : "/shop"}
                >
                  <SmartImage
                    alt={product?.name ?? item.variant.name}
                    fallbackLabel="Piece"
                    ratio="1 / 1"
                    src={product?.thumbnail_url}
                  />
                </Link>

                <div className="cart-item-info">
                  <h2 className="cart-item-name">
                    {product ? (
                      <Link to={`/products/${product.slug}`}>
                        {product.name}
                      </Link>
                    ) : (
                      item.variant.name
                    )}
                  </h2>

                  <p className="cart-item-variant">
                    {item.variant.name}
                    {item.variant.size_label
                      ? ` \u00B7 ${item.variant.size_label}`
                      : ""}
                  </p>

                  <p className="cart-item-sku">SKU {item.variant.sku}</p>

                  {/*
                    When an offer applies the charged price differs from
                    the list price, so both are shown and the line total
                    is derived from the charged one.
                  */}
                  <p className="cart-item-unit">
                    {formatPrice(item.unit_price_paise)} each
                    {item.discount_percent ? (
                      <>
                        {" "}
                        <s className="cart-item-was">
                          {formatPrice(item.list_unit_price_paise)}
                        </s>{" "}
                        <span className="cart-item-off">
                          {item.discount_percent}% off
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>

                <div className="cart-item-controls">
                  <QuantityStepper
                    ariaLabel={`Quantity for ${product?.name ?? item.variant.name}`}
                    disabled={isBusy || isMutating}
                    onChange={(quantity) =>
                      void handleQuantityChange(item.id, quantity)
                    }
                    value={item.quantity}
                  />

                  <button
                    className="btn-danger-quiet"
                    disabled={isBusy || isMutating}
                    onClick={() =>
                      setPendingRemoval({
                        id: item.id,
                        name: product?.name ?? item.variant.name,
                      })
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </div>

                <p className="cart-item-total">
                  {formatPrice(item.line_total_paise)}
                </p>
              </li>
            );
          })}
        </ul>

        {/* ---------- Summary ---------- */}

        <aside className="cart-summary">
          <h2 className="cart-summary-title">Order summary</h2>

          <div className="cart-summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>

          {totalSaving > 0 && (
            <div className="cart-summary-row cart-summary-saving">
              <span>Offer saving</span>
              <span>&minus;{formatPrice(totalSaving)}</span>
            </div>
          )}

          <div className="cart-summary-row">
            <span>Shipping</span>
            <span>{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
          </div>

          {remainingForFreeShipping > 0 && (
            <p className="cart-shipping-hint">
              Add {formatPrice(remainingForFreeShipping)} more for free
              shipping.
            </p>
          )}

          <div className="cart-summary-total">
            <span>Total</span>
            <strong>{formatPrice(total)}</strong>
          </div>

          <Link className="btn btn-primary btn-lg btn-block" to="/checkout">
            Proceed to checkout
          </Link>

          <p className="cart-summary-note">
            Shipping and taxes are confirmed on the checkout page before you
            place the order.
          </p>

          <Link className="link-underline cart-continue" to="/shop">
            Continue shopping
          </Link>
        </aside>
      </div>

      <ConfirmDialog
        cancelLabel="Keep it"
        confirmLabel="Remove"
        isBusy={busyItemId === pendingRemoval?.id}
        isOpen={pendingRemoval !== null}
        message="This piece will be taken out of your cart. Nothing has been charged."
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => void handleRemove()}
        subject={pendingRemoval?.name}
        title="Remove this piece?"
      />

      <ConfirmDialog
        cancelLabel="Keep my cart"
        confirmLabel="Clear everything"
        isBusy={isMutating}
        isOpen={isConfirmingClear}
        message="Every piece will be taken out of your cart. This cannot be undone."
        onCancel={() => setIsConfirmingClear(false)}
        onConfirm={() => void handleClearCart()}
        title="Clear your whole cart?"
      />
    </div>
  );
}

export default CartPage;
