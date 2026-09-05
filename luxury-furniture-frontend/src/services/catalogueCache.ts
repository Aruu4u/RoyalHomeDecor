import { apiClient } from "./api";
import { timed } from "../lib/connectionQuality";
import type { Collection } from "../types/collection";
import type { Product, ProductDetails } from "../types/product";

/* =========================================================
   CATALOGUE CACHE

   The catalogue is public, read-mostly data that several parts of the
   UI ask for at once: the header needs collections, the home page needs
   four product queries, and product cards need detail records for a
   quick add. Without coordination that is a burst of duplicate requests
   on every navigation.

   This module keeps a short-lived in-memory cache plus an in-flight
   request map, so any number of callers asking for the same resource at
   the same time share exactly one network request.
   ========================================================= */

const TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

function readCache<T>(key: string): T | null {
  const entry = responseCache.get(key) as CacheEntry<T> | undefined;

  if (!entry) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    responseCache.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * Fetches `key` through the cache.
 *
 * `signal` only aborts this caller's interest in the result; a shared
 * in-flight request is never cancelled out from under another caller,
 * which is what made naive AbortController usage flaky before.
 */
async function fetchCached<T>(
  key: string,
  request: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const cached = readCache<T>(key);

  if (cached !== null) {
    return cached;
  }

  let pending = inFlight.get(key) as Promise<T> | undefined;

  if (!pending) {
    /*
     * Timed so the connection-quality signal is based on the requests
     * shoppers actually wait on, rather than a synthetic probe.
     */
    pending = timed(request)
      .then((value) => {
        responseCache.set(key, {
          value,
          expiresAt: Date.now() + TTL_MS,
        });

        return value;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, pending);
  }

  const value = await pending;

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  return value;
}

/** Drops every cached catalogue response. */
export function clearCatalogueCache(): void {
  responseCache.clear();
}

/**
 * Drops one product's cached detail record.
 *
 * Needed after an action of the shopper's own changes it, such as posting
 * a review: without this the five-minute TTL would keep serving the old
 * record and the new review would appear in the list while the score
 * beside the title stayed put.
 *
 * Only the single product entry is dropped. Clearing everything would
 * throw away the collections and listing responses too and cause a burst
 * of refetching for no reason.
 */
export function invalidateProduct(slug: string): void {
  responseCache.delete(`product:${slug}`);
}

/* ---------- Collections ---------- */

const COLLECTIONS_KEY = "collections:active";

export function loadCollections(
  signal?: AbortSignal,
): Promise<Collection[]> {
  return fetchCached(
    COLLECTIONS_KEY,
    () =>
      apiClient<Collection[]>(
        "/collections?offset=0&limit=100&active_only=true",
      ),
    signal,
  );
}

/* ---------- Products ---------- */

export interface ProductQuery {
  offset?: number;
  limit?: number;
  collectionId?: string | null;
  topMaterial?: string | null;
  baseMaterial?: string | null;
  finish?: string | null;
  colour?: string | null;
  style?: string | null;
  recommendedOnly?: boolean;

  /** Only pieces discounted right now. Expired offers do not count. */
  inOffer?: boolean;

  /**
   * "most_sold" ranks by units actually sold, taken from order lines with
   * cancelled orders excluded. Omitted means the curated default:
   * recommended first, then newest.
   */
  orderBy?: "curated" | "most_sold";

  search?: string | null;
}

/**
 * Builds the `/products` query string.
 *
 * Only parameters the backend actually accepts are emitted, and empty
 * values are omitted entirely so the cache key stays stable.
 */
export function buildProductsPath(query: ProductQuery): string {
  const params = new URLSearchParams();

  params.set("offset", String(query.offset ?? 0));
  params.set("limit", String(query.limit ?? 24));
  params.set("active_only", "true");

  if (query.collectionId) {
    params.set("collection_id", query.collectionId);
  }

  if (query.topMaterial) {
    params.set("top_material", query.topMaterial);
  }

  if (query.baseMaterial) {
    params.set("base_material", query.baseMaterial);
  }

  if (query.finish) {
    params.set("finish", query.finish);
  }

  if (query.colour) {
    params.set("colour", query.colour);
  }

  if (query.style) {
    params.set("style", query.style);
  }

  if (query.recommendedOnly) {
    params.set("recommended_only", "true");
  }

  if (query.inOffer) {
    params.set("in_offer", "true");
  }

  /* Left off when curated so the default path keeps its existing key. */
  if (query.orderBy && query.orderBy !== "curated") {
    params.set("order_by", query.orderBy);
  }

  const search = query.search?.trim();

  if (search) {
    params.set("search", search);
  }

  return `/products?${params.toString()}`;
}

export function loadProducts(
  query: ProductQuery,
  signal?: AbortSignal,
): Promise<Product[]> {
  const path = buildProductsPath(query);

  return fetchCached(
    `products:${path}`,
    () => apiClient<Product[]>(path),
    signal,
  );
}

export function loadProduct(
  slug: string,
  signal?: AbortSignal,
): Promise<ProductDetails> {
  return fetchCached(
    `product:${slug}`,
    () => apiClient<ProductDetails>(`/products/${slug}`),
    signal,
  );
}

/* ---------- Product index ---------- */

const PRODUCT_INDEX_KEY = "products:index";
const INDEX_PAGE_SIZE = 100;

/**
 * Every active product keyed by id.
 *
 * The cart and order endpoints identify pieces by `product_id`, but the
 * API only exposes products by slug. This index closes that gap once per
 * session instead of per line item, and it is shared by the cart,
 * checkout and order pages.
 */
export function loadProductIndex(
  signal?: AbortSignal,
): Promise<Map<string, Product>> {
  return fetchCached(
    PRODUCT_INDEX_KEY,
    async () => {
      const index = new Map<string, Product>();

      let offset = 0;

      /* Paginate until a short page signals the end. */
      for (;;) {
        const page = await apiClient<Product[]>(
          `/products?offset=${offset}&limit=${INDEX_PAGE_SIZE}&active_only=true`,
        );

        for (const product of page) {
          index.set(product.id, product);
        }

        if (page.length < INDEX_PAGE_SIZE) {
          return index;
        }

        offset += INDEX_PAGE_SIZE;
      }
    },
    signal,
  );
}
