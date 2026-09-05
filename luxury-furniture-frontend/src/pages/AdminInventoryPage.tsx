import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";

import { formatPrice } from "../lib/currency";
import {
  updateVariantInventory,
} from "../services/productManagement";
import {
  getAdminProductDetails,
} from "../services/products";
import type {
  Inventory,
  ProductDetails,
  ProductVariant,
} from "../types/product";

type InventoryFilter =
  | "all"
  | "in-stock"
  | "low-stock"
  | "out-of-stock"
  | "inactive";

interface InventoryRow {
  productId: string;
  productName: string;
  productSlug: string;
  thumbnailUrl: string | null;
  variant: ProductVariant;
}

interface InventoryDraft {
  quantityOnHand: string;
  reservedQuantity: string;
  lowStockThreshold: string;
}

function createInventoryDraft(
  variant: ProductVariant,
): InventoryDraft {
  return {
    quantityOnHand:
      variant.inventory
        ?.quantity_on_hand
        .toString() ?? "0",

    reservedQuantity:
      variant.inventory
        ?.reserved_quantity
        .toString() ?? "0",

    lowStockThreshold:
      variant.inventory
        ?.low_stock_threshold
        .toString() ?? "0",
  };
}

function createInventoryRows(
  products: ProductDetails[],
): InventoryRow[] {
  return products.flatMap(
    (product) =>
      product.variants.map(
        (variant) => ({
          productId: product.id,
          productName: product.name,
          productSlug: product.slug,
          thumbnailUrl:
            product.thumbnail_url,
          variant,
        }),
      ),
  );
}

function getInventoryStatus(
  variant: ProductVariant,
):
  | "in-stock"
  | "low-stock"
  | "out-of-stock" {
  const inventory =
    variant.inventory;

  if (
    !inventory ||
    inventory.available_quantity <= 0
  ) {
    return "out-of-stock";
  }

  if (
    inventory.available_quantity <=
    inventory.low_stock_threshold
  ) {
    return "low-stock";
  }

  return "in-stock";
}

function getStatusLabel(
  variant: ProductVariant,
): string {
  if (!variant.is_active) {
    return "Inactive";
  }

  const status =
    getInventoryStatus(variant);

  if (status === "out-of-stock") {
    return "Out of stock";
  }

  if (status === "low-stock") {
    return "Low stock";
  }

  return "In stock";
}

function getStatusClassName(
  variant: ProductVariant,
): string {
  if (!variant.is_active) {
    return "inactive";
  }

  return getInventoryStatus(
    variant,
  );
}

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Unable to update inventory.";
}

function validateDraft(
  draft: InventoryDraft,
): string | null {
  const quantityOnHand =
    Number(draft.quantityOnHand);

  const reservedQuantity =
    Number(draft.reservedQuantity);

  const lowStockThreshold =
    Number(draft.lowStockThreshold);

  if (
    !Number.isInteger(
      quantityOnHand,
    ) ||
    quantityOnHand < 0
  ) {
    return "Quantity on hand must be a non-negative whole number.";
  }

  if (
    !Number.isInteger(
      reservedQuantity,
    ) ||
    reservedQuantity < 0
  ) {
    return "Reserved quantity must be a non-negative whole number.";
  }

  if (
    reservedQuantity >
    quantityOnHand
  ) {
    return "Reserved quantity cannot be greater than quantity on hand.";
  }

  if (
    !Number.isInteger(
      lowStockThreshold,
    ) ||
    lowStockThreshold < 0
  ) {
    return "Low-stock threshold must be a non-negative whole number.";
  }

  return null;
}

