import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";

import { formatPrice } from "../lib/currency";
import {
  getAdminCollections,
} from "../services/collections";
import { orderService } from "../services/orders";
import {
  getAdminProducts,
} from "../services/products";
import type {
  Collection,
} from "../types/collection";
import type {
  OrderSummary,
} from "../types/order";
import type {
  Product,
} from "../types/product";

interface DashboardData {
  collections: Collection[];
  products: Product[];
  orders: OrderSummary[];
}

const emptyDashboardData: DashboardData = {
  collections: [],
  products: [],
  orders: [],
};

function formatStatus(
  value: string,
): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function AdminDashboardPage() {
  const [data, setData] =
    useState<DashboardData>(
      emptyDashboardData,
    );

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const controller =
      new AbortController();

    let isActive = true;

    async function loadDashboard(): Promise<void> {
      try {
        const [
          collections,
          products,
          orders,
        ] = await Promise.all([
          getAdminCollections(
            controller.signal,
          ),

          getAdminProducts(
            controller.signal,
          ),

          orderService.listAdminOrders(
            controller.signal,
          ),
        ]);

        if (isActive) {
          setData({
            collections,
            products,
            orders,
          });
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
            requestError instanceof Error
              ? requestError.message
              : "Unable to load the admin dashboard.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const dashboardValues = useMemo(() => {
    const activeProducts =
      data.products.filter(
        (product) =>
          product.is_active,
      ).length;

    const pendingOrders =
      data.orders.filter(
        (order) =>
          order.status === "pending",
      ).length;

    const totalRevenuePaise =
      data.orders
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

    const recentOrders = [
      ...data.orders,
    ]
      .sort(
        (
          firstOrder,
          secondOrder,
        ) =>
          new Date(
            secondOrder.created_at,
          ).getTime() -
          new Date(
            firstOrder.created_at,
          ).getTime(),
      )
      .slice(0, 5);

    return {
      activeProducts,
      pendingOrders,
      totalRevenuePaise,
      recentOrders,
    };
  }, [data]);

  if (isLoading) {
    return (
      <section
        aria-live="polite"
        className="admin-panel"
      >
        <p>
          Loading store information...
        </p>
      </section>
    );
  }

  return (
    <section className="admin-dashboard">
      {error && (
        <p
          className="admin-message admin-error"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="admin-section-heading">
        <div>
          <h2>Store overview</h2>

          <p>
            Current catalogue and order
            information.
          </p>
        </div>
      </div>

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <span>Products</span>

          <strong>
            {data.products.length}
          </strong>

          <small>
            {dashboardValues.activeProducts} active
          </small>
        </article>

        <article className="admin-stat-card">
          <span>Collections</span>

          <strong>
            {data.collections.length}
          </strong>

          <small>Homepage groups</small>
        </article>

        <article className="admin-stat-card">
          <span>Orders</span>

          <strong>
            {data.orders.length}
          </strong>

          <small>
            {dashboardValues.pendingOrders} pending
          </small>
        </article>

        <article className="admin-stat-card">
          <span>Paid revenue</span>

          <strong>
            {formatPrice(
              dashboardValues.totalRevenuePaise,
            )}
          </strong>

          <small>
            Paid orders only
          </small>
        </article>
      </div>

      <div className="admin-quick-grid">
        <Link
          className="admin-quick-card"
          to="/admin/products"
        >
          <span>Catalogue</span>

          <h3>Manage products</h3>

          <p>
            Add products and edit product
            information, images and variants.
          </p>
        </Link>

        <Link
          className="admin-quick-card"
          to="/admin/collections"
        >
          <span>Homepage</span>

          <h3>Manage collections</h3>

          <p>
            Change collection names,
            descriptions and display order.
          </p>
        </Link>

        <Link
          className="admin-quick-card"
          to="/admin/inventory"
        >
          <span>Stock</span>

          <h3>Manage inventory</h3>

          <p>
            Review variant stock and update
            available quantities.
          </p>
        </Link>

        <Link
          className="admin-quick-card"
          to="/admin/orders"
        >
          <span>Fulfilment</span>

          <h3>Manage orders</h3>

          <p>
            Review customer orders and update
            their fulfilment status.
          </p>
        </Link>
      </div>

      <section className="admin-panel admin-recent-orders">
        <div className="admin-section-heading">
          <div>
            <h2>Recent orders</h2>

            <p>
              The five newest customer orders.
            </p>
          </div>

          <Link to="/admin/orders">
            View all orders
          </Link>
        </div>

        {dashboardValues.recentOrders.length ===
        0 ? (
          <p className="admin-empty-message">
            No orders yet.
          </p>
        ) : (
          <div className="admin-order-table-wrapper">
            <table className="admin-order-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {dashboardValues.recentOrders.map(
                  (order) => (
                    <tr key={order.id}>
                      <td>
                        #
                        {order.id
                          .slice(0, 8)
                          .toUpperCase()}
                      </td>

                      <td>
                        {new Date(
                          order.created_at,
                        ).toLocaleDateString(
                          "en-IN",
                        )}
                      </td>

                      <td>
                        {formatStatus(
                          order.status,
                        )}
                      </td>

                      <td>
                        {formatStatus(
                          order.payment_status,
                        )}
                      </td>

                      <td>
                        {formatPrice(
                          order.total_paise,
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

export default AdminDashboardPage;