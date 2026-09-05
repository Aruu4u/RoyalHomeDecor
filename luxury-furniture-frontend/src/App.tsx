import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AdminRoute } from "./components/admin/AdminRoute";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import Layout from "./components/layout/Layout";
import { PageLoader } from "./components/ui/Feedback";

/* =========================================================
   ROUTES

   Every page is code-split. The storefront entry chunk only has to
   carry the shell plus the home page; the admin dashboard and the
   account area are fetched on demand.
   ========================================================= */

/* ---------- Rebuilt storefront pages ---------- */

const HomePage = lazy(() => import("./pages/home/HomePage"));
const ShopPage = lazy(() => import("./pages/shop/ShopPage"));
const ProductPage = lazy(() => import("./pages/product/ProductPage"));
const CartPage = lazy(() => import("./pages/cart/CartPage"));
const CheckoutPage = lazy(() => import("./pages/checkout/CheckoutPage"));
const OrdersPage = lazy(() => import("./pages/orders/OrdersPage"));
const OrderDetailPage = lazy(() => import("./pages/orders/OrderDetailPage"));
const AccountPage = lazy(() => import("./pages/account/AccountPage"));
const AddressesPage = lazy(() => import("./pages/account/AddressesPage"));
const FavouritesPage = lazy(() => import("./pages/account/FavouritesPage"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const SignupPage = lazy(() => import("./pages/auth/SignupPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

/* ---------- Admin (unchanged, lazily loaded) ---------- */

const AdminLayout = lazy(() =>
  import("./components/admin/AdminLayout").then((module) => ({
    default: module.AdminLayout,
  })),
);

const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AdminProductsPage = lazy(() => import("./pages/AdminProductsPage"));
const AdminNewProductPage = lazy(() => import("./pages/AdminNewProductPage"));
const AdminEditProductPage = lazy(() => import("./pages/AdminEditProductPage"));
const AdminCollectionsPage = lazy(() => import("./pages/AdminCollectionsPage"));
const AdminOffersPage = lazy(() => import("./pages/AdminOffersPage"));
const AdminInventoryPage = lazy(() => import("./pages/AdminInventoryPage"));
const AdminOrdersPage = lazy(() => import("./pages/AdminOrdersPage"));

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<Layout />}>
          <Route element={<HomePage />} index />

          {/* ---------- Catalogue ---------- */}

          <Route element={<ShopPage />} path="shop" />
          <Route element={<ShopPage />} path="collections/:collectionSlug" />
          <Route element={<ProductPage />} path="products/:slug" />

          {/* ---------- Auth ---------- */}

          <Route element={<LoginPage />} path="login" />
          <Route element={<SignupPage />} path="signup" />

          {/* ---------- Shopping ---------- */}

          <Route
            element={
              <ProtectedRoute>
                <CartPage />
              </ProtectedRoute>
            }
            path="cart"
          />

          <Route
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            }
            path="checkout"
          />

          {/* ---------- Account ---------- */}

          <Route
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
            path="account"
          />

          <Route
            element={
              <ProtectedRoute>
                <AddressesPage />
              </ProtectedRoute>
            }
            path="addresses"
          />

          <Route
            element={
              <ProtectedRoute>
                <FavouritesPage />
              </ProtectedRoute>
            }
            path="favourites"
          />

          <Route
            element={
              <ProtectedRoute>
                <OrdersPage />
              </ProtectedRoute>
            }
            path="orders"
          />

          <Route
            element={
              <ProtectedRoute>
                <OrderDetailPage />
              </ProtectedRoute>
            }
            path="orders/:orderId"
          />

          {/* Legacy account URLs kept working. */}
          <Route
            element={<Navigate replace to="/addresses" />}
            path="account/addresses"
          />

          <Route
            element={<Navigate replace to="/orders" />}
            path="account/orders"
          />

          {/* ---------- Admin ---------- */}

          <Route
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
            path="admin"
          >
            <Route element={<AdminDashboardPage />} index />
            <Route element={<AdminProductsPage />} path="products" />
            <Route element={<AdminNewProductPage />} path="products/new" />
            <Route
              element={<AdminEditProductPage />}
              path="products/:productId/edit"
            />
            <Route element={<AdminCollectionsPage />} path="collections" />
            <Route element={<AdminOffersPage />} path="offers" />
            <Route element={<AdminInventoryPage />} path="inventory" />
            <Route element={<AdminOrdersPage />} path="orders" />
          </Route>

          <Route element={<NotFoundPage />} path="*" />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
