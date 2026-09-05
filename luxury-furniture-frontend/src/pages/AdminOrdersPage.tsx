import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { formatPrice } from "../lib/currency";
import { orderService } from "../services/orders";
import type {
  Order,
  OrderStatus,
  PaymentStatus,
} from "../types/order";

type OrderFilter =
  | "all"
  | OrderStatus;

type PaymentFilter =
  | "all"
  | PaymentStatus;

const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

const PAYMENT_STATUSES: PaymentStatus[] = [
  "pending",
  "paid",
  "failed",
  "refunded",
];

function formatStatus(
  value: string,
): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function formatOrderNumber(
  orderId: string,
): string {
  return orderId
    .slice(0, 8)
    .toUpperCase();
}

function formatDate(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date(value));
}

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Unable to complete the order request.";
}

function getOrderItemQuantity(
  order: Order,
): number {
  return order.items.reduce(
    (total, item) =>
      total + item.quantity,
    0,
  );
}

function AdminOrdersPage() {
  const [orders, setOrders] =
    useState<Order[]>([]);

  const [statusDrafts, setStatusDrafts] =
    useState<
      Record<string, OrderStatus>
    >({});

  const [searchQuery, setSearchQuery] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<OrderFilter>("all");

  const [
    paymentFilter,
    setPaymentFilter,
  ] = useState<PaymentFilter>("all");

  const [busyOrderId, setBusyOrderId] =
    useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const controller =
      new AbortController();

    let isActive = true;

    async function loadOrders(): Promise<void> {
      try {
        const summaries =
          await orderService.listAdminOrders(
            controller.signal,
          );

        const orderDetails =
          await Promise.all(
            summaries.map((summary) =>
              orderService.getAdminOrder(
                summary.id,
                controller.signal,
              ),
            ),
          );

        if (!isActive) {
          return;
        }

        const sortedOrders = [
          ...orderDetails,
        ].sort(
          (first, second) =>
            new Date(
              second.created_at,
            ).getTime() -
            new Date(
              first.created_at,
            ).getTime(),
        );

        setOrders(sortedOrders);

        setStatusDrafts(
          Object.fromEntries(
            sortedOrders.map((order) => [
              order.id,
              order.status,
            ]),
          ),
        );
      } catch (requestError) {
        if (
          requestError instanceof
            DOMException &&
          requestError.name ===
            "AbortError"
        ) {
          return;
        }

        if (isActive) {
          setError(
            getErrorMessage(
              requestError,
            ),
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

  const summary = useMemo(() => {
    const pending = orders.filter(
      (order) =>
        order.status === "pending",
    ).length;

    const processing = orders.filter(
      (order) =>
        order.status === "processing",
    ).length;

    const shipped = orders.filter(
      (order) =>
        order.status === "shipped",
    ).length;

    const paidRevenue = orders
      .filter(
        (order) =>
          order.payment_status ===
          "paid",
      )
      .reduce(
        (total, order) =>
          total + order.total_paise,
        0,
      );

    return {
      pending,
      processing,
      shipped,
      paidRevenue,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch =
      searchQuery
        .trim()
        .toLowerCase();

    return orders.filter((order) => {
      const searchableItems =
        order.items
          .map(
            (item) =>
              [
                item.product_name,
                item.variant_name,
                item.sku,
              ].join(" "),
          )
          .join(" ");

      const matchesSearch =
        !normalizedSearch ||
        order.id
          .toLowerCase()
          .includes(normalizedSearch) ||
        formatOrderNumber(order.id)
          .toLowerCase()
          .includes(normalizedSearch) ||
        order.user_id
          .toLowerCase()
          .includes(normalizedSearch) ||
        order.recipient_name
          .toLowerCase()
          .includes(normalizedSearch) ||
        order.recipient_phone
          .toLowerCase()
          .includes(normalizedSearch) ||
        order.city
          .toLowerCase()
          .includes(normalizedSearch) ||
        order.postal_code
          .toLowerCase()
          .includes(normalizedSearch) ||
        searchableItems
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        order.status === statusFilter;

      const matchesPayment =
        paymentFilter === "all" ||
        order.payment_status ===
          paymentFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPayment
      );
    });
  }, [
    orders,
    searchQuery,
    statusFilter,
    paymentFilter,
  ]);

  function updateStatusDraft(
    orderId: string,
    status: OrderStatus,
  ): void {
    setStatusDrafts((current) => ({
      ...current,
      [orderId]: status,
    }));
  }

  async function handleUpdateStatus(
    order: Order,
  ): Promise<void> {
    const nextStatus =
      statusDrafts[order.id];

    if (!nextStatus) {
      return;
    }

    if (nextStatus === order.status) {
      setError(
        "Select a different order status first.",
      );
      setSuccessMessage(null);
      return;
    }

    if (
      nextStatus === "cancelled" &&
      !window.confirm(
        `Cancel order #${formatOrderNumber(
          order.id,
        )}?`,
      )
    ) {
      return;
    }

    setBusyOrderId(order.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedOrder =
        await orderService
          .updateAdminOrderStatus(
            order.id,
            {
              status: nextStatus,
            },
          );

      setOrders((currentOrders) =>
        currentOrders.map(
          (currentOrder) =>
            currentOrder.id === order.id
              ? updatedOrder
              : currentOrder,
        ),
      );

      setStatusDrafts((current) => ({
        ...current,
        [order.id]:
          updatedOrder.status,
      }));

      setSuccessMessage(
        `Order #${formatOrderNumber(
          order.id,
        )} is now ${formatStatus(
          updatedOrder.status,
        )}.`,
      );
    } catch (requestError) {
      setStatusDrafts((current) => ({
        ...current,
        [order.id]:
          order.status,
      }));

      setError(
        getErrorMessage(
          requestError,
        ),
      );
    } finally {
      setBusyOrderId(null);
    }
  }

  if (isLoading) {
    return (
      <section
        aria-live="polite"
        className="admin-panel"
      >
        <p>Loading customer orders...</p>
      </section>
    );
  }

  return (
    <section className="admin-orders-page">
      <div className="admin-section-heading">
        <div>
          <h2>Orders</h2>

          <p>
            Review customer purchases,
            delivery details and fulfilment
            progress.
          </p>
        </div>
      </div>

      {error && (
        <p
          className="admin-message admin-error"
          role="alert"
        >
          {error}
        </p>
      )}

      {successMessage && (
        <p
          className="admin-message admin-success"
          role="status"
        >
          {successMessage}
        </p>
      )}

      <div className="admin-orders-summary">
        <article>
          <span>Total orders</span>

          <strong>{orders.length}</strong>
        </article>

        <article>
          <span>Pending</span>

          <strong>{summary.pending}</strong>
        </article>

        <article>
          <span>Processing</span>

          <strong>
            {summary.processing}
          </strong>
        </article>

        <article>
          <span>Shipped</span>

          <strong>{summary.shipped}</strong>
        </article>

        <article>
          <span>Paid revenue</span>

          <strong>
            {formatPrice(
              summary.paidRevenue,
            )}
          </strong>
        </article>
      </div>

      <section className="admin-panel admin-orders-filters">
        <div className="admin-filter-field admin-orders-search">
          <label htmlFor="admin-order-search">
            Search orders
          </label>

          <input
            id="admin-order-search"
            onChange={(event) =>
              setSearchQuery(
                event.target.value,
              )
            }
            placeholder="Order number, customer, phone, city, product or SKU"
            type="search"
            value={searchQuery}
          />
        </div>

        <div className="admin-filter-field">
          <label htmlFor="admin-order-status-filter">
            Order status
          </label>

          <select
            id="admin-order-status-filter"
            onChange={(event) =>
              setStatusFilter(
                event.target
                  .value as OrderFilter,
              )
            }
            value={statusFilter}
          >
            <option value="all">
              All statuses
            </option>

            {ORDER_STATUSES.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {formatStatus(status)}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="admin-filter-field">
          <label htmlFor="admin-payment-status-filter">
            Payment status
          </label>

          <select
            id="admin-payment-status-filter"
            onChange={(event) =>
              setPaymentFilter(
                event.target
                  .value as PaymentFilter,
              )
            }
            value={paymentFilter}
          >
            <option value="all">
              All payments
            </option>

            {PAYMENT_STATUSES.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {formatStatus(status)}
                </option>
              ),
            )}
          </select>
        </div>
      </section>

      <p className="admin-orders-results">
        Showing{" "}
        <strong>
          {filteredOrders.length}
        </strong>{" "}
        of{" "}
        <strong>{orders.length}</strong>{" "}
        orders
      </p>

      {filteredOrders.length === 0 ? (
        <section className="admin-panel admin-empty-products">
          <h3>No matching orders</h3>

          <p>
            Change the search or filter
            options.
          </p>
        </section>
      ) : (
        <div className="admin-orders-list">
          {filteredOrders.map(
            (order) => {
              const isBusy =
                busyOrderId === order.id;

              const draftStatus =
                statusDrafts[order.id] ??
                order.status;

              return (
                <article
                  className="admin-order-card"
                  key={order.id}
                >
                  <div className="admin-order-card-header">
                    <div>
                      <p>Order</p>

                      <h3>
                        #
                        {formatOrderNumber(
                          order.id,
                        )}
                      </h3>

                      <span>
                        {formatDate(
                          order.created_at,
                        )}
                      </span>
                    </div>

                    <div className="admin-order-card-badges">
                      <span
                        className={`admin-order-status-badge ${order.status}`}
                      >
                        {formatStatus(
                          order.status,
                        )}
                      </span>

                      <span
                        className={`admin-payment-status-badge ${order.payment_status}`}
                      >
                        Payment:{" "}
                        {formatStatus(
                          order.payment_status,
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="admin-order-overview">
                    <div>
                      <span>Customer</span>

                      <strong>
                        {order.recipient_name}
                      </strong>

                      <a
                        href={`tel:${order.recipient_phone}`}
                      >
                        {order.recipient_phone}
                      </a>
                    </div>

                    <div>
                      <span>Items</span>

                      <strong>
                        {getOrderItemQuantity(
                          order,
                        )}
                      </strong>

                      <small>
                        {order.items.length} line
                        {order.items.length === 1
                          ? ""
                          : "s"}
                      </small>
                    </div>

                    <div>
                      <span>Total</span>

                      <strong>
                        {formatPrice(
                          order.total_paise,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Delivery city</span>

                      <strong>
                        {order.city}
                      </strong>

                      <small>
                        {order.state}
                      </small>
                    </div>
                  </div>

                  <div className="admin-order-status-editor">
                    <div className="admin-filter-field">
                      <label
                        htmlFor={`order-status-${order.id}`}
                      >
                        Change fulfilment status
                      </label>

                      <select
                        disabled={isBusy}
                        id={`order-status-${order.id}`}
                        onChange={(event) =>
                          updateStatusDraft(
                            order.id,
                            event.target
                              .value as OrderStatus,
                          )
                        }
                        value={draftStatus}
                      >
                        {ORDER_STATUSES.map(
                          (status) => (
                            <option
                              key={status}
                              value={status}
                            >
                              {formatStatus(
                                status,
                              )}
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <button
                      className="admin-primary-button"
                      disabled={
                        isBusy ||
                        draftStatus ===
                          order.status
                      }
                      onClick={() =>
                        void handleUpdateStatus(
                          order,
                        )
                      }
                      type="button"
                    >
                      {isBusy
                        ? "Updating..."
                        : "Update status"}
                    </button>
                  </div>

                  <details className="admin-order-details">
                    <summary>
                      View complete order details
                    </summary>

                    <div className="admin-order-detail-grid">
                      <section>
                        <h4>Delivery address</h4>

                        <address>
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
                              Landmark:{" "}
                              {order.landmark}
                            </span>
                          )}

                          <span>
                            {order.city},{" "}
                            {order.state}{" "}
                            {order.postal_code}
                          </span>

                          <span>
                            {order.country}
                          </span>

                          <a
                            href={`tel:${order.recipient_phone}`}
                          >
                            {order.recipient_phone}
                          </a>
                        </address>
                      </section>

                      <section>
                        <h4>Order information</h4>

                        <dl className="admin-order-information">
                          <div>
                            <dt>Full order ID</dt>

                            <dd>{order.id}</dd>
                          </div>

                          <div>
                            <dt>User ID</dt>

                            <dd>
                              {order.user_id}
                            </dd>
                          </div>

                          <div>
                            <dt>Created</dt>

                            <dd>
                              {formatDate(
                                order.created_at,
                              )}
                            </dd>
                          </div>

                          <div>
                            <dt>Last updated</dt>

                            <dd>
                              {formatDate(
                                order.updated_at,
                              )}
                            </dd>
                          </div>
                        </dl>
                      </section>
                    </div>

                    {order.customer_note && (
                      <section className="admin-order-note">
                        <h4>Customer note</h4>

                        <p>
                          {order.customer_note}
                        </p>
                      </section>
                    )}

                    <section className="admin-order-items-section">
                      <h4>Ordered products</h4>

                      <div className="admin-order-items-table-wrapper">
                        <table className="admin-order-items-table">
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Variant</th>
                              <th>SKU</th>
                              <th>Quantity</th>
                              <th>Price</th>
                              <th>Total</th>
                            </tr>
                          </thead>

                          <tbody>
                            {order.items.map(
                              (item) => (
                                <tr key={item.id}>
                                  <td>
                                    {item.product_name}
                                  </td>

                                  <td>
                                    <strong>
                                      {item.variant_name}
                                    </strong>

                                    {item.size_label && (
                                      <small>
                                        {
                                          item.size_label
                                        }
                                      </small>
                                    )}

                                    {item.colour && (
                                      <small>
                                        {item.colour}
                                      </small>
                                    )}
                                  </td>

                                  <td>
                                    {item.sku}
                                  </td>

                                  <td>
                                    {item.quantity}
                                  </td>

                                  <td>
                                    {formatPrice(
                                      item.unit_price_paise,
                                    )}
                                  </td>

                                  <td>
                                    {formatPrice(
                                      item.line_total_paise,
                                    )}
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <section className="admin-order-totals">
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

                      <div>
                        <span>Order total</span>

                        <strong>
                          {formatPrice(
                            order.total_paise,
                          )}
                        </strong>
                      </div>
                    </section>

                    {(order.razorpay_order_id ||
                      order.razorpay_payment_id) && (
                      <section className="admin-order-payment-ids">
                        <h4>
                          Payment references
                        </h4>

                        {order.razorpay_order_id && (
                          <p>
                            Razorpay order:{" "}
                            <code>
                              {
                                order.razorpay_order_id
                              }
                            </code>
                          </p>
                        )}

                        {order.razorpay_payment_id && (
                          <p>
                            Razorpay payment:{" "}
                            <code>
                              {
                                order.razorpay_payment_id
                              }
                            </code>
                          </p>
                        )}
                      </section>
                    )}
                  </details>
                </article>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}

export default AdminOrdersPage;