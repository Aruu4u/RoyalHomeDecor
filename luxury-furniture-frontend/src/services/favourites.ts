import { apiClient } from "./api";

import type {
  Favourite,
} from "../types/favourite";

export function getFavourites(
  signal?: AbortSignal,
): Promise<Favourite[]> {
  return apiClient<Favourite[]>(
    "/favourites",
    {
      signal,
    },
  );
}

export function addFavourite(
  productId: string,
): Promise<Favourite> {
  return apiClient<Favourite>(
    `/favourites/${productId}`,
    {
      method: "POST",
    },
  );
}

export function removeFavourite(
  productId: string,
): Promise<void> {
  return apiClient<void>(
    `/favourites/${productId}`,
    {
      method: "DELETE",
    },
  );
}