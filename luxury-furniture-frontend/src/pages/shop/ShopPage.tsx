import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import ServiceNotice from "../../components/error/ServiceNotice";
import ProductCard from "../../components/product/ProductCard";
import FilterBar from "../../components/shop/FilterBar";
import { ProductGridSkeleton } from "../../components/ui/Feedback";
import Reveal from "../../components/ui/Reveal";
import Toast, { type ToastMessage } from "../../components/ui/Toast";
import { useCollectionNames, useCollections } from "../../hooks/useCatalogue";
import { useFirstLoadableImage } from "../../hooks/useFirstLoadableImage";
import {
  customCollectionImage,
  SITE_IMAGES,
  withCustomFirst,
} from "../../config/siteImages";
import { classifyError, type ErrorKind } from "../../lib/errors";
import { usableImageUrls } from "../../lib/imageCandidates";
import { loadProducts } from "../../services/catalogueCache";
import type { Product } from "../../types/product";

import "../../components/shop/filter-bar.css";
import "./shop.css";

const PAGE_SIZE = 24;

type SortOption =
  | "curated"
  | "best-selling"
  | "price-asc"
  | "price-desc"
  | "newest"
  | "name";

const SORT_LABELS: Record<SortOption, string> = {
  curated: "Curated",
  "best-selling": "Best selling",
  newest: "Newest first",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  name: "Name: A to Z",
};

/*
 * "Best selling" is ranked from real order lines, which only the database
 * can do, so it is the one sort that has to be applied server-side. Every
 * other option reorders the page already in hand.
 */
const SERVER_SORTS: ReadonlySet<SortOption> = new Set(["best-selling"]);

/** Reads the filter state out of the URL so it survives refresh and sharing. */
interface ShopFilters {
  collectionId: string | null;
  topMaterial: string | null;
  baseMaterial: string | null;
  finish: string | null;
  colour: string | null;
  style: string | null;
  search: string | null;
  recommendedOnly: boolean;
  inOfferOnly: boolean;
  sort: SortOption;
}

function sortProducts(products: Product[], sort: SortOption): Product[] {
  if (sort === "curated" || SERVER_SORTS.has(sort)) {
    /*
     * Already in the order the API returned: recommended first then
     * newest for "curated", units sold for "best selling". Re-sorting
     * here would undo it.
     */
    return products;
  }

  const sorted = [...products];

  switch (sort) {
    case "price-asc":
      return sorted.sort(
        (a, b) => a.base_price_paise - b.base_price_paise,
      );

    case "price-desc":
      return sorted.sort(
        (a, b) => b.base_price_paise - a.base_price_paise,
      );

    case "newest":
      return sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));

    default:
      return sorted;
  }
}

/** A product field the filter bar can offer as a dropdown. */
type FacetKey =
  | "top_material"
  | "base_material"
  | "finish"
  | "colour"
  | "style";

