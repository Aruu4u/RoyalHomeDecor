import { useCallback, useMemo } from "react";

import {
  loadCollections,
  loadProduct,
  loadProducts,
  type ProductQuery,
} from "../services/catalogueCache";
import type { Collection } from "../types/collection";
import type { Product, ProductDetails } from "../types/product";
import { useAsync, type AsyncState } from "./useAsync";

/** Active collections, shared by the header nav and the home page. */
export function useCollections(): AsyncState<Collection[]> {
  const loader = useCallback(
    (signal: AbortSignal) => loadCollections(signal),
    [],
  );

  return useAsync(loader, [], "Unable to load our collections.");
}

/** A single `/products` query. */
export function useProducts(query: ProductQuery): AsyncState<Product[]> {
  /*
   * Query objects are recreated on every render by callers, so the
   * dependency is the serialised query rather than the object identity.
   */
  const queryKey = JSON.stringify(query);

  const loader = useCallback(
    (signal: AbortSignal) =>
      loadProducts(JSON.parse(queryKey) as ProductQuery, signal),
    [queryKey],
  );

  return useAsync(loader, [queryKey], "Unable to load these pieces.");
}

/** One product detail record by slug. */
export function useProduct(
  slug: string | undefined,
): AsyncState<ProductDetails> {
  const loader = useCallback(
    (signal: AbortSignal) => {
      if (!slug) {
        return Promise.reject(new Error("This product could not be found."));
      }

      return loadProduct(slug, signal);
    },
    [slug],
  );

  return useAsync(loader, [slug], "Unable to load this product.");
}

/** Fast id -> collection-name lookup for product cards. */
export function useCollectionNames(
  collections: Collection[] | null,
): Map<string, string> {
  return useMemo(() => {
    const names = new Map<string, string>();

    for (const collection of collections ?? []) {
      names.set(collection.id, collection.name);
    }

    return names;
  }, [collections]);
}
