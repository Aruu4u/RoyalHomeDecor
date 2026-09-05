import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import OfflineBanner from "../error/OfflineBanner";
import SlowConnectionBanner from "../error/SlowConnectionBanner";
import AnnouncementBar from "./AnnouncementBar";
import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";

import "./layout.css";
import "../ui/ui.css";
import "../product/product.css";

/**
 * Storefront shell: promise bar, header, routed page, footer.
 */
function Layout() {
  const location = useLocation();

  /*
   * Restore the top of the page on navigation. Hash links are left alone
   * so in-page anchors still work.
   */
  useEffect(() => {
    if (location.hash) {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname, location.search, location.hash]);

  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <AnnouncementBar />
      <SiteHeader />

      <main className="site-main" id="main">
        <Outlet />
      </main>

      <SiteFooter />

      {/* Offline is the more urgent of the two and wins the bottom slot. */}
      <OfflineBanner />
      <SlowConnectionBanner />
    </div>
  );
}

export default Layout;
