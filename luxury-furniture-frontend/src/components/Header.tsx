import {
  useCallback,
  useState,
} from "react";
import {
  Link,
  useLocation,
} from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import ProductSearch from "./ProductSearch";
import {
  useFavourites,
} from "../hooks/useFavourites";

function Header() {
  const {
    session,
    isAdmin,
  } = useAuth();

  const location = useLocation();

const isHomePage =
  location.pathname === "/";
  const {
    cart,
    isLoading: isCartLoading,
  } = useCart();
  const {
  favouriteCount,
  isLoading: isFavouritesLoading,
} = useFavourites();

  const [isSearchOpen, setIsSearchOpen] =
    useState(false);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const totalQuantity =
    cart?.total_quantity ?? 0;

  return (
    <>
      <header
  className={
    isHomePage
      ? "site-header site-header-transparent"
      : "site-header"
  }
>
        <div className="header-inner">
          <Link
            className="brand"
            to="/"
          >
            Royal Home Decor
          </Link>

          <div className="header-actions">
            {isAdmin && (
              <Link
                aria-label="Open admin dashboard"
                className="header-icon-link admin-header-link"
                title="Admin dashboard"
                to="/admin"
              >
                <svg
                  fill="none"
                  height="20"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="20"
                >
                  <rect
                    height="7"
                    width="7"
                    x="3"
                    y="3"
                  />

                  <rect
                    height="7"
                    width="7"
                    x="14"
                    y="3"
                  />

                  <rect
                    height="7"
                    width="7"
                    x="3"
                    y="14"
                  />

                  <rect
                    height="7"
                    width="7"
                    x="14"
                    y="14"
                  />
                </svg>
              </Link>
            )}

            <button
              aria-label="Search products"
              className="header-icon-button"
              onClick={() =>
                setIsSearchOpen(true)
              }
              title="Search products"
              type="button"
            >
              <svg
                fill="none"
                height="20"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="20"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="8"
                />

                <line
                  x1="21"
                  x2="16.65"
                  y1="21"
                  y2="16.65"
                />
              </svg>
            </button>
            <Link
  aria-label="Shop all products"
  className="header-store-link"
  title="Shop all products"
  to="/shop"
>
  <svg
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.7"
    viewBox="0 0 24 24"
  >
    <path d="M4 9 6 4h12l2 5" />

    <path d="M5 13v7h14v-7" />

    <path d="M9 20v-5h6v5" />

    <path d="M3 9a3 3 0 0 0 6 0" />

    <path d="M9 9a3 3 0 0 0 6 0" />

    <path d="M15 9a3 3 0 0 0 6 0" />
  </svg>

  <span className="header-store-tooltip">
    Shop
  </span>
</Link>

    <Link
  aria-label={`Open favourites with ${favouriteCount} saved products`}
  className="header-icon-link favourite-icon-link"
  title="Favourites"
  to="/favourites"
>
  <svg
    fill={
      favouriteCount > 0
        ? "currentColor"
        : "none"
    }
    height="20"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="20"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>

  {!isFavouritesLoading &&
    favouriteCount > 0 && (
      <span className="cart-count">
        {favouriteCount > 99
          ? "99+"
          : favouriteCount}
      </span>
    )}
</Link>

            <Link
              aria-label={
                session
                  ? "Open account"
                  : "Sign in"
              }
              className="header-icon-link"
              to={
                session
                  ? "/account"
                  : "/login"
              }
            >
              <svg
                fill="none"
                height="20"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="20"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />

                <circle
                  cx="12"
                  cy="7"
                  r="4"
                />
              </svg>
            </Link>

            <Link
              aria-label={`Open cart with ${totalQuantity} items`}
              className="header-icon-link cart-icon-link"
              to="/cart"
            >
              <svg
                fill="none"
                height="20"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="20"
              >
                <circle
                  cx="9"
                  cy="21"
                  r="1"
                />

                <circle
                  cx="20"
                  cy="21"
                  r="1"
                />

                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>

              {!isCartLoading &&
                totalQuantity > 0 && (
                  <span className="cart-count">
                    {totalQuantity > 99
                      ? "99+"
                      : totalQuantity}
                  </span>
                )}
            </Link>
          </div>
        </div>
      </header>

      <ProductSearch
        isOpen={isSearchOpen}
        onClose={closeSearch}
      />
    </>
  );
}

export default Header;