function AdminInventoryPage() {
  const [rows, setRows] =
    useState<InventoryRow[]>([]);

  const [drafts, setDrafts] =
    useState<
      Record<string, InventoryDraft>
    >({});

  const [searchQuery, setSearchQuery] =
    useState("");

  const [filter, setFilter] =
    useState<InventoryFilter>("all");

  const [isLoading, setIsLoading] =
    useState(true);

  const [busyVariantId, setBusyVariantId] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const controller =
      new AbortController();

    let isActive = true;

    async function loadInventory(): Promise<void> {
      try {
        const products =
          await getAdminProductDetails(
            controller.signal,
          );

        if (!isActive) {
          return;
        }

        const inventoryRows =
          createInventoryRows(
            products,
          );

        const inventoryDrafts =
          Object.fromEntries(
            inventoryRows.map((row) => [
              row.variant.id,
              createInventoryDraft(
                row.variant,
              ),
            ]),
          );

        setRows(inventoryRows);
        setDrafts(
          inventoryDrafts,
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

    void loadInventory();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const inventorySummary =
    useMemo(() => {
      let inStock = 0;
      let lowStock = 0;
      let outOfStock = 0;
      let inactive = 0;

      rows.forEach((row) => {
        if (!row.variant.is_active) {
          inactive += 1;
          return;
        }

        const status =
          getInventoryStatus(
            row.variant,
          );

        if (
          status === "in-stock"
        ) {
          inStock += 1;
        }

        if (
          status === "low-stock"
        ) {
          lowStock += 1;
        }

        if (
          status === "out-of-stock"
        ) {
          outOfStock += 1;
        }
      });

      return {
        inStock,
        lowStock,
        outOfStock,
        inactive,
      };
    }, [rows]);

  const filteredRows =
    useMemo(() => {
      const normalizedSearch =
        searchQuery
          .trim()
          .toLowerCase();

      return rows.filter((row) => {
        const matchesSearch =
          !normalizedSearch ||
          row.productName
            .toLowerCase()
            .includes(
              normalizedSearch,
            ) ||
          row.productSlug
            .toLowerCase()
            .includes(
              normalizedSearch,
            ) ||
          row.variant.name
            .toLowerCase()
            .includes(
              normalizedSearch,
            ) ||
          row.variant.sku
            .toLowerCase()
            .includes(
              normalizedSearch,
            ) ||
          row.variant.size_label
            ?.toLowerCase()
            .includes(
              normalizedSearch,
            );

        if (!matchesSearch) {
          return false;
        }

        if (filter === "all") {
          return true;
        }

        if (filter === "inactive") {
          return !row.variant.is_active;
        }

        if (!row.variant.is_active) {
          return false;
        }

        return (
          getInventoryStatus(
            row.variant,
          ) === filter
        );
      });
    }, [
      rows,
      searchQuery,
      filter,
    ]);

  function updateDraft<
    Field extends keyof InventoryDraft,
  >(
    variantId: string,
    field: Field,
    value: InventoryDraft[Field],
  ): void {
    setDrafts((current) => ({
      ...current,

      [variantId]: {
        ...current[variantId],
        [field]: value,
      },
    }));
  }

  async function handleSaveInventory(
    row: InventoryRow,
  ): Promise<void> {
    const draft =
      drafts[row.variant.id];

    if (!draft) {
      return;
    }

    const validationError =
      validateDraft(draft);

    if (validationError) {
      setError(validationError);
      setSuccessMessage(null);
      return;
    }

    setBusyVariantId(
      row.variant.id,
    );

    setError(null);
    setSuccessMessage(null);

    try {
      const updatedInventory =
        await updateVariantInventory(
          row.variant.id,
          {
            quantity_on_hand:
              Number(
                draft.quantityOnHand,
              ),

            reserved_quantity:
              Number(
                draft.reservedQuantity,
              ),

            low_stock_threshold:
              Number(
                draft.lowStockThreshold,
              ),
          },
        );

      setRows((currentRows) =>
        currentRows.map(
          (currentRow) =>
            currentRow.variant.id ===
            row.variant.id
              ? {
                  ...currentRow,

                  variant: {
                    ...currentRow.variant,

                    inventory:
                      updatedInventory,
                  },
                }
              : currentRow,
        ),
      );

      setDrafts((current) => ({
        ...current,

        [row.variant.id]:
          createDraftFromInventory(
            updatedInventory,
          ),
      }));

      setSuccessMessage(
        `${row.productName} — ${row.variant.name} inventory was updated.`,
      );
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
        ),
      );
    } finally {
      setBusyVariantId(null);
    }
  }

  function createDraftFromInventory(
    inventory: Inventory,
  ): InventoryDraft {
    return {
      quantityOnHand:
        inventory.quantity_on_hand
          .toString(),

      reservedQuantity:
        inventory.reserved_quantity
          .toString(),

      lowStockThreshold:
        inventory.low_stock_threshold
          .toString(),
    };
  }

  if (isLoading) {
    return (
      <section
        aria-live="polite"
        className="admin-panel"
      >
        <p>
          Loading inventory...
        </p>
      </section>
    );
  }

  return (
    <section className="admin-inventory-page">
      <div className="admin-section-heading">
        <div>
          <h2>Inventory</h2>

          <p>
            Review and update stock for
            every product variant.
          </p>
        </div>
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

      <div className="admin-inventory-summary">
        <article>
          <span>In stock</span>

          <strong>
            {inventorySummary.inStock}
          </strong>
        </article>

        <article>
          <span>Low stock</span>

          <strong>
            {inventorySummary.lowStock}
          </strong>
        </article>

        <article>
          <span>Out of stock</span>

          <strong>
            {inventorySummary.outOfStock}
          </strong>
        </article>

        <article>
          <span>Inactive</span>

          <strong>
            {inventorySummary.inactive}
          </strong>
        </article>
      </div>

      <section className="admin-panel admin-inventory-filters">
        <div className="admin-filter-field">
          <label htmlFor="inventory-search">
            Search inventory
          </label>

          <input
            id="inventory-search"
            onChange={(event) =>
              setSearchQuery(
                event.target.value,
              )
            }
            placeholder="Search product, variant, SKU or size"
            type="search"
            value={searchQuery}
          />
        </div>

        <div className="admin-filter-field">
          <label htmlFor="inventory-filter">
            Stock status
          </label>

          <select
            id="inventory-filter"
            onChange={(event) =>
              setFilter(
                event.target
                  .value as InventoryFilter,
              )
            }
            value={filter}
          >
            <option value="all">
              All variants
            </option>

            <option value="in-stock">
              In stock
            </option>

            <option value="low-stock">
              Low stock
            </option>

            <option value="out-of-stock">
              Out of stock
            </option>

            <option value="inactive">
              Inactive variants
            </option>
          </select>
        </div>
      </section>

      <p className="admin-inventory-results">
        Showing{" "}
        <strong>
          {filteredRows.length}
        </strong>{" "}
        of{" "}
        <strong>
          {rows.length}
        </strong>{" "}
        variants
      </p>

      {filteredRows.length === 0 ? (
        <section className="admin-panel admin-empty-products">
          <h3>
            No inventory found
          </h3>

          <p>
            Change the search or stock
            filter.
          </p>
        </section>
      ) : (
        <div className="admin-inventory-list">
          {filteredRows.map((row) => {
            const draft =
              drafts[row.variant.id];

            if (!draft) {
              return null;
            }

            const isBusy =
              busyVariantId ===
              row.variant.id;

            const currentAvailable =
              row.variant.inventory
                ?.available_quantity ??
              0;

            const draftAvailable =
              Math.max(
                0,
                Number(
                  draft.quantityOnHand,
                ) -
                  Number(
                    draft.reservedQuantity,
                  ),
              );

            return (
              <article
                className="admin-inventory-card"
                key={row.variant.id}
              >
                <div className="admin-inventory-product">
                  <div className="admin-inventory-thumbnail">
                    {row.thumbnailUrl ? (
                      <img
                        alt={row.productName}
                        src={row.thumbnailUrl}
                      />
                    ) : (
                      <span>
                        No image
                      </span>
                    )}
                  </div>

                  <div>
                    <p>
                      {row.variant.sku}
                    </p>

                    <h3>
                      {row.productName}
                    </h3>

                    <strong>
                      {row.variant.name}
                    </strong>

                    <span>
                      {row.variant.size_label ??
                        "No size label"}
                    </span>

                    <span>
                      {formatPrice(
                        row.variant
                          .price_paise,
                      )}
                    </span>
                  </div>
                </div>

                <div className="admin-inventory-status-area">
                  <span
                    className={`admin-inventory-status ${getStatusClassName(
                      row.variant,
                    )}`}
                  >
                    {getStatusLabel(
                      row.variant,
                    )}
                  </span>

                  <p>
                    Current available:{" "}
                    <strong>
                      {currentAvailable}
                    </strong>
                  </p>

                  <p>
                    New available:{" "}
                    <strong>
                      {Number.isFinite(
                        draftAvailable,
                      )
                        ? draftAvailable
                        : 0}
                    </strong>
                  </p>
                </div>

                <div className="admin-inventory-inputs">
                  <div className="admin-form-field">
                    <label
                      htmlFor={`inventory-stock-${row.variant.id}`}
                    >
                      Quantity on hand
                    </label>

                    <input
                      id={`inventory-stock-${row.variant.id}`}
                      min="0"
                      onChange={(event) =>
                        updateDraft(
                          row.variant.id,
                          "quantityOnHand",
                          event.target.value,
                        )
                      }
                      step="1"
                      type="number"
                      value={
                        draft.quantityOnHand
                      }
                    />
                  </div>

                  <div className="admin-form-field">
                    <label
                      htmlFor={`inventory-reserved-${row.variant.id}`}
                    >
                      Reserved
                    </label>

                    <input
                      id={`inventory-reserved-${row.variant.id}`}
                      min="0"
                      onChange={(event) =>
                        updateDraft(
                          row.variant.id,
                          "reservedQuantity",
                          event.target.value,
                        )
                      }
                      step="1"
                      type="number"
                      value={
                        draft.reservedQuantity
                      }
                    />
                  </div>

                  <div className="admin-form-field">
                    <label
                      htmlFor={`inventory-threshold-${row.variant.id}`}
                    >
                      Low-stock warning
                    </label>

                    <input
                      id={`inventory-threshold-${row.variant.id}`}
                      min="0"
                      onChange={(event) =>
                        updateDraft(
                          row.variant.id,
                          "lowStockThreshold",
                          event.target.value,
                        )
                      }
                      step="1"
                      type="number"
                      value={
                        draft.lowStockThreshold
                      }
                    />
                  </div>
                </div>

                <div className="admin-inventory-actions">
                  <button
                    className="admin-primary-button"
                    disabled={isBusy}
                    onClick={() =>
                      void handleSaveInventory(
                        row,
                      )
                    }
                    type="button"
                  >
                    {isBusy
                      ? "Saving..."
                      : "Save stock"}
                  </button>

                  <Link
                    to={`/admin/products/${row.productId}/edit`}
                  >
                    Edit product
                  </Link>

                  <Link
                    to={`/products/${row.productSlug}`}
                  >
                    View storefront
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default AdminInventoryPage;