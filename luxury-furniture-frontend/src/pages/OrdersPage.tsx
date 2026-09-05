import {
  useEffect,
  useState,
} from "react";
import { Link } from "react-router-dom";

import { AccountSidebar } from "../components/account/AccountSidebar";
import { formatPrice } from "../lib/currency";
import { orderService } from "../services/orders";
import type { OrderSummary } from "../types/order";

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
    : "Unable to load your orders.";
}

function OrdersPage() {
  const [orders, setOrders] =
    useState<OrderSummary[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadOrders(): Promise<void> {
      try {
        const orderData =
          await orderService.listOrders(
            controller.signal,
          );

        if (!isActive) {
          return;
        }

        const sortedOrders = [...orderData].sort(
          (firstOrder, secondOrder) =>
            new Date(
              secondOrder.created_at,
            ).getTime() -
            new Date(
              firstOrder.created_at,
            ).getTime(),
        );

        setOrders(sortedOrders);
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

    void loadOrders();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  return (
    <main className="account-page">
      <section className="account-heading">
        <p className="eyebrow">My account</p>

        <h1>My orders</h1>

        <p>
          View your previous orders and open their
          complete details.
        </p>
      </section>

      <div className="account-layout">
        <AccountSidebar onError={setError} />

        <section className="account-panel orders-panel">
          <div className="account-panel-heading">
            <h2>Order history</h2>

            <p>
              Your newest orders are displayed
              first.
            </p>
          </div>

          {error && (
            <p
              className="account-message account-error"
              role="alert"
            >
              {error}
            </p>
          )}

          {isLoading ? (
            <p>Loading your orders...</p>
          ) : orders.length === 0 ? (
            <div className="orders-empty-state">
              <h3>No orders yet</h3>

              <p>
                Your completed orders will appear
                here.
              </p>

              <Link
                className="cart-primary-link"
                to="/"
              >
                Start shopping
              </Link>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <article
                  className="order-history-card"
                  key={order.id}
                >
                  <div className="order-history-main">
                    <div>
                      <span className="order-history-label">
                        Order
                      </span>

                      <strong className="order-history-number">
                        #{order.id
                          .slice(0, 8)
                          .toUpperCase()}
                      </strong>
                    </div>

                    <div>
                      <span className="order-history-label">
                        Date
                      </span>

                      <strong>
                        {new Date(
                          order.created_at,
                        ).toLocaleDateString(
                          "en-IN",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </strong>
                    </div>

                    <div>
                      <span className="order-history-label">
                        Total
                      </span>

                      <strong>
                        {formatPrice(
                          order.total_paise,
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="order-history-statuses">
                    <span
                      className={`order-history-badge order-status-${order.status}`}
                    >
                      {formatStatus(order.status)}
                    </span>

                    <span
                      className={`order-history-badge payment-status-${order.payment_status}`}
                    >
                      Payment:{" "}
                      {formatStatus(
                        order.payment_status,
                      )}
                    </span>
                  </div>

                  <Link
                    className="view-order-link"
                    to={`/orders/${order.id}`}
                  >
                    View order details
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default OrdersPage;