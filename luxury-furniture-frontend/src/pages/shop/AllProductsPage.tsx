import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";

import ProductFavouriteButton from "../../components/ProductFavouriteButton";
import {
  formatPrice,
} from "../../lib/currency";
import {
  getAllActiveProducts,
} from "../../services/catalogue";
import {
  getCollections,
} from "../../services/collections";
import type {
  Collection,
} from "../../types/collection";
import type {
  Product,
} from "../../types/product";

import "./AllProductsPage.css";

type SortOption =
  | "price-asc"
  | "price-desc"
  | "newest"
  | "oldest";

interface PricePreset {
  label: string;
  minimum: string;
  maximum: string;
}

const PRICE_PRESETS: PricePreset[] = [
  {
    label: "Under ₹10,000",
    minimum: "",
    maximum: "10000",
  },
  {
    label: "₹10,000–₹25,000",
    minimum: "10000",
    maximum: "25000",
  },
  {
    label: "₹25,000–₹50,000",
    minimum: "25000",
    maximum: "50000",
  },
  {
    label: "Above ₹50,000",
    minimum: "50000",
    maximum: "",
  },
];

function getUniqueValues(
  products: Product[],
  getValue: (
    product: Product,
  ) => string | null,
): string[] {
  return Array.from(
    new Set(
      products
        .map(getValue)
        .filter(
          (
            value,
          ): value is string =>
            Boolean(
              value?.trim(),
            ),
        ),
    ),
  ).sort((first, second) =>
    first.localeCompare(second),
  );
}

function convertRupeesToPaise(
  value: string,
): number | null {
  const cleanedValue =
    value.trim();

  if (!cleanedValue) {
    return null;
  }

  const numericValue =
    Number(cleanedValue);

  if (
    !Number.isFinite(
      numericValue,
    )
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.round(
      numericValue * 100,
    ),
  );
}

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Unable to load the product catalogue.";
}

