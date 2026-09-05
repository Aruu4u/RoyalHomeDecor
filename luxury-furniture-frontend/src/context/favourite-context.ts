import {
  createContext,
} from "react";

import type {
  Favourite,
} from "../types/favourite";

export interface FavouriteContextValue {
  favourites: Favourite[];
  favouriteCount: number;
  isLoading: boolean;
  error: string | null;

  isFavourite: (
    productId: string,
  ) => boolean;

  isProductBusy: (
    productId: string,
  ) => boolean;

  addFavourite: (
    productId: string,
  ) => Promise<void>;

  removeFavourite: (
    productId: string,
  ) => Promise<void>;

  toggleFavourite: (
    productId: string,
  ) => Promise<boolean>;

  refreshFavourites:
    () => Promise<void>;
}

export const FavouriteContext =
  createContext<
    FavouriteContextValue | undefined
  >(undefined);