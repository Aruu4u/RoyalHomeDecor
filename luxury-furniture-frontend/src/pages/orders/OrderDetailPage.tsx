import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";

import { ErrorState, PageLoader } from "../../components/ui/Feedback";
import Reveal from "../../components/ui/Reveal";
import { useAsync } from "../../hooks/useAsync";
import { formatPrice } from "../../lib/currency";
import { orderService } from "../../services/orders";
import {
  formatOrderDate,
  orderReference,
  ORDER_STAGES,
  ORDER_STATUS_DESCRIPTIONS,
  ORDER_STATUS_LABELS,
  orderStatusTone,
  PAYMENT_STATUS_LABELS,
  paymentStatusTone,
} from "./orderStatus";

import "../account/account.css";
import "./orders.css";

function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();

  const { data: order, isLoading, error, reload } = useAsync(
    useCallback(
      (signal: AbortSignal) => {
        if (!orderId) {
          return Promise.reject(new Error("This order could not be found."));
        }

        return orderService.getOrder(orderId, signal);
      },
      [orderId],
    ),
    [orderId],
    "Unable to load this order.",
  );

  if (isLoading) {
    return <PageLoader label="Loading order" />;
  }

  if (error || !order) {
    return (
      <div className="shell order-detail-page">
        <ErrorState
          message={error ?? "This order could not be found."}
          onRetry={reload}
          title="We could not load this order"
        />
      </div>
    );
  }

  const isCancelled = order.status === "cancelled";
  const currentStageIndex = ORDER_STAGES.indexOf(order.status);

  return (
    <div className="shell order-detail-page page-enter">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link to="/account">Account</Link>
        <span aria-hidden="true">/</span>
        <Link to="/orders">Orders</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{orderReference(order.id)}</span>
      </nav>

      <header className="order-detail-header">
        <div>
          <p className="eyebrow">Order {orderReference(order.id)}</p>

          <h1 className="order-detail-title">
            {ORDER_STATUS_LABELS[order.status]}
          </h1>

          <p className="lede">{ORDER_STATUS_DESCRIPTIONS[order.status]}</p>
        </div>

        <div className="order-detail-badges">
          <span className={`badge ${orderStatusTone(order.status)}`}>
            {ORDER_STATUS_LABELS[order.status]}
          </span>

          <span className={`badge ${paymentStatusTone(order.payment_status)}`}>
            {PAYMENT_STATUS_LABELS[order.payment_status]}
          </span>
        </div>
      </header>

      {/* ---------- Progress ---------- */}

      {isCancelled ? (
        <p className="notice notice-error order-cancelled">
          This order was cancelled. If that was not expected, get in touch
          and we will look into it.
        </p>
      ) : (
        <ol className="order-progress">
          {ORDER_STAGES.map((stage, index) => (
            <li
              className={[
                "order-progress-step",
                index < currentStageIndex ? "is-complete" : "",
                index === currentStageIndex ? "is-current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={stage}
            >
              <span aria-hidden="true" className="order-progress-marker" />

              <span className="order-progress-label">
                {ORDER_STATUS_LABELS[stage]}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="order-detail-layout">
        <div className="order-detail-main">
          {/* ---------- Items ---------- */}

          <section className="panel">
            <h2 className="account-panel-title order-section-title">
              {order.items.length} item{order.items.length === 1 ? "" : "s"}
            </h2>

            <ul className="order-items">
              {order.items.map((item, index) => (
                <Reveal as="li" delay={index * 40} key={item.id}>
                  <div className="order-item">
                    <div className="order-item-info">
                      <p className="order-item-name">{item.product_name}</p>

                      <p className="order-item-meta">
                        {item.variant_name}
                        {item.size_label ? ` \u00B7 ${item.size_label}` : ""}
                        {item.colour ? ` \u00B7 ${item.colour}` : ""}
                      </p>

                      <p className="order-item-sku">SKU {item.sku}</p>
                    </div>

                    <p className="order-item-quantity">
                      {formatPrice(item.unit_price_paise)} &times;{" "}
                      {item.quantity}
                    </p>

                    <p className="order-item-total">
                      {formatPrice(item.line_total_paise)}
                    </p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </section>

          {/* ---------- Delivery ---------- */}

          <section className="panel">
            <h2 className="account-panel-title order-section-title">
              Delivery address
            </h2>

            <address className="order-address">
              <strong>{order.recipient_name}</strong>
              <br />
              {order.address_line_1}
              {order.address_line_2 ? (
                <>
                  <br />
                  {order.address_line_2}
                </>
              ) : null}
              {order.landmark ? (
                <>
                  <br />
                  {order.landmark}
                </>
              ) : null}
              <br />
              {order.city}, {order.state} {order.postal_code}
              <br />
              {order.country}
              <br />
              <span className="order-address-phone">
                {order.recipient_phone}
              </span>
            </address>

            {order.customer_note && (
              <div className="order-note">
                <p className="field-label">Your note</p>
                <p>{order.customer_note}</p>
              </div>
            )}
          </section>
        </div>

        {/* ---------- Totals ---------- */}

        <aside className="order-summary">
          <h2 className="cart-summary-title">Payment</h2>

          <div className="cart-summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(order.subtotal_paise)}</span>
          </div>

          <div className="cart-summary-row">
            <span>Shipping</span>
            <span>
              {order.shipping_paise === 0
                ? "Free"
                : formatPrice(order.shipping_paise)}
            </span>
          </div>

          <div className="cart-summary-total">
            <span>Total</span>
            <strong>{formatPrice(order.total_paise)}</strong>
          </div>

          <dl className="order-meta">
            <div>
              <dt>Placed</dt>
              <dd>{formatOrderDate(order.created_at)}</dd>
            </div>

            <div>
              <dt>Last update</dt>
              <dd>{formatOrderDate(order.updated_at)}</dd>
            </div>

            <div>
              <dt>Reference</dt>
              <dd>{orderReference(order.id)}</dd>
            </div>
          </dl>

          <Link className="btn btn-outline btn-block" to="/orders">
            Back to orders
          </Link>
        </aside>
      </div>
    </div>
  );
}

export default OrderDetailPage;