function AllProductsPage() {
  const [products, setProducts] =
    useState<Product[]>([]);

  const [
    collections,
    setCollections,
  ] = useState<Collection[]>([]);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [
    selectedCollection,
    setSelectedCollection,
  ] = useState("");

  const [
    selectedStyle,
    setSelectedStyle,
  ] = useState("");

  const [
    selectedMaterial,
    setSelectedMaterial,
  ] = useState("");

  const [
    selectedColour,
    setSelectedColour,
  ] = useState("");

  const [minimumPrice, setMinimumPrice] =
    useState("");

  const [maximumPrice, setMaximumPrice] =
    useState("");

  const [sortOption, setSortOption] =
    useState<SortOption>("newest");

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const controller =
      new AbortController();

    let isActive = true;

    async function loadCatalogue():
      Promise<void> {
      try {
        const [
          productData,
          collectionData,
        ] = await Promise.all([
          getAllActiveProducts(
            controller.signal,
          ),

          getCollections(
            controller.signal,
          ),
        ]);

        if (!isActive) {
          return;
        }

        setProducts(
          productData.filter(
            (product) =>
              product.is_active,
          ),
        );

        setCollections(
          collectionData
            .filter(
              (collection) =>
                collection.is_active,
            )
            .sort(
              (first, second) =>
                first.display_order -
                second.display_order,
            ),
        );
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

    void loadCatalogue();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);
  useEffect(() => {
  const imageUrls =
    products
      .map(
        (product) =>
          product.thumbnail_url,
      )
      .filter(
        (
          imageUrl,
        ): imageUrl is string =>
          Boolean(imageUrl),
      );

  if (imageUrls.length === 0) {
    return;
  }

  let currentIndex = 0;
  let preloadTimer:
    number | null = null;

  function preloadNextBatch(): void {
    const nextBatch =
      imageUrls.slice(
        currentIndex,
        currentIndex + 8,
      );

    nextBatch.forEach(
      (imageUrl) => {
        const image =
          new Image();

        image.decoding =
          "async";

        image.src =
          imageUrl;
      },
    );

    currentIndex +=
      nextBatch.length;

    if (
      currentIndex <
      imageUrls.length
    ) {
      preloadTimer =
        window.setTimeout(
          preloadNextBatch,
          250,
        );
    }
  }

  preloadTimer =
    window.setTimeout(
      preloadNextBatch,
      350,
    );

  return () => {
    if (
      preloadTimer !== null
    ) {
      window.clearTimeout(
        preloadTimer,
      );
    }
  };
}, [products]);

  const collectionNames =
    useMemo(
      () =>
        new Map(
          collections.map(
            (collection) => [
              collection.id,
              collection.name,
            ],
          ),
        ),
      [collections],
    );

  const availableStyles =
    useMemo(
      () =>
        getUniqueValues(
          products,
          (product) =>
            product.style,
        ),
      [products],
    );

  const availableMaterials =
    useMemo(
      () =>
        getUniqueValues(
          products,
          (product) =>
            product.top_material,
        ),
      [products],
    );

  const availableColours =
    useMemo(
      () =>
        getUniqueValues(
          products,
          (product) =>
            product.colour,
        ),
      [products],
    );

  const priceBounds =
    useMemo(() => {
      if (
        products.length === 0
      ) {
        return {
          minimum: 0,
          maximum: 0,
        };
      }

      const prices =
        products.map(
          (product) =>
            product.base_price_paise,
        );

      return {
        minimum: Math.min(
          ...prices,
        ),
        maximum: Math.max(
          ...prices,
        ),
      };
    }, [products]);

  const filteredProducts =
    useMemo(() => {
      const normalizedSearch =
        searchQuery
          .trim()
          .toLowerCase();

      const minimumPricePaise =
        convertRupeesToPaise(
          minimumPrice,
        );

      const maximumPricePaise =
        convertRupeesToPaise(
          maximumPrice,
        );

      const matchingProducts =
        products.filter(
          (product) => {
            const collectionName =
              collectionNames.get(
                product.collection_id,
              ) ?? "";

            const searchableText = [
              product.name,
              product.short_description,
              product.top_material,
              product.colour,
              product.style,
              collectionName,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            const matchesSearch =
              !normalizedSearch ||
              searchableText.includes(
                normalizedSearch,
              );

            const matchesCollection =
              !selectedCollection ||
              product.collection_id ===
                selectedCollection;

            const matchesStyle =
              !selectedStyle ||
              product.style ===
                selectedStyle;

            const matchesMaterial =
              !selectedMaterial ||
              product.top_material ===
                selectedMaterial;

            const matchesColour =
              !selectedColour ||
              product.colour ===
                selectedColour;

            const matchesMinimumPrice =
              minimumPricePaise ===
                null ||
              product.base_price_paise >=
                minimumPricePaise;

            const matchesMaximumPrice =
              maximumPricePaise ===
                null ||
              product.base_price_paise <=
                maximumPricePaise;

            return (
              matchesSearch &&
              matchesCollection &&
              matchesStyle &&
              matchesMaterial &&
              matchesColour &&
              matchesMinimumPrice &&
              matchesMaximumPrice
            );
          },
        );

      return [
        ...matchingProducts,
      ].sort(
        (first, second) => {
          switch (sortOption) {
            case "price-asc":
              return (
                first.base_price_paise -
                second.base_price_paise
              );

            case "price-desc":
              return (
                second.base_price_paise -
                first.base_price_paise
              );

            case "oldest":
              return (
                new Date(
                  first.created_at,
                ).getTime() -
                new Date(
                  second.created_at,
                ).getTime()
              );

            case "newest":
            default:
              return (
                new Date(
                  second.created_at,
                ).getTime() -
                new Date(
                  first.created_at,
                ).getTime()
              );
          }
        },
      );
    }, [
      products,
      collectionNames,
      searchQuery,
      selectedCollection,
      selectedStyle,
      selectedMaterial,
      selectedColour,
      minimumPrice,
      maximumPrice,
      sortOption,
    ]);

  const activeFilterCount =
    [
      selectedCollection,
      selectedStyle,
      selectedMaterial,
      selectedColour,
      minimumPrice,
      maximumPrice,
    ].filter(Boolean).length;

  function clearFilters(): void {
    setSelectedCollection("");
    setSelectedStyle("");
    setSelectedMaterial("");
    setSelectedColour("");
    setMinimumPrice("");
    setMaximumPrice("");
  }

  function applyPricePreset(
    preset: PricePreset,
  ): void {
    setMinimumPrice(
      preset.minimum,
    );

    setMaximumPrice(
      preset.maximum,
    );
  }

  function selectCollection(
    collectionId: string,
  ): void {
    setSelectedCollection(
      collectionId,
    );

    document
      .getElementById(
        "shop-products",
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  return (
    <main className="all-products-page">
      <section className="shop-hero">
        <div className="shop-hero-glow" />

        <div className="shop-hero-content">
          <p className="shop-eyebrow">
            The complete collection
          </p>

          <h1>
            Discover every piece.
          </h1>

          <p>
            Explore mirrors, wall décor,
            side tables and centre tables
            selected for refined modern
            interiors.
          </p>

          {collections.length > 0 && (
            <div className="shop-collection-shortcuts">
              <button
                className={
                  selectedCollection
                    ? ""
                    : "active"
                }
                onClick={() =>
                  selectCollection("")
                }
                type="button"
              >
                All products
              </button>

              {collections.map(
                (collection) => (
                  <button
                    className={
                      selectedCollection ===
                      collection.id
                        ? "active"
                        : ""
                    }
                    key={
                      collection.id
                    }
                    onClick={() =>
                      selectCollection(
                        collection.id,
                      )
                    }
                    type="button"
                  >
                    {collection.name}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      </section>

      <section
        className="shop-catalogue"
        id="shop-products"
      >
        <header className="shop-catalogue-header">
          <div>
            <p className="shop-eyebrow">
              Shop the catalogue
            </p>

            <h2>
              Find your perfect piece
            </h2>
          </div>

          <div className="shop-search-field">
  <label className="shop-search-shell">
    <span
      aria-hidden="true"
      className="shop-search-icon"
    >
      <svg
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <circle
          cx="11"
          cy="11"
          r="7.5"
        />

        <path d="m20 20-3.6-3.6" />
      </svg>
    </span>

    <span className="shop-search-content">
      <span className="shop-search-label">
        Search catalogue
      </span>

      <input
        aria-label="Search products"
        className="shop-search-input"
        onChange={(event) =>
          setSearchQuery(
            event.target.value,
          )
        }
        placeholder="Product, material, colour or style"
        type="search"
        value={searchQuery}
      />
    </span>

    <span className="shop-search-actions">
      <span className="shop-search-result-count">
        {filteredProducts.length} results
      </span>

      {searchQuery && (
        <button
          aria-label="Clear product search"
          className="shop-search-clear"
          onClick={(event) => {
            event.preventDefault();
            setSearchQuery("");
          }}
          type="button"
        >
          <svg
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path d="M6 6 18 18" />
            <path d="M18 6 6 18" />
          </svg>
        </button>
      )}
    </span>
  </label>
</div>
          
        </header>

        <div className="shop-catalogue-layout">
          <aside className="shop-filter-panel">
            <div className="shop-filter-heading">
              <div>
                <h3>Filters</h3>

                {activeFilterCount >
                  0 && (
                  <span>
                    {
                      activeFilterCount
                    }{" "}
                    active
                  </span>
                )}
              </div>

              {activeFilterCount >
                0 && (
                <button
                  onClick={
                    clearFilters
                  }
                  type="button"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="shop-filter-group">
              <label htmlFor="shop-collection-filter">
                Collection
              </label>

              <select
                id="shop-collection-filter"
                onChange={(event) =>
                  setSelectedCollection(
                    event.target
                      .value,
                  )
                }
                value={
                  selectedCollection
                }
              >
                <option value="">
                  All collections
                </option>

                {collections.map(
                  (collection) => (
                    <option
                      key={
                        collection.id
                      }
                      value={
                        collection.id
                      }
                    >
                      {collection.name}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="shop-filter-group">
              <label htmlFor="shop-style-filter">
                Style
              </label>

              <select
                id="shop-style-filter"
                onChange={(event) =>
                  setSelectedStyle(
                    event.target
                      .value,
                  )
                }
                value={
                  selectedStyle
                }
              >
                <option value="">
                  All styles
                </option>

                {availableStyles.map(
                  (style) => (
                    <option
                      key={style}
                      value={style}
                    >
                      {style}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="shop-filter-group">
              <label htmlFor="shop-material-filter">
                Material
              </label>

              <select
                id="shop-material-filter"
                onChange={(event) =>
                  setSelectedMaterial(
                    event.target
                      .value,
                  )
                }
                value={
                  selectedMaterial
                }
              >
                <option value="">
                  All materials
                </option>

                {availableMaterials.map(
                  (material) => (
                    <option
                      key={material}
                      value={material}
                    >
                      {material}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="shop-filter-group">
              <label htmlFor="shop-colour-filter">
                Colour
              </label>

              <select
                id="shop-colour-filter"
                onChange={(event) =>
                  setSelectedColour(
                    event.target
                      .value,
                  )
                }
                value={
                  selectedColour
                }
              >
                <option value="">
                  All colours
                </option>

                {availableColours.map(
                  (colour) => (
                    <option
                      key={colour}
                      value={colour}
                    >
                      {colour}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="shop-filter-group">
              <span className="shop-filter-label">
                Price range
              </span>

              <div className="shop-price-inputs">
                <label>
                  <span>Minimum</span>

                  <div>
                    <span>₹</span>

                    <input
                      min="0"
                      onChange={(
                        event,
                      ) =>
                        setMinimumPrice(
                          event.target
                            .value,
                        )
                      }
                      placeholder="0"
                      type="number"
                      value={
                        minimumPrice
                      }
                    />
                  </div>
                </label>

                <label>
                  <span>Maximum</span>

                  <div>
                    <span>₹</span>

                    <input
                      min="0"
                      onChange={(
                        event,
                      ) =>
                        setMaximumPrice(
                          event.target
                            .value,
                        )
                      }
                      placeholder="No limit"
                      type="number"
                      value={
                        maximumPrice
                      }
                    />
                  </div>
                </label>
              </div>

              <div className="shop-price-presets">
                {PRICE_PRESETS.map(
                  (preset) => (
                    <button
                      key={
                        preset.label
                      }
                      onClick={() =>
                        applyPricePreset(
                          preset,
                        )
                      }
                      type="button"
                    >
                      {preset.label}
                    </button>
                  ),
                )}
              </div>

              {products.length > 0 && (
                <p className="shop-price-bounds">
                  Catalogue range:{" "}
                  {formatPrice(
                    priceBounds.minimum,
                  )}{" "}
                  –{" "}
                  {formatPrice(
                    priceBounds.maximum,
                  )}
                </p>
              )}
            </div>
          </aside>

          <section className="shop-products-area">
            <div className="shop-results-toolbar">
              <p aria-live="polite">
                <strong>
                  {
                    filteredProducts.length
                  }
                </strong>{" "}
                {filteredProducts.length ===
                1
                  ? "product"
                  : "products"}
              </p>

              <label>
                <span>Sort by</span>

                <select
                  onChange={(event) =>
                    setSortOption(
                      event.target
                        .value as SortOption,
                    )
                  }
                  value={sortOption}
                >
                  <option value="newest">
                    Newly added
                  </option>

                  <option value="oldest">
                    Oldest first
                  </option>

                  <option value="price-asc">
                    Price: low to high
                  </option>

                  <option value="price-desc">
                    Price: high to low
                  </option>
                </select>
              </label>
            </div>

            {isLoading && (
              <div className="shop-loading-grid">
                {Array.from({
                  length: 6,
                }).map((_, index) => (
                  <div
                    className="shop-loading-card"
                    key={index}
                  />
                ))}
              </div>
            )}

            {error && (
              <section className="shop-empty-state">
                <p className="shop-eyebrow">
                  Catalogue error
                </p>

                <h2>
                  Products could not be
                  loaded.
                </h2>

                <p>{error}</p>
              </section>
            )}

            {!isLoading &&
              !error &&
              filteredProducts.length ===
                0 && (
                <section className="shop-empty-state">
                  <p className="shop-eyebrow">
                    No matching pieces
                  </p>

                  <h2>
                    Try changing your
                    filters.
                  </h2>

                  <p>
                    Remove one or more
                    filters to see more
                    products.
                  </p>

                  <button
                    className="shop-clear-button"
                    onClick={
                      clearFilters
                    }
                    type="button"
                  >
                    Clear filters
                  </button>
                </section>
              )}

            {!isLoading &&
              !error &&
              filteredProducts.length >
                0 && (
                <div className="shop-products-grid">
                  {filteredProducts.map(
                    (product,index) => (
                      <article
                        className="shop-product-card"
                        key={product.id}
                      >
                        <div className="shop-product-image-wrapper">
                          <ProductFavouriteButton
                            className="shop-product-favourite"
                            productId={
                              product.id
                            }
                            productName={
                              product.name
                            }
                          />

                          <Link
                            className="shop-product-image"
                            to={`/products/${product.slug}`}
                          >
                            {product.thumbnail_url ? (
                              <img
  alt={product.name}
  decoding="async"
  fetchPriority={
    index < 6
      ? "high"
      : "auto"
  }
  loading={
    index < 12
      ? "eager"
      : "lazy"
  }
  onLoad={(event) => {
    event.currentTarget
      .closest(".shop-product-image")
      ?.classList.add(
        "product-image-loaded",
      );
  }}
  src={product.thumbnail_url}
/>
                            ) : (
                              <span>
                                No image
                                available
                              </span>
                            )}

                            <div className="shop-product-view">
                              View piece
                            </div>
                          </Link>
                        </div>

                        <div className="shop-product-information">
                          <p>
                            {collectionNames.get(
                              product.collection_id,
                            ) ??
                              "Royal Home Decor"}
                          </p>

                          <Link
                            to={`/products/${product.slug}`}
                          >
                            <h3>
                              {product.name}
                            </h3>
                          </Link>

                          <span>
                            {[
                              product.top_material,
                              product.colour,
                              product.style,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>

                          <strong>
                            {formatPrice(
                              product.base_price_paise,
                            )}
                          </strong>
                        </div>
                      </article>
                    ),
                  )}
                </div>
              )}
          </section>
        </div>
      </section>
    </main>
  );
}

export default AllProductsPage;