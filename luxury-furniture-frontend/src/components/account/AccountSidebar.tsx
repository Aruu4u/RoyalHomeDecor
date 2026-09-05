import { useState } from "react";
import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";

interface AccountSidebarProps {
  onError?: (message: string) => void;
}

export function AccountSidebar({
  onError,
}: AccountSidebarProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [isSigningOut, setIsSigningOut] =
    useState(false);

  async function handleLogout(): Promise<void> {
    setIsSigningOut(true);

    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (requestError) {
      onError?.(
        requestError instanceof Error
          ? requestError.message
          : "Unable to sign out.",
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <aside className="account-sidebar">
      <NavLink
        className={({ isActive }) =>
          isActive
            ? "account-nav-item active"
            : "account-nav-item"
        }
        end
        to="/account"
      >
        Profile
      </NavLink>

      <NavLink
        className={({ isActive }) =>
          isActive
            ? "account-nav-item active"
            : "account-nav-item"
        }
        to="/account/addresses"
      >
        Addresses
      </NavLink>

        <NavLink
        className={({ isActive }) =>
            isActive
            ? "account-nav-item active"
            : "account-nav-item"
        }
        to="/account/orders"
        >
        Orders
        </NavLink>

      <button
        className="account-logout-button"
        disabled={isSigningOut}
        onClick={() => void handleLogout()}
        type="button"
      >
        {isSigningOut ? "Signing out..." : "Sign out"}
      </button>
    </aside>
  );
}