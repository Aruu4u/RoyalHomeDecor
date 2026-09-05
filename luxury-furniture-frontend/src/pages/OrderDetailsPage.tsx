import {
  useEffect,
  useState,
} from "react";
import {
  Link,
  useLocation,
  useParams,
} from "react-router-dom";

import { formatPrice } from "../lib/currency";
import { orderService } from "../services/orders";
import type { Order } from "../types/order";

interface OrderLocationState {
  orderCreated?: boolean;
}

function formatStatus(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to load this order.";
}

function OrderDetailsPage() {
  const { orderId } = useParams<{
    orderId: string;
  }>();

  const location = useLocation();

  const locationState =
    location.state as OrderLocationState | null;

  const orderCreated =
    locationState?.orderCreated === true;

  const [order, setOrder] =
    useState<Order | null>(null);

  const [isLoading, setIsLoading] =
    useState(Boolean(orderId));

  const [error, setError] =
    useState<string | null>(
      orderId ? null : "Order ID is missing.",
    );

  useEffect(() => {
    if (!orderId) {
      return;
    }

    const currentOrderId = orderId;
    const controller = new AbortController();
    let isActive = true;

    async function loadOrder(): Promise<void> {
      try {
        const orderData =
          await orderService.getOrder(
            currentOrderId,
            controller.signal,
          );

        if (isActive) {
          setOrder(orderData);
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
          setIsLoading(false);
        }
      }
    }

    void loadOrder();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [orderId]);

  if (isLoading) {
    return (
      <main className="order-page">
        <p>Loading order...</p>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="order-page">
        <section className="order-error-card">
          <h1>Unable to load order</h1>

          <p>
            {error ?? "Order was not found."}
          </p>

          <Link to="/account">
            Return to account
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="order-page">
      {orderCreated && (
        <div
          className="order-success-banner"
          role="status"
        >
          Order placed successfully.
        </div>
      )}

      <section className="order-heading">
        <p className="eyebrow">
          Order confirmation
        </p>

        <h1>Thank you for your order</h1>

        <p>
          Your order has been created and is now
          waiting for payment and confirmation.
        </p>
      </section>

      <div className="order-details-layout">
        <section className="order-details-main">
          <div className="order-information-card">
            <div>
              <span>Order number</span>

              <strong>{order.id}</strong>
            </div>

            <div>
              <span>Order status</span>

              <strong>
                {formatStatus(order.status)}
              </strong>
            </div>

            <div>
              <span>Payment status</span>

              <strong>
                {formatStatus(
                  order.payment_status,
                )}
              </strong>
            </div>

            <div>
              <span>Order date</span>

              <strong>
                {new Date(
                  order.created_at,
                ).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </strong>
            </div>
          </div>

          <section className="order-section-card">
            <h2>Items ordered</h2>

            <div className="order-item-list">
              {order.items.map((item) => (
                <article
                  className="order-item"
                  key={item.id}
                >
                  <div>
                    <h3>
                      {item.product_name}
                    </h3>

                    <p>
                      Variant: {item.variant_name}
                    </p>

                    {item.size_label && (
                      <p>
                        Size: {item.size_label}
                      </p>
                    )}

                    <p>
                      Quantity: {item.quantity}
                    </p>

                    <p>SKU: {item.sku}</p>
                  </div>

                  <strong>
                    {formatPrice(
                      item.line_total_paise,
                    )}
                  </strong>
                </article>
              ))}
            </div>
          </section>

          <section className="order-section-card">
            <h2>Delivery address</h2>

            <address className="order-address">
              <strong>
                {order.recipient_name}
              </strong>

              <span>
                {order.address_line_1}
              </span>

              {order.address_line_2 && (
                <span>
                  {order.address_line_2}
                </span>
              )}

              {order.landmark && (
                <span>
                  Near {order.landmark}
                </span>
              )}

              <span>
                {order.city}, {order.state}{" "}
                {order.postal_code}
              </span>

              <span>{order.country}</span>

              <span>
                Phone: {order.recipient_phone}
              </span>
            </address>
          </section>

          {order.customer_note && (
            <section className="order-section-card">
              <h2>Delivery instructions</h2>

              <p>{order.customer_note}</p>
            </section>
          )}
        </section>

        <aside className="order-total-card">
          <h2>Order total</h2>

          <div>
            <span>Subtotal</span>

            <strong>
              {formatPrice(
                order.subtotal_paise,
              )}
            </strong>
          </div>

          <div>
            <span>Shipping</span>

            <strong>
              {formatPrice(
                order.shipping_paise,
              )}
            </strong>
          </div>

          <div className="order-grand-total">
            <span>Total</span>

            <strong>
              {formatPrice(order.total_paise)}
            </strong>
          </div>

          <Link
            className="cart-primary-link"
            to="/"
          >
            Continue shopping
          </Link>
        </aside>
      </div>
    </main>
  );
}

export default OrderDetailsPage;