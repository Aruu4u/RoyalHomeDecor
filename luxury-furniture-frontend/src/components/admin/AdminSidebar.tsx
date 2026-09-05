import { NavLink } from "react-router-dom";

function getNavClassName({
  isActive,
}: {
  isActive: boolean;
}): string {
  return isActive
    ? "admin-nav-link active"
    : "admin-nav-link";
}

export function AdminSidebar() {
  return (
    <aside
      aria-label="Admin navigation"
      className="admin-sidebar"
    >
      <p className="admin-sidebar-label">
        Store management
      </p>

      <nav className="admin-navigation">
        <NavLink
          className={getNavClassName}
          end
          to="/admin"
        >
          Dashboard
        </NavLink>

        <NavLink
          className={getNavClassName}
          to="/admin/products"
        >
          Products
        </NavLink>

        <NavLink
          className={getNavClassName}
          to="/admin/collections"
        >
          Collections
        </NavLink>

        <NavLink
          className={getNavClassName}
          to="/admin/offers"
        >
          Special offers
        </NavLink>

        <NavLink
          className={getNavClassName}
          to="/admin/inventory"
        >
          Inventory
        </NavLink>

        <NavLink
          className={getNavClassName}
          to="/admin/orders"
        >
          Orders
        </NavLink>
      </nav>

      <NavLink
        className="admin-storefront-link"
        to="/"
      >
        View storefront
      </NavLink>
    </aside>
  );
}