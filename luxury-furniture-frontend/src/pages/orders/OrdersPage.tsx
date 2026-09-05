import { useCallback } from "react";
import { Link } from "react-router-dom";

import AccountNav from "../../components/account/AccountNav";
import { EmptyState, PageLoader } from "../../components/ui/Feedback";
import Reveal from "../../components/ui/Reveal";
import { useAsync } from "../../hooks/useAsync";
import { formatPrice } from "../../lib/currency";
import { orderService } from "../../services/orders";
import {
  formatOrderDate,
  orderReference,
  ORDER_STATUS_LABELS,
  orderStatusTone,
  PAYMENT_STATUS_LABELS,
  paymentStatusTone,
} from "./orderStatus";

import "../account/account.css";
import "./orders.css";

function OrdersPage() {
  const { data: orders, isLoading, error, reload } = useAsync(
    useCallback((signal: AbortSignal) => orderService.listOrders(signal), []),
    [],
    "Unable to load your orders.",
  );

  if (isLoading) {
    return <PageLoader label="Loading your orders" />;
  }

  return (
    <div className="shell account-page page-enter">
      <header className="account-header">
        <p className="eyebrow">Your account</p>
        <h1 className="account-title">Orders</h1>

        <p className="lede account-subtitle">
          Track what you have ordered and revisit past purchases.
        </p>
      </header>

      <div className="account-layout">
        <AccountNav />

        <div className="account-content">
          {error && (
            <p className="notice notice-error" role="alert">
              {error}

              <button className="btn-quiet" onClick={reload} type="button">
                Retry
              </button>
            </p>
          )}

          {!error && (orders ?? []).length === 0 ? (
            <EmptyState
              actionLabel="Start shopping"
              actionTo="/shop"
              description="Once you place an order it will appear here with its progress."
              title="No orders yet"
            />
          ) : (
            <ul className="order-list">
              {(orders ?? []).map((order, index) => (
                <Reveal as="li" delay={index * 50} key={order.id}>
                  <Link className="order-row" to={`/orders/${order.id}`}>
                    <div className="order-row-main">
                      <p className="order-row-reference">
                        Order {orderReference(order.id)}
                      </p>

                      <p className="order-row-date">
                        Placed {formatOrderDate(order.created_at)}
                      </p>
                    </div>

                    <div className="order-row-badges">
                      <span className={`badge ${orderStatusTone(order.status)}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>

                      <span
                        className={`badge ${paymentStatusTone(
                          order.payment_status,
                        )}`}
                      >
                        {PAYMENT_STATUS_LABELS[order.payment_status]}
                      </span>
                    </div>

                    <p className="order-row-total">
                      {formatPrice(order.total_paise)}
                    </p>

                    <span aria-hidden="true" className="order-row-chevron">
                      <svg
                        fill="none"
                        height="14"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        viewBox="0 0 16 16"
                        width="14"
                      >
                        <path d="M6 3l5 5-5 5" />
                      </svg>
                    </span>
                  </Link>
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrdersPage;
