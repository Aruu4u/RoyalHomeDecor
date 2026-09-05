import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  addFavourite as addFavouriteRequest,
  getFavourites,
  removeFavourite as removeFavouriteRequest,
} from "../services/favourites";
import type {
  Favourite,
} from "../types/favourite";
import { useAuth } from "../hooks/useAuth";
import {
  FavouriteContext,
} from "./favourite-context";

interface FavouriteProviderProps {
  children: React.ReactNode;
}

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Unable to update your favourites.";
}

export function FavouriteProvider({
  children,
}: FavouriteProviderProps) {
  const { session } = useAuth();

  const userId =
    session?.user.id ?? null;

  const [favourites, setFavourites] =
    useState<Favourite[]>([]);

  const [
    busyProductIds,
    setBusyProductIds,
  ] = useState<Set<string>>(
    () => new Set(),
  );

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const controller =
      new AbortController();

    let isActive = true;

    async function synchronizeFavourites():
      Promise<void> {
      await Promise.resolve();

      if (!isActive) {
        return;
      }

      if (!userId) {
        setFavourites([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const favouriteData =
          await getFavourites(
            controller.signal,
          );

        if (isActive) {
          setFavourites(
            favouriteData,
          );
        }
      } catch (requestError) {
        if (
          requestError instanceof
            DOMException &&
          requestError.name ===
            "AbortError"
        ) {
          return;
        }

        if (isActive) {
          setError(
            getErrorMessage(
              requestError,
            ),
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void synchronizeFavourites();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [userId]);

  const favouriteProductIds =
    useMemo(
      () =>
        new Set(
          favourites.map(
            (favourite) =>
              favourite.product_id,
          ),
        ),
      [favourites],
    );

  const isFavourite =
    useCallback(
      (productId: string) =>
        favouriteProductIds.has(
          productId,
        ),
      [favouriteProductIds],
    );

  const isProductBusy =
    useCallback(
      (productId: string) =>
        busyProductIds.has(
          productId,
        ),
      [busyProductIds],
    );

  const markProductBusy =
    useCallback(
      (
        productId: string,
        isBusy: boolean,
      ): void => {
        setBusyProductIds(
          (current) => {
            const next =
              new Set(current);

            if (isBusy) {
              next.add(productId);
            } else {
              next.delete(productId);
            }

            return next;
          },
        );
      },
      [],
    );

  const refreshFavourites =
    useCallback(async (): Promise<void> => {
      if (!userId) {
        setFavourites([]);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const favouriteData =
          await getFavourites();

        setFavourites(
          favouriteData,
        );
      } catch (requestError) {
        const message =
          getErrorMessage(
            requestError,
          );

        setError(message);
        throw requestError;
      } finally {
        setIsLoading(false);
      }
    }, [userId]);

  const addFavourite =
    useCallback(
      async (
        productId: string,
      ): Promise<void> => {
        if (!userId) {
          throw new Error(
            "Please sign in to save favourites.",
          );
        }

        markProductBusy(
          productId,
          true,
        );

        setError(null);

        try {
          const createdFavourite =
            await addFavouriteRequest(
              productId,
            );

          setFavourites(
            (current) => {
              const alreadyExists =
                current.some(
                  (favourite) =>
                    favourite.product_id ===
                    productId,
                );

              if (alreadyExists) {
                return current;
              }

              return [
                createdFavourite,
                ...current,
              ];
            },
          );
        } catch (requestError) {
          const message =
            getErrorMessage(
              requestError,
            );

          setError(message);
          throw requestError;
        } finally {
          markProductBusy(
            productId,
            false,
          );
        }
      },
      [
        userId,
        markProductBusy,
      ],
    );

  const removeFavourite =
    useCallback(
      async (
        productId: string,
      ): Promise<void> => {
        if (!userId) {
          throw new Error(
            "Please sign in to manage favourites.",
          );
        }

        markProductBusy(
          productId,
          true,
        );

        setError(null);

        try {
          await removeFavouriteRequest(
            productId,
          );

          setFavourites(
            (current) =>
              current.filter(
                (favourite) =>
                  favourite.product_id !==
                  productId,
              ),
          );
        } catch (requestError) {
          const message =
            getErrorMessage(
              requestError,
            );

          setError(message);
          throw requestError;
        } finally {
          markProductBusy(
            productId,
            false,
          );
        }
      },
      [
        userId,
        markProductBusy,
      ],
    );

  const toggleFavourite =
    useCallback(
      async (
        productId: string,
      ): Promise<boolean> => {
        if (
          favouriteProductIds.has(
            productId,
          )
        ) {
          await removeFavourite(
            productId,
          );

          return false;
        }

        await addFavourite(
          productId,
        );

        return true;
      },
      [
        favouriteProductIds,
        addFavourite,
        removeFavourite,
      ],
    );

  const value =
    useMemo(
      () => ({
        favourites,
        favouriteCount:
          favourites.length,
        isLoading,
        error,
        isFavourite,
        isProductBusy,
        addFavourite,
        removeFavourite,
        toggleFavourite,
        refreshFavourites,
      }),
      [
        favourites,
        isLoading,
        error,
        isFavourite,
        isProductBusy,
        addFavourite,
        removeFavourite,
        toggleFavourite,
        refreshFavourites,
      ],
    );

  return (
    <FavouriteContext.Provider
      value={value}
    >
      {children}
    </FavouriteContext.Provider>
  );
}