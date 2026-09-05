import {
  useContext,
} from "react";

import {
  FavouriteContext,
} from "../context/favourite-context";

export function useFavourites() {
  const context =
    useContext(
      FavouriteContext,
    );

  if (!context) {
    throw new Error(
      "useFavourites must be used inside FavouriteProvider.",
    );
  }

  return context;
}