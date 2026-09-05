import { Link } from "react-router-dom";

import {
  CONTACT,
  CONTACT_LINKS,
  primaryPhone,
  telLink,
  whatsappLink,
} from "../../config/contact";
import { useCollections } from "../../hooks/useCatalogue";

const SUPPORT_LINKS = [
  { label: "Shop all", to: "/shop" },
  { label: "Your orders", to: "/orders" },
  { label: "Favourites", to: "/favourites" },
  { label: "Saved addresses", to: "/addresses" },
];

function SiteFooter() {
  const { data: collections } = useCollections();

  return (
    <footer className="site-footer" id="contact">
      <div className="shell site-footer-inner">
        <div className="footer-brand">
          <p className="brand">
            <span className="brand-mark">Royal</span>
            <span className="brand-word">Home Decor</span>
          </p>

          <p className="footer-copy">
            Handcrafted marble, metal and resin pieces made to order by
            artisan families. Every piece is finished by hand, so no two
            are ever quite the same.
          </p>

          <div className="footer-promises">
            <span className="badge badge-neutral">Secure payment</span>
            <span className="badge badge-neutral">
              Free shipping over &#8377;500
            </span>
            <span className="badge badge-neutral">3-day returns</span>
          </div>
        </div>

        <nav aria-label="Collections" className="footer-column">
          <h3 className="footer-heading">Collections</h3>

          <ul>
            {(collections ?? []).slice(0, 6).map((collection) => (
              <li key={collection.id}>
                <Link to={`/collections/${collection.slug}`}>
                  {collection.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Your account" className="footer-column">
          <h3 className="footer-heading">Your account</h3>

          <ul>
            {SUPPORT_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer-column">
          <h3 className="footer-heading">Contact us</h3>

          <ul>
            {CONTACT.phones.map((phone) => (
              <li key={phone.digits}>
                <a href={telLink(phone)}>{phone.display}</a>
              </li>
            ))}

            <li>
              <a href={CONTACT_LINKS.mail}>{CONTACT.email}</a>
            </li>

            <li>
              <a
                href={whatsappLink(primaryPhone())}
                rel="noreferrer noopener"
                target="_blank"
              >
                Message on WhatsApp
              </a>
            </li>
          </ul>

          <p className="footer-copy footer-workshop">
            {CONTACT.hours}
            <br />
            Workshop: {CONTACT.workshop}
          </p>
        </div>
      </div>

      <div className="shell site-footer-base">
        <p>
          &copy; {new Date().getFullYear()} Royal Home Decor. All rights
          reserved.
        </p>

        <p>Prices include GST.</p>
      </div>
    </footer>
  );
}

export default SiteFooter;