/** Distinct, human-sorted values for a facet, derived from loaded products. */
function facetValues(products: Product[], key: FacetKey): string[] {
  const seen = new Map<string, string>();

  for (const product of products) {
    const value = product[key];

    if (value) {
      /*
       * Keyed by lowercase so "Brass" and "brass" collapse into one
       * option, while the first spelling seen is what gets displayed.
       */
      seen.set(value.toLowerCase(), value);
    }
  }

  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

function ShopPage() {
  const { collectionSlug } = useParams<{ collectionSlug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: collections } = useCollections();
  const collectionNames = useCollectionNames(collections);

  const [items, setItems] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [feedback, setFeedback] = useState<ToastMessage | null>(null);

  /* The route form (/collections/:slug) wins over the query parameter. */
  const routeCollection = useMemo(
    () =>
      collectionSlug
        ? (collections ?? []).find(
            (collection) => collection.slug === collectionSlug,
          ) ?? null
        : null,
    [collections, collectionSlug],
  );

  const filters = useMemo<ShopFilters>(() => {
    const sortParam = searchParams.get("sort") as SortOption | null;

    return {
      collectionId:
        routeCollection?.id ?? searchParams.get("collection") ?? null,
      topMaterial: searchParams.get("top_material"),
      baseMaterial: searchParams.get("base_material"),
      finish: searchParams.get("finish"),
      colour: searchParams.get("colour"),
      style: searchParams.get("style"),
      search: searchParams.get("search"),
      recommendedOnly: searchParams.get("recommended") === "true",
      inOfferOnly: searchParams.get("offers") === "true",
      sort:
        sortParam && sortParam in SORT_LABELS ? sortParam : "curated",
    };
  }, [routeCollection, searchParams]);

  /*
   * A stable signature for the server-side part of the filter state.
   *
   * Most sorting is client-side and must not refetch, but "best selling"
   * is ranked in the database, so it belongs in here: changing to or from
   * it has to fetch a differently ordered page.
   *
   * The keys are exactly those of `ProductQuery`, because the string is
   * parsed straight back into `loadProducts`.
   */
  const querySignature = JSON.stringify({
    collectionId: filters.collectionId,
    topMaterial: filters.topMaterial,
    baseMaterial: filters.baseMaterial,
    finish: filters.finish,
    colour: filters.colour,
    style: filters.style,
    search: filters.search,
    recommendedOnly: filters.recommendedOnly,
    inOffer: filters.inOfferOnly,
    orderBy: SERVER_SORTS.has(filters.sort)
      ? ("most_sold" as const)
      : ("curated" as const),
  });

  /* Waiting for collections avoids firing a query without the id. */
  const isAwaitingCollection = Boolean(collectionSlug) && !routeCollection;

  useEffect(() => {
    if (isAwaitingCollection) {
      return;
    }

    const controller = new AbortController();
    let isCurrent = true;

    setIsLoading(true);
    setError(null);
    setErrorKind(null);

    loadProducts(
      { ...JSON.parse(querySignature), offset: 0, limit: PAGE_SIZE },
      controller.signal,
    )
      .then((products) => {
        if (!isCurrent) {
          return;
        }

        setItems(products);
        setHasMore(products.length === PAGE_SIZE);
      })
      .catch((requestError: unknown) => {
        if (
          !isCurrent ||
          (requestError instanceof DOMException &&
            requestError.name === "AbortError")
        ) {
          return;
        }

        console.error("Product list failed:", requestError);

        const classified = classifyError(requestError);

        setErrorKind(classified.kind);
        setError(
          classified.kind === "service"
            ? "We could not load these pieces just now."
            : classified.message,
        );
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [querySignature, isAwaitingCollection]);

  /*
   * The API exposes no total count, so pagination is "load more":
   * a full page back means there is probably another page.
   */
  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);

    try {
      const next = await loadProducts({
        ...(JSON.parse(querySignature) as Record<string, unknown>),
        offset: items.length,
        limit: PAGE_SIZE,
      });

      setItems((current) => {
        const existingIds = new Set(current.map((product) => product.id));

        return [
          ...current,
          ...next.filter((product) => !existingIds.has(product.id)),
        ];
      });

      setHasMore(next.length === PAGE_SIZE);
    } catch (loadError) {
      console.error("Loading more products failed:", loadError);

      const classified = classifyError(loadError);

      setErrorKind(classified.kind);
      setError(
        classified.kind === "service"
          ? "We could not load more pieces just now."
          : classified.message,
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [items.length, querySignature]);

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams);

      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }

      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const visibleProducts = useMemo(
    () => sortProducts(items, filters.sort),
    [items, filters.sort],
  );

  const topMaterials = useMemo(
    () => facetValues(items, "top_material"),
    [items],
  );

  const baseMaterials = useMemo(
    () => facetValues(items, "base_material"),
    [items],
  );

  const finishes = useMemo(() => facetValues(items, "finish"), [items]);
  const colours = useMemo(() => facetValues(items, "colour"), [items]);
  const styles = useMemo(() => facetValues(items, "style"), [items]);

  /* The filter bar derives its own active-filter chips from `filters`. */

  const heading = routeCollection?.name ?? "The full collection";

  const description =
    routeCollection?.short_description ??
    "Every piece we make, from marble tables to hand-cut metal wall art.";

  /*
   * Banner artwork: the collection's own hero when viewing a collection,
   * otherwise the best available image from the results. Placeholder and
   * dead-host URLs are filtered out first, and the first candidate that
   * actually decodes wins, so the banner never sits on a broken image.
   */
  const bannerCandidates = useMemo(
    () =>
      usableImageUrls(
        /*
         * On a collection page the collection's own custom art leads,
         * then the shared shop banner, then catalogue imagery.
         */
        withCustomFirst(
          routeCollection
            ? customCollectionImage(routeCollection.slug)
            : null,
          withCustomFirst(SITE_IMAGES.shopBanner, [
            routeCollection?.hero_image_url,
            ...(collections ?? []).map(
              (collection) => collection.hero_image_url,
            ),
            ...items.map((product) => product.thumbnail_url),
          ]),
        ),
      ),
    [routeCollection, collections, items],
  );

  const bannerImage = useFirstLoadableImage(bannerCandidates);

  function handleFeedback(message: string, isError: boolean): void {
    setFeedback({ message, isError });
  }

  return (
    <div className="shop page-enter">
      <Toast onDismiss={() => setFeedback(null)} toast={feedback} />

      {/* ================= BANNER ================= */}

      <header className="shop-hero">
        <div aria-hidden="true" className="shop-hero-backdrop" />

        {bannerImage && (
          <div
            aria-hidden="true"
            className="shop-hero-media is-ready"
            style={{ backgroundImage: `url("${bannerImage}")` }}
          />
        )}

        <div aria-hidden="true" className="shop-hero-scrim" />

        <div className="shell shop-hero-inner">
          <nav aria-label="Breadcrumb" className="shop-breadcrumb">
            <Link to="/">Home</Link>
            <span aria-hidden="true">/</span>

            {routeCollection ? (
              <>
                <Link to="/shop">Shop</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{routeCollection.name}</span>
              </>
            ) : (
              <span aria-current="page">Shop all</span>
            )}
          </nav>

          <p className="eyebrow shop-hero-eyebrow">
            {routeCollection ? "Collection" : "The full catalogue"}
          </p>

          <h1 className="shop-hero-title">{heading}</h1>

          <span aria-hidden="true" className="shop-hero-rule" />

          <p className="shop-hero-copy">{description}</p>
        </div>
      </header>

      <div className="shell shop-body">
        {/* ---------- Filter bar ---------- */}

        <FilterBar
          baseMaterials={baseMaterials}
          collections={collections}
          colours={colours}
          finishes={finishes}
          isIndicative={hasMore}
          onChange={updateFilter}
          onClear={clearFilters}
          resultCount={visibleProducts.length}
          showCollectionFilter={!collectionSlug}
          sortLabels={SORT_LABELS}
          styles={styles}
          topMaterials={topMaterials}
          values={filters}
        />

        {filters.search && (
          <p className="shop-search-note">
            Showing results for <strong>{filters.search}</strong>
          </p>
        )}

        {/* ---------- Results ---------- */}

        {isLoading || isAwaitingCollection ? (
          <ProductGridSkeleton count={12} />
        ) : items.length === 0 &&
          (errorKind === "service" || errorKind === "offline") ? (
          <ServiceNotice
            inline
            variant={errorKind === "offline" ? "offline" : "surveillance"}
          />
        ) : visibleProducts.length === 0 ? (
          <div className="empty-state">
            <h2>Nothing matches those filters</h2>

            <p className="empty-state-description">
              Try widening your search, or clear the filters to see the
              whole catalogue.
            </p>

            <button
              className="btn btn-primary"
              onClick={clearFilters}
              type="button"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <p className="shop-count">
              {visibleProducts.length} piece
              {visibleProducts.length === 1 ? "" : "s"}
              {hasMore ? " so far" : ""}
            </p>

            <div className="product-grid">
              {visibleProducts.map((product, index) => (
                <Reveal delay={(index % 4) * 50} key={product.id}>
                  <ProductCard
                    collectionName={collectionNames.get(product.collection_id)}
                    onFeedback={handleFeedback}
                    priority={index < 4}
                    product={product}
                  />
                </Reveal>
              ))}
            </div>

            {hasMore && (
              <div className="shop-load-more">
                <button
                  className="btn btn-outline btn-lg"
                  disabled={isLoadingMore}
                  onClick={() => void handleLoadMore()}
                  type="button"
                >
                  {isLoadingMore ? "Loading..." : "Load more pieces"}
                </button>
              </div>
            )}

            {error && items.length > 0 && (
              <p className="notice notice-error shop-inline-error">{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ShopPage;
