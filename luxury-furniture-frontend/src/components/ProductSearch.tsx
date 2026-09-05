import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";

import { formatPrice } from "../lib/currency";
import { getCollections } from "../services/collections";
import { getProducts } from "../services/products";
import type { Collection } from "../types/collection";
import type { Product } from "../types/product";

interface ProductSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to load products.";
}

function ProductSearch({
  isOpen,
  onClose,
}: ProductSearchProps) {
  const inputRef =
    useRef<HTMLInputElement>(null);

  const [query, setQuery] =
    useState("");

  const [products, setProducts] =
    useState<Product[]>([]);

  const [collections, setCollections] =
    useState<Collection[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const closeSearch = useCallback(() => {
    setQuery("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    const controller =
      new AbortController();

    let isActive = true;

    async function loadSearchCatalogue(): Promise<void> {
      try {
        const [
          productData,
          collectionData,
        ] = await Promise.all([
          getProducts(controller.signal),
          getCollections(controller.signal),
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
          collectionData.filter(
            (collection) =>
              collection.is_active,
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

    void loadSearchCatalogue();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    inputRef.current?.focus();

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    function handleKeyDown(
      event: KeyboardEvent,
    ): void {
      if (event.key === "Escape") {
        closeSearch();
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [isOpen, closeSearch]);

  const collectionNames =
    useMemo(() => {
      return new Map(
        collections.map(
          (collection) => [
            collection.id,
            collection.name,
          ],
        ),
      );
    }, [collections]);

  const searchResults =
    useMemo(() => {
      const normalizedQuery =
        query.trim().toLowerCase();

      if (!normalizedQuery) {
        return [];
      }

      return products
        .filter((product) => {
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

          return searchableText.includes(
            normalizedQuery,
          );
        })
        .slice(0, 12);
    }, [
      query,
      products,
      collectionNames,
    ]);

  if (!isOpen) {
    return null;
  }

  const normalizedQuery =
    query.trim();

  return (
    <div className="product-search-overlay">
      <button
        aria-label="Close search"
        className="product-search-backdrop"
        onClick={closeSearch}
        type="button"
      />

      <section
        aria-label="Search products"
        aria-modal="true"
        className="product-search-panel"
        role="dialog"
      >
        <div className="product-search-header">
          <div>
            <p className="eyebrow">
              Find your perfect piece
            </p>

            <h2>Search</h2>
          </div>

          <button
            aria-label="Close search"
            className="product-search-close"
            onClick={closeSearch}
            type="button"
          >
            <svg
              fill="none"
              height="24"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
              width="24"
            >
              <line
                x1="18"
                x2="6"
                y1="6"
                y2="18"
              />

              <line
                x1="6"
                x2="18"
                y1="6"
                y2="18"
              />
            </svg>
          </button>
        </div>

        <div className="product-search-input-wrapper">
          <svg
            aria-hidden="true"
            fill="none"
            height="21"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
            width="21"
          >
            <circle
              cx="11"
              cy="11"
              r="8"
            />

            <line
              x1="21"
              x2="16.65"
              y1="21"
              y2="16.65"
            />
          </svg>

          <input
            aria-label="Search products"
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Search mirrors, tables, colours, materials..."
            ref={inputRef}
            type="search"
            value={query}
          />

          {query && (
            <button
              className="product-search-clear"
              onClick={() =>
                setQuery("")
              }
              type="button"
            >
              Clear
            </button>
          )}
        </div>

        <div
          aria-live="polite"
          className="product-search-results"
        >
          {isLoading && (
            <p className="product-search-message">
              Loading products...
            </p>
          )}

          {error && (
            <p className="product-search-message error-message">
              {error}
            </p>
          )}

          {!isLoading &&
            !error &&
            !normalizedQuery && (
              <div className="product-search-empty">
                <h3>
                  What are you looking for?
                </h3>

                <p>
                  Search by product,
                  collection, material,
                  colour or style.
                </p>

                <div className="product-search-suggestions">
                  {[
                    "Mirrors",
                    "Wall Decor",
                    "Side Tables",
                    "Centre Tables",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() =>
                        setQuery(
                          suggestion,
                        )
                      }
                      type="button"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

          {!isLoading &&
            !error &&
            normalizedQuery &&
            searchResults.length === 0 && (
              <div className="product-search-empty">
                <h3>
                  No products found
                </h3>

                <p>
                  Try another product name,
                  material, colour or
                  collection.
                </p>
              </div>
            )}

          {!isLoading &&
            !error &&
            searchResults.length > 0 && (
              <>
                <p className="product-search-count">
                  {searchResults.length}{" "}
                  result
                  {searchResults.length === 1
                    ? ""
                    : "s"}{" "}
                  for “{normalizedQuery}”
                </p>

                <div className="product-search-grid">
                  {searchResults.map(
                    (product) => (
                      <Link
                        className="product-search-result"
                        key={product.id}
                        onClick={
                          closeSearch
                        }
                        to={`/products/${product.slug}`}
                      >
                        <div className="product-search-result-image">
                          {product.thumbnail_url ? (
                            <img
                              alt={
                                product.name
                              }
                              src={
                                product.thumbnail_url
                              }
                            />
                          ) : (
                            <span>
                              No image
                            </span>
                          )}
                        </div>

                        <div className="product-search-result-content">
                          <p>
                            {collectionNames.get(
                              product.collection_id,
                            ) ??
                              "Collection"}
                          </p>

                          <h3>
                            {product.name}
                          </h3>

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
                      </Link>
                    ),
                  )}
                </div>
              </>
            )}
        </div>
      </section>
    </div>
  );
}

export default ProductSearch;