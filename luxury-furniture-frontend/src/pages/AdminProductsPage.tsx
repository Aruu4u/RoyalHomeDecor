import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";

import { formatPrice } from "../lib/currency";
import {
  getAdminCollections,
} from "../services/collections";
import {
  deleteProduct,
  getAdminProducts,
  updateProduct,
} from "../services/products";
import type {
  Collection,
} from "../types/collection";
import type {
  Product,
} from "../types/product";

type ProductStatusFilter =
  | "all"
  | "active"
  | "inactive"
  | "Recommended";

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Unable to complete the product request.";
}

function AdminProductsPage() {
  const [products, setProducts] =
    useState<Product[]>([]);

  const [collections, setCollections] =
    useState<Collection[]>([]);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [
    selectedCollectionId,
    setSelectedCollectionId,
  ] = useState("all");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<ProductStatusFilter>(
    "all",
  );

  const [
    updatingProductId,
    setUpdatingProductId,
  ] = useState<string | null>(null);

  const [
    deletingProductId,
    setDeletingProductId,
  ] = useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  useEffect(() => {
    const controller =
      new AbortController();

    let isActive = true;

    async function loadProducts(): Promise<void> {
      try {
        const [
          productData,
          collectionData,
        ] = await Promise.all([
          getAdminProducts(
            controller.signal,
          ),

          getAdminCollections(
            controller.signal,
          ),
        ]);

        if (!isActive) {
          return;
        }

        setProducts(productData);
        setCollections(collectionData);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name ===
            "AbortError"
        ) {
          return;
        }

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

    void loadProducts();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const collectionsById = useMemo(
    () =>
      new Map(
        collections.map((collection) => [
          collection.id,
          collection,
        ]),
      ),
    [collections],
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch =
      searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        product.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        product.slug
          .toLowerCase()
          .includes(normalizedSearch) ||
        product.top_material
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        product.base_material
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        product.finish
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        product.colour
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        product.style
          ?.toLowerCase()
          .includes(normalizedSearch);

      const matchesCollection =
        selectedCollectionId === "all" ||
        product.collection_id ===
          selectedCollectionId;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" &&
          product.is_active) ||
        (statusFilter === "inactive" &&
          !product.is_active) ||
        (statusFilter === "Recommended" &&
          product.is_recommended);

      return (
        matchesSearch &&
        matchesCollection &&
        matchesStatus
      );
    });
  }, [
    products,
    searchQuery,
    selectedCollectionId,
    statusFilter,
  ]);

  async function handleToggleActive(
    product: Product,
  ): Promise<void> {
    setUpdatingProductId(product.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedProduct =
        await updateProduct(product.id, {
          is_active:
            !product.is_active,
        });

      setProducts((currentProducts) =>
        currentProducts.map(
          (currentProduct) =>
            currentProduct.id ===
            product.id
              ? {
                  ...currentProduct,
                  is_active:
                    updatedProduct.is_active,
                  updated_at:
                    updatedProduct.updated_at,
                }
              : currentProduct,
        ),
      );

      setSuccessMessage(
        updatedProduct.is_active
          ? `${product.name} is now active.`
          : `${product.name} is now inactive.`,
      );
    } catch (requestError) {
      setError(
        getErrorMessage(requestError),
      );
    } finally {
      setUpdatingProductId(null);
    }
  }

  async function handleToggleRecommended(
    product: Product,
  ): Promise<void> {
    setUpdatingProductId(product.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedProduct =
        await updateProduct(product.id, {
          is_recommended:
            !product.is_recommended,
        });

      setProducts((currentProducts) =>
        currentProducts.map(
          (currentProduct) =>
            currentProduct.id ===
            product.id
              ? {
                  ...currentProduct,
                  is_recommended:
                    updatedProduct.is_recommended,
                  updated_at:
                    updatedProduct.updated_at,
                }
              : currentProduct,
        ),
      );

      setSuccessMessage(
        updatedProduct.is_recommended
          ? `${product.name} is now Recommended.`
          : `${product.name} was removed from Recommended products.`,
      );
    } catch (requestError) {
      setError(
        getErrorMessage(requestError),
      );
    } finally {
      setUpdatingProductId(null);
    }
  }

  async function handleDelete(
    product: Product,
  ): Promise<void> {
    const shouldDelete = window.confirm(
      `Permanently delete "${product.name}"?\n\nThis will also remove its images, variants and inventory.`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingProductId(product.id);
    setError(null);
    setSuccessMessage(null);

    try {
      await deleteProduct(product.id);

      setProducts((currentProducts) =>
        currentProducts.filter(
          (currentProduct) =>
            currentProduct.id !==
            product.id,
        ),
      );

      setSuccessMessage(
        `${product.name} was deleted.`,
      );
    } catch (requestError) {
      setError(
        getErrorMessage(requestError),
      );
    } finally {
      setDeletingProductId(null);
    }
  }

  if (isLoading) {
    return (
      <section
        aria-live="polite"
        className="admin-panel"
      >
        <p>Loading products...</p>
      </section>
    );
  }

  return (
    <section className="admin-products-page">
      <div className="admin-section-heading">
        <div>
          <h2>Products</h2>

          <p>
            Manage all active and inactive
            catalogue products.
          </p>
        </div>

        <Link
          className="admin-primary-button"
          to="/admin/products/new"
        >
          Add product
        </Link>
      </div>

      {error && (
        <p
          className="admin-message admin-error"
          role="alert"
        >
          {error}
        </p>
      )}

      {successMessage && (
        <p
          className="admin-message admin-success"
          role="status"
        >
          {successMessage}
        </p>
      )}

      <section className="admin-panel admin-product-filters">
        <div className="admin-filter-field admin-search-field">
          <label htmlFor="admin-product-search">
            Search products
          </label>

          <input
            id="admin-product-search"
            onChange={(event) =>
              setSearchQuery(
                event.target.value,
              )
            }
            placeholder="Search by name, material, colour or style"
            type="search"
            value={searchQuery}
          />
        </div>

        <div className="admin-filter-field">
          <label htmlFor="admin-collection-filter">
            Collection
          </label>

          <select
            id="admin-collection-filter"
            onChange={(event) =>
              setSelectedCollectionId(
                event.target.value,
              )
            }
            value={selectedCollectionId}
          >
            <option value="all">
              All collections
            </option>

            {collections.map(
              (collection) => (
                <option
                  key={collection.id}
                  value={collection.id}
                >
                  {collection.name}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="admin-filter-field">
          <label htmlFor="admin-status-filter">
            Status
          </label>

          <select
            id="admin-status-filter"
            onChange={(event) =>
              setStatusFilter(
                event.target
                  .value as ProductStatusFilter,
              )
            }
            value={statusFilter}
          >
            <option value="all">
              All products
            </option>

            <option value="active">
              Active
            </option>

            <option value="inactive">
              Inactive
            </option>

            <option value="Recommended">
              Recommended
            </option>
          </select>
        </div>
      </section>

      <div className="admin-product-results">
        <p>
          Showing{" "}
          <strong>
            {filteredProducts.length}
          </strong>{" "}
          of{" "}
          <strong>
            {products.length}
          </strong>{" "}
          products
        </p>
      </div>

      {filteredProducts.length === 0 ? (
        <section className="admin-panel admin-empty-products">
          <h3>No matching products</h3>

          <p>
            Change the filters or add a new
            product.
          </p>
        </section>
      ) : (
        <div className="admin-product-grid">
          {filteredProducts.map(
            (product) => {
              const collection =
                collectionsById.get(
                  product.collection_id,
                );

              const isUpdating =
                updatingProductId ===
                product.id;

              const isDeleting =
                deletingProductId ===
                product.id;

              return (
                <article
                  className="admin-product-card"
                  key={product.id}
                >
                  <div className="admin-product-image">
                    {product.thumbnail_url ? (
                      <img
                        alt={product.name}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display =
                            "none";
                        }}
                        src={
                          product.thumbnail_url
                        }
                      />
                    ) : (
                      <span>
                        No product image
                      </span>
                    )}

                    <div className="admin-product-badges">
                      <span
                        className={
                          product.is_active
                            ? "admin-product-badge active"
                            : "admin-product-badge inactive"
                        }
                      >
                        {product.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>

                      {product.is_recommended && (
                        <span className="admin-product-badge Recommended">
                          Recommended
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="admin-product-card-content">
                    <p className="admin-product-collection">
                      {collection?.name ??
                        "Unknown collection"}
                    </p>

                    <h3>{product.name}</h3>

                    <p className="admin-product-slug">
                      /{product.slug}
                    </p>

                    <strong className="admin-product-price">
                      {formatPrice(
                        product.base_price_paise,
                      )}
                    </strong>

                    <dl className="admin-product-meta">
                      <div>
                        <dt>Top material</dt>

                        <dd>
                          {product.top_material ??
                            "Not set"}
                        </dd>
                      </div>

                      <div>
                        <dt>Base material</dt>

                        <dd>
                          {product.base_material ??
                            "Not set"}
                        </dd>
                      </div>

                      <div>
                        <dt>Finish</dt>

                        <dd>
                          {product.finish ??
                            "Not set"}
                        </dd>
                      </div>

                      <div>
                        <dt>Colour</dt>

                        <dd>
                          {product.colour ??
                            "Not set"}
                        </dd>
                      </div>

                      <div>
                        <dt>Style</dt>

                        <dd>
                          {product.style ??
                            "Not set"}
                        </dd>
                      </div>
                    </dl>

                    <div className="admin-product-card-links">
                      <Link
                        to={`/products/${product.slug}`}
                      >
                        View product
                      </Link>

                      <Link
                        to={`/admin/products/${product.id}/edit`}
                      >
                        Edit details
                      </Link>
                    </div>

                    <div className="admin-product-card-actions">
                      <button
                        disabled={
                          isUpdating ||
                          isDeleting
                        }
                        onClick={() =>
                          void handleToggleActive(
                            product,
                          )
                        }
                        type="button"
                      >
                        {isUpdating
                          ? "Updating..."
                          : product.is_active
                            ? "Deactivate"
                            : "Activate"}
                      </button>

                      <button
                        disabled={
                          isUpdating ||
                          isDeleting
                        }
                        onClick={() =>
                          void handleToggleRecommended(
                            product,
                          )
                        }
                        type="button"
                      >
                        {product.is_recommended
                          ? "Remove Recommended"
                          : "Make Recommended"}
                      </button>

                      <button
                        className="admin-delete-button"
                        disabled={
                          isDeleting ||
                          isUpdating
                        }
                        onClick={() =>
                          void handleDelete(
                            product,
                          )
                        }
                        type="button"
                      >
                        {isDeleting
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}

export default AdminProductsPage;