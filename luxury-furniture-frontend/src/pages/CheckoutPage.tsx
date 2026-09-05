import {
  useEffect,
  useState,
} from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";

import { useCart } from "../hooks/useCart";
import { formatPrice } from "../lib/currency";
import { addressService } from "../services/addresses";
import { orderService } from "../services/orders";
import type { Address } from "../types/address";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to complete checkout.";
}

function CheckoutPage() {
  const navigate = useNavigate();

  const {
    cart,
    isLoading: isCartLoading,
    refreshCart,
  } = useCart();

  const [addresses, setAddresses] =
    useState<Address[]>([]);

  const [
    selectedAddressId,
    setSelectedAddressId,
  ] = useState("");

  const [customerNote, setCustomerNote] =
    useState("");

  const [
    isLoadingAddresses,
    setIsLoadingAddresses,
  ] = useState(true);

  const [
    isPlacingOrder,
    setIsPlacingOrder,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadAddresses(): Promise<void> {
      try {
        const addressData =
          await addressService.listAddresses(
            controller.signal,
          );

        if (!isActive) {
          return;
        }

        setAddresses(addressData);

        const defaultAddress =
          addressData.find(
            (address) => address.is_default,
          ) ?? addressData[0];

        if (defaultAddress) {
          setSelectedAddressId(
            defaultAddress.id,
          );
        }
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        if (isActive) {
          setError(
            getErrorMessage(requestError),
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingAddresses(false);
        }
      }
    }

    void loadAddresses();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  async function handlePlaceOrder(): Promise<void> {
    if (!selectedAddressId) {
      setError(
        "Select a delivery address before placing your order.",
      );

      return;
    }

    if (!cart || cart.items.length === 0) {
      setError(
        "Your cart is empty.",
      );

      return;
    }

    setIsPlacingOrder(true);
    setError(null);

    try {
      const order = await orderService.checkout({
        address_id: selectedAddressId,
        customer_note:
          customerNote.trim() || null,
      });

      await refreshCart();

      navigate(`/orders/${order.id}`, {
        replace: true,
        state: {
          orderCreated: true,
        },
      });
    } catch (requestError) {
      setError(
        getErrorMessage(requestError),
      );
    } finally {
      setIsPlacingOrder(false);
    }
  }

  if (
    isCartLoading ||
    isLoadingAddresses
  ) {
    return (
      <main className="checkout-page">
        <p>Preparing your checkout...</p>
      </main>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <main className="checkout-page">
        <section className="checkout-empty">
          <p className="eyebrow">
            Checkout
          </p>

          <h1>Your cart is empty</h1>

          <p>
            Add a product to your cart before
            continuing to checkout.
          </p>

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
    <main className="checkout-page">
      <section className="checkout-heading">
        <p className="eyebrow">
          Secure checkout
        </p>

        <h1>Complete your order</h1>

        <p>
          Select the delivery address and review
          your order before placing it.
        </p>
      </section>

      {error && (
        <p
          className="checkout-message checkout-error"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="checkout-layout">
        <div className="checkout-main">
          <section className="checkout-section">
            <div className="checkout-section-heading">
              <div>
                <span>1</span>

                <div>
                  <h2>Delivery address</h2>

                  <p>
                    Select where this order should
                    be delivered.
                  </p>
                </div>
              </div>

              <Link to="/account/addresses">
                Manage addresses
              </Link>
            </div>

            {addresses.length === 0 ? (
              <div className="checkout-no-address">
                <h3>
                  No delivery address saved
                </h3>

                <p>
                  Add a complete delivery address
                  before placing the order.
                </p>

                <Link
                  className="cart-primary-link"
                  to="/account/addresses"
                >
                  Add delivery address
                </Link>
              </div>
            ) : (
              <div className="checkout-address-list">
                {addresses.map((address) => {
                  const isSelected =
                    selectedAddressId ===
                    address.id;

                  return (
                    <label
                      className={
                        isSelected
                          ? "checkout-address-card selected"
                          : "checkout-address-card"
                      }
                      key={address.id}
                    >
                      <input
                        checked={isSelected}
                        name="delivery-address"
                        onChange={() =>
                          setSelectedAddressId(
                            address.id,
                          )
                        }
                        type="radio"
                        value={address.id}
                      />

                      <div>
                        <div className="checkout-address-title">
                          <strong>
                            {address.label}
                          </strong>

                          {address.is_default && (
                            <span>Default</span>
                          )}
                        </div>

                        <p>
                          {address.recipient_name}
                        </p>

                        <address>
                          {address.address_line_1}

                          {address.address_line_2 && (
                            <>
                              <br />
                              {address.address_line_2}
                            </>
                          )}

                          {address.landmark && (
                            <>
                              <br />
                              Near {address.landmark}
                            </>
                          )}

                          <br />
                          {address.city},{" "}
                          {address.state}{" "}
                          {address.postal_code}

                          <br />
                          {address.country}
                        </address>

                        <p>
                          Phone: {address.phone}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          <section className="checkout-section">
            <div className="checkout-section-heading">
              <div>
                <span>2</span>

                <div>
                  <h2>Delivery instructions</h2>

                  <p>
                    Add an optional note for your
                    furniture delivery.
                  </p>
                </div>
              </div>
            </div>

            <label
              className="checkout-note-field"
              htmlFor="customer-note"
            >
              <span>
                Order note{" "}
                <small>(optional)</small>
              </span>

              <textarea
                id="customer-note"
                maxLength={1000}
                onChange={(event) =>
                  setCustomerNote(
                    event.target.value,
                  )
                }
                placeholder="For example: Call before delivery or use the side entrance."
                rows={5}
                value={customerNote}
              />

              <small>
                {customerNote.length}/1000
              </small>
            </label>
          </section>

          <section className="checkout-section">
            <div className="checkout-section-heading">
              <div>
                <span>3</span>

                <div>
                  <h2>Payment</h2>

                  <p>
                    Online payment will be
                    connected with Razorpay later.
                  </p>
                </div>
              </div>
            </div>

            <div className="checkout-payment-placeholder">
              <strong>
                Payment integration pending
              </strong>

              <p>
                For now, placing the order creates
                a pending test order in the
                backend.
              </p>
            </div>
          </section>
        </div>

        <aside className="checkout-summary">
          <h2>Order summary</h2>

          <div className="checkout-summary-items">
            {cart.items.map((item) => (
              <div
                className="checkout-summary-item"
                key={item.id}
              >
                <div>
                  <strong>
                    {item.variant.name}
                  </strong>

                  <span>
                    Quantity: {item.quantity}
                  </span>
                </div>

                <strong>
                  {formatPrice(
                    item.line_total_paise,
                  )}
                </strong>
              </div>
            ))}
          </div>

          <div className="checkout-summary-row">
            <span>
              Items ({cart.total_quantity})
            </span>

            <strong>
              {formatPrice(
                cart.subtotal_paise,
              )}
            </strong>
          </div>

          <div className="checkout-summary-row">
            <span>Shipping</span>

            <span>
              Calculated by backend
            </span>
          </div>

          <div className="checkout-summary-total">
            <span>Current subtotal</span>

            <strong>
              {formatPrice(
                cart.subtotal_paise,
              )}
            </strong>
          </div>

          <button
            className="place-order-button"
            disabled={
              isPlacingOrder ||
              addresses.length === 0 ||
              !selectedAddressId
            }
            onClick={() =>
              void handlePlaceOrder()
            }
            type="button"
          >
            {isPlacingOrder
              ? "Placing order..."
              : "Place test order"}
          </button>

          <p className="checkout-summary-help">
            The final order total is confirmed by
            the backend using current prices and
            stock.
          </p>

          <Link
            className="continue-shopping-link"
            to="/cart"
          >
            Return to cart
          </Link>
        </aside>
      </div>
    </main>
  );
}

export default CheckoutPage;