import { Link } from "react-router-dom";

function LuxuryFooter() {
  return (
    <footer className="luxury-footer">
      <div className="luxury-footer-line" />

      <div className="luxury-footer-grid">
        <section className="luxury-footer-brand">
          <p className="eyebrow">
            Royal Home Decor
          </p>

          <h2>
            Refined furniture and décor for homes
            with lasting presence.
          </h2>

          <p>
            Curated mirrors, wall décor, side tables,
            and centre tables selected for elegant
            modern interiors.
          </p>
        </section>

        <nav
          aria-label="Footer navigation"
          className="luxury-footer-column"
        >
          <h3>Explore</h3>

          <Link to="/#collections">
            Collections
          </Link>

          <Link to="/favourites">
            Favourites
          </Link>

          <Link to="/cart">
            Shopping cart
          </Link>
        </nav>

        <section className="luxury-footer-column">
          <h3>Client care</h3>

          <Link to="/account">
            My account
          </Link>

          <a href="mailto:hello@royalhomedecor.com">
            hello@royalhomedecor.com
          </a>

          <span>
            Crafted for beautiful homes
          </span>
        </section>
      </div>

      <div className="luxury-footer-bottom">
        <p>
          © {new Date().getFullYear()} Royal Home
          Decor
        </p>

        <p>
          Quiet luxury, thoughtfully curated.
        </p>
      </div>
    </footer>
  );
}

export default LuxuryFooter;
