import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";
import { useFavourites } from "../../hooks/useFavourites";

/** Sidebar shared by every page in the account area. */
function AccountNav() {
  const navigate = useNavigate();

  const { isAdmin, signOut } = useAuth();
  const { cart } = useCart();
  const { favouriteCount } = useFavourites();

  async function handleSignOut(): Promise<void> {
    await signOut();
    navigate("/", { replace: true });
  }

  return (
    <nav aria-label="Account" className="account-nav">
      <NavLink className="account-nav-link" end to="/account">
        Profile
      </NavLink>

      <NavLink className="account-nav-link" to="/orders">
        Orders
      </NavLink>

      <NavLink className="account-nav-link" to="/addresses">
        Addresses
      </NavLink>

      <NavLink className="account-nav-link" to="/favourites">
        Favourites
        {favouriteCount > 0 && (
          <span className="account-nav-count">{favouriteCount}</span>
        )}
      </NavLink>

      <NavLink className="account-nav-link" to="/cart">
        Cart
        {(cart?.total_quantity ?? 0) > 0 && (
          <span className="account-nav-count">{cart?.total_quantity}</span>
        )}
      </NavLink>

      {isAdmin && (
        <NavLink className="account-nav-link" to="/admin">
          Admin
        </NavLink>
      )}

      <button
        className="account-signout"
        onClick={() => void handleSignOut()}
        type="button"
      >
        Sign out
      </button>
    </nav>
  );
}

export default AccountNav;
