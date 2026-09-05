import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AddressForm from "../../components/account/AddressForm";
import { EmptyState, PageLoader } from "../../components/ui/Feedback";
import { useAsync } from "../../hooks/useAsync";
import { useCart } from "../../hooks/useCart";
import { formatPrice } from "../../lib/currency";
import { addressService } from "../../services/addresses";
import { ApiError } from "../../services/api";
import { loadProductIndex } from "../../services/catalogueCache";
import { orderService } from "../../services/orders";
import { profileService } from "../../services/profile";
import type { Address, AddressCreateRequest } from "../../types/address";

import "../account/account.css";
import "./checkout.css";

const FREE_SHIPPING_THRESHOLD_PAISE = 50_000;
const FLAT_SHIPPING_PAISE = 5_000;

function estimateShipping(subtotalPaise: number): number {
  return subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE
    ? 0
    : FLAT_SHIPPING_PAISE;
}

function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, isLoading: isLoadingCart, refreshCart } = useCart();

  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [note, setNote] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  /*
   * The API requires a profile row before addresses or orders can exist,
   * so a missing profile is a distinct, recoverable state rather than an
   * error. A 404 here means "not created yet".
   */
  const { data: profileState, isLoading: isLoadingProfile } = useAsync(
    useCallback(async () => {
      try {
        await profileService.getProfile();
        return { exists: true };
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return { exists: false };
        }

        throw error;
      }
    }, []),
    [],
  );

  const {
    isLoading: isLoadingAddresses,
    error: addressesError,
    reload: reloadAddresses,
  } = useAsync(
    useCallback(async (signal: AbortSignal) => {
      const list = await addressService.listAddresses(signal);

      setAddresses(list);

      /* Default to the shopper's default address, else the first one. */
      setSelectedAddressId((current) => {
        if (current && list.some((entry) => entry.id === current)) {
          return current;
        }

        return (list.find((entry) => entry.is_default) ?? list[0])?.id ?? null;
      });

      return list;
    }, []),
    [],
    "Unable to load your saved addresses.",
  );

  const { data: productIndex } = useAsync(
    useCallback((signal: AbortSignal) => loadProductIndex(signal), []),
    [],
  );

  const items = cart?.items ?? [];
  const subtotal = cart?.subtotal_paise ?? 0;
  const shipping = estimateShipping(subtotal);
  const total = subtotal + shipping;

  const selectedAddress = useMemo(
    () =>
      (addresses ?? []).find((entry) => entry.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );

  const handleCreateAddress = useCallback(
    async (data: AddressCreateRequest) => {
      const created = await addressService.createAddress(data);

      setAddresses((current) => [...(current ?? []), created]);
      setSelectedAddressId(created.id);
      setIsAddingAddress(false);
    },
    [],
  );

  async function handlePlaceOrder(): Promise<void> {
    if (!selectedAddressId) {
      setPlaceError("Choose a delivery address to continue.");
      return;
    }

    setIsPlacing(true);
    setPlaceError(null);

    try {
      const order = await orderService.checkout({
        address_id: selectedAddressId,
        customer_note: note.trim() === "" ? null : note.trim(),
      });

      /* Checkout empties the cart server-side; sync local state. */
      await refreshCart();

      navigate(`/orders/${order.id}`, { replace: true });
    } catch (error) {
      setPlaceError(
        error instanceof Error
          ? error.message
          : "We could not place your order. Please try again.",
      );
    } finally {
      setIsPlacing(false);
    }
  }

  if (isLoadingCart || isLoadingProfile) {
    return <PageLoader label="Preparing checkout" />;
  }

  if (profileState && !profileState.exists) {
    return (
      <div className="shell checkout-page page-enter">
        <EmptyState
          actionLabel="Complete your profile"
          actionTo="/account"
          description="We need your name and contact number before an order can be placed."
          eyebrow="One step first"
          title="Complete your profile"
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="shell checkout-page page-enter">
        <EmptyState
          actionLabel="Browse the collection"
          actionTo="/shop"
          description="Add a piece to your cart and it will show up here ready for checkout."
          eyebrow="Checkout"
          title="Your cart is empty"
        />
      </div>
    );
  }

  return (
    <div className="shell checkout-page page-enter">
      <header className="checkout-header">
        <p className="eyebrow">Checkout</p>
        <h1 className="checkout-title">Confirm your order</h1>
      </header>

      <div className="checkout-layout">
        <div className="checkout-main">
          {/* ---------- Address ---------- */}

          <section className="panel checkout-section">
            <header className="checkout-section-head">
              <h2 className="checkout-section-title">Delivery address</h2>

              {!isAddingAddress && (
                <button
                  className="btn-quiet"
                  onClick={() => setIsAddingAddress(true)}
                  type="button"
                >
                  Add new address
                </button>
              )}
            </header>

            {addressesError && (
              <p className="notice notice-error" role="alert">
                {addressesError}

                <button
                  className="btn-quiet"
                  onClick={reloadAddresses}
                  type="button"
                >
                  Retry
                </button>
              </p>
            )}

            {isLoadingAddresses && !addresses ? (
              <p className="muted-text">Loading your addresses...</p>
            ) : isAddingAddress ? (
              <AddressForm
                onCancel={
                  (addresses ?? []).length > 0
                    ? () => setIsAddingAddress(false)
                    : undefined
                }
                onSubmit={handleCreateAddress}
                submitLabel="Use this address"
              />
            ) : (addresses ?? []).length === 0 ? (
              <div className="checkout-empty-addresses">
                <p className="muted-text">
                  You have no saved addresses yet.
                </p>

                <AddressForm
                  onSubmit={handleCreateAddress}
                  submitLabel="Use this address"
                />
              </div>
            ) : (
              <ul className="address-options">
                {(addresses ?? []).map((address) => (
                  <li key={address.id}>
                    <label
                      className={
                        address.id === selectedAddressId
                          ? "address-option is-active"
                          : "address-option"
                      }
                    >
                      <input
                        checked={address.id === selectedAddressId}
                        name="delivery-address"
                        onChange={() => setSelectedAddressId(address.id)}
                        type="radio"
                        value={address.id}
                      />

                      <span className="address-option-body">
                        <span className="address-option-head">
                          <strong>{address.label}</strong>

                          {address.is_default && (
                            <span className="badge badge-neutral">Default</span>
                          )}
                        </span>

                        <span className="address-option-name">
                          {address.recipient_name}
                        </span>

                        <span className="address-option-lines">
                          {address.address_line_1}
                          {address.address_line_2
                            ? `, ${address.address_line_2}`
                            : ""}
                          {address.landmark ? `, ${address.landmark}` : ""}
                          <br />
                          {address.city}, {address.state} {address.postal_code}
                          <br />
                          {address.country}
                        </span>

                        <span className="address-option-phone">
                          {address.phone}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---------- Note ---------- */}

          <section className="panel checkout-section">
            <h2 className="checkout-section-title">
              Delivery note{" "}
              <span className="field-hint">(optional)</span>
            </h2>

            <textarea
              className="control checkout-note"
              maxLength={1000}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Gate codes, preferred delivery window, anything our courier should know."
              rows={4}
              value={note}
            />

            <p className="field-hint">{note.length} / 1000</p>
          </section>

          {/* ---------- Items ---------- */}

          <section className="panel checkout-section">
            <h2 className="checkout-section-title">
              {items.length} item{items.length === 1 ? "" : "s"} in this order
            </h2>

            <ul className="checkout-items">
              {items.map((item) => {
                const product =
                  productIndex?.get(item.variant.product_id) ?? null;

                return (
                  <li className="checkout-item" key={item.id}>
                    <span className="checkout-item-info">
                      <span className="checkout-item-name">
                        {product?.name ?? item.variant.name}
                      </span>

                      <span className="checkout-item-meta">
                        {item.variant.name}
                        {item.variant.size_label
                          ? ` \u00B7 ${item.variant.size_label}`
                          : ""}{" "}
                        &times; {item.quantity}
                      </span>
                    </span>

                    <span className="checkout-item-price">
                      {formatPrice(item.line_total_paise)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* ---------- Summary ---------- */}

        <aside className="checkout-summary">
          <h2 className="cart-summary-title">Order total</h2>

          <div className="cart-summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>

          <div className="cart-summary-row">
            <span>Shipping</span>
            <span>{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
          </div>

          <div className="cart-summary-total">
            <span>Total</span>
            <strong>{formatPrice(total)}</strong>
          </div>

          {selectedAddress && (
            <p className="checkout-shipping-to">
              Shipping to <strong>{selectedAddress.recipient_name}</strong>,{" "}
              {selectedAddress.city} {selectedAddress.postal_code}
            </p>
          )}

          {placeError && (
            <p className="notice notice-error" role="alert">
              {placeError}
            </p>
          )}

          <button
            className="btn btn-primary btn-lg btn-block"
            disabled={isPlacing || !selectedAddressId}
            onClick={() => void handlePlaceOrder()}
            type="button"
          >
            {isPlacing ? "Placing order..." : "Place order"}
          </button>

          <p className="cart-summary-note">
            Payment is collected after the order is confirmed. You will be
            able to review the order immediately.
          </p>

          <Link className="link-underline cart-continue" to="/cart">
            Back to cart
          </Link>
        </aside>
      </div>
    </div>
  );
}

export default CheckoutPage;
