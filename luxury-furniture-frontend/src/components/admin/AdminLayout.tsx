import { useEffect } from "react";
import { Outlet } from "react-router-dom";

import { AdminSidebar } from "./AdminSidebar";

/*
 * The admin dashboard still uses the original hand-written stylesheet,
 * which contains global rules (`img`, `.hero`, `.eyebrow`,
 * `.primary-button`) that collide with the storefront.
 *
 * A plain `import "...css"` will not do here. Vite injects such a
 * stylesheet into <head> on first load and leaves it there for the rest
 * of the session, so visiting /admin once permanently restyled the
 * storefront until a full refresh: `.hero::before` blurred the home
 * banner and `.hero h1` swallowed the headline text.
 *
 * Importing it with `?inline` hands us the CSS as a string without Vite
 * injecting anything, so it can be mounted on entry and removed on
 * exit. It still travels with the lazily loaded admin chunk, so the
 * storefront never downloads it.
 */
import adminStyles from "../../styles/admin-legacy.css?inline";

const STYLE_ELEMENT_ID = "admin-legacy-styles";

export function AdminLayout() {
  useEffect(() => {
    /*
     * StrictMode mounts effects twice in development. Reusing an
     * existing element keeps a single stylesheet in the document and
     * avoids the second cleanup tearing down the first one's styles.
     */
    let style = document.getElementById(
      STYLE_ELEMENT_ID,
    ) as HTMLStyleElement | null;

    let createdHere = false;

    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ELEMENT_ID;
      style.textContent = adminStyles;

      document.head.appendChild(style);
      createdHere = true;
    }

    return () => {
      if (createdHere) {
        style?.remove();
      }
    };
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-shell">
        <AdminSidebar />

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
