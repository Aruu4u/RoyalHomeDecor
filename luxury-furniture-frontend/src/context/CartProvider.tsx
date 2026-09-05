import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PropsWithChildren } from "react";

import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../services/api";
import { cartService } from "../services/cart";
import { profileService } from "../services/profile";
import type {
  Cart,
  CartContextValue,
  CartItem,
} from "../types/cart";
import { CartContext } from "./cart-context";

const PROFILE_REQUIRED_MESSAGE =
  "Complete your profile before using the cart.";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to update your cart.";
}

function isProfileMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

function recalculateCart(
  cart: Cart,
  items: CartItem[],
): Cart {
  return {
    ...cart,
    items,
    subtotal_paise: items.reduce(
      (total, item) =>
        total + item.line_total_paise,
      0,
    ),
    total_quantity: items.reduce(
      (total, item) => total + item.quantity,
      0,
    ),
    updated_at: new Date().toISOString(),
  };
}

export function CartProvider({
  children,
}: PropsWithChildren) {
  const { session } = useAuth();

  const [cart, setCart] = useState<Cart | null>(null);

  const [cartOwnerId, setCartOwnerId] =
    useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const [isMutating, setIsMutating] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const checkProfile = useCallback(
    async (): Promise<boolean> => {
      if (!session) {
        return false;
      }

      try {
        await profileService.getProfile();
        return true;
      } catch (requestError) {
        if (isProfileMissing(requestError)) {
          setCart(null);
          setCartOwnerId(null);
          setError(PROFILE_REQUIRED_MESSAGE);

          return false;
        }

        throw requestError;
      }
    },
    [session],
  );

  const refreshCart = useCallback(
    async (): Promise<void> => {
      if (!session) {
        setCart(null);
        setCartOwnerId(null);
        setError(null);
        setIsLoading(false);

        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const profileExists =
          await checkProfile();

        if (!profileExists) {
          return;
        }

        const cartData =
          await cartService.getCart();

        setCart(cartData);
        setCartOwnerId(session.user.id);
      } catch (requestError) {
        setError(getErrorMessage(requestError));
      } finally {
        setIsLoading(false);
      }
    },
    [checkProfile, session],
  );

  useEffect(() => {
    if (!session) {
      return;
    }

    const userId = session.user.id;
    let isActive = true;

    async function loadCart(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        const profileExists =
          await checkProfile();

        if (!isActive || !profileExists) {
          return;
        }

        const cartData =
          await cartService.getCart();

        if (isActive) {
          setCart(cartData);
          setCartOwnerId(userId);
        }
      } catch (requestError) {
        if (isActive) {
          setError(
            getErrorMessage(requestError),
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadCart();

    return () => {
      isActive = false;
    };
  }, [checkProfile, session]);

  const addItem = useCallback(
    async (
      variantId: string,
      quantity = 1,
    ): Promise<void> => {
      if (!session) {
        throw new Error(
          "Please sign in before adding an item to your cart.",
        );
      }

      setIsMutating(true);
      setError(null);

      try {
        const profileExists =
          await checkProfile();

        if (!profileExists) {
          throw new Error(
            PROFILE_REQUIRED_MESSAGE,
          );
        }

        const updatedCart =
          await cartService.addItem({
            variant_id: variantId,
            quantity,
          });

        setCart(updatedCart);
        setCartOwnerId(session.user.id);
      } catch (requestError) {
        setError(
          getErrorMessage(requestError),
        );

        throw requestError;
      } finally {
        setIsMutating(false);
      }
    },
    [checkProfile, session],
  );

  const updateItem = useCallback(
    async (
      itemId: string,
      quantity: number,
    ): Promise<void> => {
      setIsMutating(true);
      setError(null);

      try {
        const updatedCart =
          await cartService.updateItem(
            itemId,
            {
              quantity,
            },
          );

        setCart(updatedCart);
      } catch (requestError) {
        setError(
          getErrorMessage(requestError),
        );

        throw requestError;
      } finally {
        setIsMutating(false);
      }
    },
    [],
  );

  const removeItem = useCallback(
    async (itemId: string): Promise<void> => {
      setIsMutating(true);
      setError(null);

      try {
        await cartService.removeItem(itemId);

        setCart((currentCart) => {
          if (!currentCart) {
            return currentCart;
          }

          const remainingItems =
            currentCart.items.filter(
              (item) => item.id !== itemId,
            );

          return recalculateCart(
            currentCart,
            remainingItems,
          );
        });
      } catch (requestError) {
        setError(
          getErrorMessage(requestError),
        );

        throw requestError;
      } finally {
        setIsMutating(false);
      }
    },
    [],
  );

  const clearCart =
    useCallback(async (): Promise<void> => {
      setIsMutating(true);
      setError(null);

      try {
        await cartService.clearCart();

        setCart((currentCart) => {
          if (!currentCart) {
            return currentCart;
          }

          return recalculateCart(
            currentCart,
            [],
          );
        });
      } catch (requestError) {
        setError(
          getErrorMessage(requestError),
        );

        throw requestError;
      } finally {
        setIsMutating(false);
      }
    }, []);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  const visibleCart =
    session &&
    cartOwnerId === session.user.id
      ? cart
      : null;

  const visibleError = session ? error : null;

  const visibleIsLoading =
    session ? isLoading : false;

  const contextValue =
    useMemo<CartContextValue>(
      () => ({
        cart: visibleCart,
        isLoading: visibleIsLoading,
        isMutating,
        error: visibleError,
        refreshCart,
        addItem,
        updateItem,
        removeItem,
        clearCart,
        clearError,
      }),
      [
        visibleCart,
        visibleIsLoading,
        isMutating,
        visibleError,
        refreshCart,
        addItem,
        updateItem,
        removeItem,
        clearCart,
        clearError,
      ],
    );

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}