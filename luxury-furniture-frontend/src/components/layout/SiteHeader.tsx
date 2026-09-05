import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { useCollections } from "../../hooks/useCatalogue";
import { useCart } from "../../hooks/useCart";
import { useFavourites } from "../../hooks/useFavourites";
import SearchOverlay from "./SearchOverlay";

const SCROLL_TRIGGER = 24;

function SiteHeader() {
  const location = useLocation();

  const { session, isAdmin } = useAuth();
  const { cart } = useCart();
  const { favouriteCount } = useFavourites();
  const { data: collections } = useCollections();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const frameRef = useRef<number | null>(null);

  const cartCount = cart?.total_quantity ?? 0;

  /*
   * Passive, rAF-throttled scroll listener. State only changes when the
   * header actually crosses the threshold, so this does not re-render
   * the header on every scroll event.
   */
  useEffect(() => {
    function handleScroll(): void {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        setIsScrolled(window.scrollY > SCROLL_TRIGGER);
      });
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);

  /* Any navigation closes the mobile drawer. */
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.dataset.scrollLocked = "true";
    } else {
      delete document.body.dataset.scrollLocked;
    }

    return () => {
      delete document.body.dataset.scrollLocked;
    };
  }, [isMenuOpen]);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const navCollections = (collections ?? []).slice(0, 5);

  return (
    <>
      <header className={isScrolled ? "site-header is-stuck" : "site-header"}>
        <div className="site-header-inner shell">
          <button
            aria-controls="mobile-menu"
            aria-expanded={isMenuOpen}
            aria-label="Open menu"
            className="header-burger"
            onClick={() => setIsMenuOpen((open) => !open)}
            type="button"
          >
            <span className={isMenuOpen ? "burger-lines is-open" : "burger-lines"}>
              <span />
              <span />
            </span>
          </button>

          <Link className="brand" to="/">
            <span className="brand-mark">Royal</span>
            <span className="brand-word">Home Decor</span>
          </Link>

          <nav aria-label="Main" className="header-nav">
            <NavLink className="header-nav-link" to="/" end>
              Home
            </NavLink>

            <NavLink className="header-nav-link" to="/shop">
              Shop All
            </NavLink>

            {navCollections.map((collection) => (
              <NavLink
                className="header-nav-link"
                key={collection.id}
                to={`/collections/${collection.slug}`}
              >
                {collection.name}
              </NavLink>
            ))}
          </nav>

          <div className="header-actions">
            <button
              aria-label="Search products"
              className="header-icon"
              onClick={() => setIsSearchOpen(true)}
              type="button"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="20"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.7"
                viewBox="0 0 24 24"
                width="20"
              >
                <circle cx="11" cy="11" r="7.5" />
                <path d="M20 20l-4-4" />
              </svg>
            </button>

            <Link
              aria-label={`Favourites, ${favouriteCount} saved`}
              className="header-icon"
              to="/favourites"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="20"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.7"
                viewBox="0 0 24 24"
                width="20"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>

              {favouriteCount > 0 && (
                <span className="header-badge">{favouriteCount}</span>
              )}
            </Link>

            <Link
              aria-label={session ? "Your account" : "Sign in"}
              className="header-icon"
              to={session ? "/account" : "/login"}
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="20"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.7"
                viewBox="0 0 24 24"
                width="20"
              >
                <circle cx="12" cy="8" r="3.6" />
                <path d="M4.5 20c1.4-3.6 4.2-5.4 7.5-5.4s5.9 1.8 7.5 5.4" />
              </svg>
            </Link>

            <Link
              aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
              className="header-icon header-cart"
              to="/cart"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="20"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.7"
                viewBox="0 0 24 24"
                width="20"
              >
                <path d="M4 7h16l-1.3 12.2a1.6 1.6 0 0 1-1.6 1.4H6.9a1.6 1.6 0 0 1-1.6-1.4z" />
                <path d="M8.6 7V5.6a3.4 3.4 0 0 1 6.8 0V7" />
              </svg>

              {cartCount > 0 && (
                <span className="header-badge is-gold">{cartCount}</span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- Mobile drawer ---------- */}

      <div
        className={isMenuOpen ? "mobile-menu is-open" : "mobile-menu"}
        id="mobile-menu"
      >
        <button
          aria-label="Close menu"
          className="mobile-menu-backdrop"
          onClick={() => setIsMenuOpen(false)}
          tabIndex={isMenuOpen ? 0 : -1}
          type="button"
        />

        <nav aria-label="Mobile" className="mobile-menu-panel">
          <p className="eyebrow">Browse</p>

          <NavLink className="mobile-menu-link" to="/" end>
            Home
          </NavLink>

          <NavLink className="mobile-menu-link" to="/shop">
            Shop All
          </NavLink>

          {(collections ?? []).map((collection) => (
            <NavLink
              className="mobile-menu-link"
              key={collection.id}
              to={`/collections/${collection.slug}`}
            >
              {collection.name}
            </NavLink>
          ))}

          <p className="eyebrow mobile-menu-divider">Account</p>

          {session ? (
            <>
              <NavLink className="mobile-menu-link" to="/account">
                Your account
              </NavLink>

              <NavLink className="mobile-menu-link" to="/orders">
                Orders
              </NavLink>

              <NavLink className="mobile-menu-link" to="/favourites">
                Favourites
              </NavLink>

              {isAdmin && (
                <NavLink className="mobile-menu-link" to="/admin">
                  Admin dashboard
                </NavLink>
              )}
            </>
          ) : (
            <>
              <NavLink className="mobile-menu-link" to="/login">
                Sign in
              </NavLink>

              <NavLink className="mobile-menu-link" to="/signup">
                Create an account
              </NavLink>
            </>
          )}
        </nav>
      </div>

      <SearchOverlay isOpen={isSearchOpen} onClose={closeSearch} />
    </>
  );
}

export default SiteHeader;
