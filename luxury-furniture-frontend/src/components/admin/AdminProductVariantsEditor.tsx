import {

  useState,
} from "react";

import {
  addProductVariant,
  deleteProductVariant,
  updateProductVariant,
  updateVariantInventory,
} from "../../services/productManagement";
import type {
  ProductDetails,
  ProductVariant,
  ProductVariantCreateRequest,
  ProductVariantUpdateRequest,
} from "../../types/product";

const MAX_PRICE_PAISE =
  2_147_483_647;

const MAX_PRICE_RUPEES =
  MAX_PRICE_PAISE / 100;

interface VariantDraft {
  sku: string;
  name: string;
  sizeLabel: string;
  colour: string;
  material: string;
  priceRupees: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  weightGrams: string;
  quantityOnHand: string;
  reservedQuantity: string;
  lowStockThreshold: string;
  isActive: boolean;
}

interface AdminProductVariantsEditorProps {
  product: ProductDetails;
  onChanged: () => Promise<void>;
}

interface VariantFieldsProps {
  prefix: string;
  draft: VariantDraft;

  onChange: <
    Field extends keyof VariantDraft,
  >(
    field: Field,
    value: VariantDraft[Field],
  ) => void;
}

function emptyVariant(
  product: ProductDetails,
): VariantDraft {
  return {
    sku: "",
    name: "Standard",
    sizeLabel: "",
    colour:
      product.colour ?? "",
    /*
     * Seeded from the product's top material, which is the surface a
     * variant is normally described by. It stays editable per variant for
     * the cases where the options really are made of different things.
     */
    material:
      product.top_material ?? "",
    priceRupees: (
      product.base_price_paise /
      100
    ).toFixed(2),
    lengthCm: "",
    widthCm: "",
    heightCm: "",
    weightGrams: "",
    quantityOnHand: "0",
    reservedQuantity: "0",
    lowStockThreshold: "3",
    isActive: true,
  };
}

function draftFromVariant(
  variant: ProductVariant,
): VariantDraft {
  return {
    sku: variant.sku,
    name: variant.name,
    sizeLabel:
      variant.size_label ?? "",
    colour:
      variant.colour ?? "",
    material:
      variant.material ?? "",
    priceRupees: (
      variant.price_paise / 100
    ).toFixed(2),
    lengthCm:
      variant.length_cm ?? "",
    widthCm:
      variant.width_cm ?? "",
    heightCm:
      variant.height_cm ?? "",
    weightGrams:
      variant.weight_grams?.toString() ??
      "",
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
        .toString() ?? "3",
    isActive:
      variant.is_active,
  };
}

function createVariantDrafts(
  product: ProductDetails,
): Record<string, VariantDraft> {
  return Object.fromEntries(
    product.variants.map(
      (variant) => [
        variant.id,
        draftFromVariant(
          variant,
        ),
      ],
    ),
  );
}

function optionalText(
  value: string,
): string | null {
  const trimmed = value.trim();

  return trimmed
    ? trimmed
    : null;
}

function optionalNumber(
  value: string,
): number | null {
  if (!value.trim()) {
    return null;
  }

  return Number(value);
}

function optionalInteger(
  value: string,
): number | null {
  if (!value.trim()) {
    return null;
  }

  return Number(value);
}

function toPaise(
  value: string,
): number {
  return Math.round(
    Number(value) * 100,
  );
}

function formatSku(
  value: string,
): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-/, "");
}

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Unable to update the product variant.";
}

function validateVariant(
  draft: VariantDraft,
): string | null {
  if (
    !/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(
      draft.sku,
    )
  ) {
    return "SKU must contain uppercase letters, numbers and hyphens only.";
  }

  if (!draft.name.trim()) {
    return "Enter a variant name.";
  }

  const price = Number(
    draft.priceRupees,
  );

  if (
    !Number.isFinite(price) ||
    price < 0
  ) {
    return "Enter a valid variant price.";
  }

  if (price > MAX_PRICE_RUPEES) {
    return `Variant price cannot exceed ₹${MAX_PRICE_RUPEES.toLocaleString(
      "en-IN",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    )}.`;
  }

  const decimalFields = [
    draft.lengthCm,
    draft.widthCm,
    draft.heightCm,
  ];

  if (
    decimalFields.some(
      (value) =>
        value.trim() &&
        (
          !Number.isFinite(
            Number(value),
          ) ||
          Number(value) < 0
        ),
    )
  ) {
    return "Dimensions must contain non-negative numbers.";
  }

  if (
    draft.weightGrams.trim() &&
    (
      !Number.isInteger(
        Number(
          draft.weightGrams,
        ),
      ) ||
      Number(
        draft.weightGrams,
      ) < 0
    )
  ) {
    return "Weight must be a non-negative whole number.";
  }

  const stock = Number(
    draft.quantityOnHand,
  );

  const reserved = Number(
    draft.reservedQuantity,
  );

  const threshold = Number(
    draft.lowStockThreshold,
  );

  if (
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    return "Stock must be a non-negative whole number.";
  }

  if (
    !Number.isInteger(reserved) ||
    reserved < 0
  ) {
    return "Reserved stock must be a non-negative whole number.";
  }

  if (reserved > stock) {
    return "Reserved stock cannot be greater than total stock.";
  }

  if (
    !Number.isInteger(threshold) ||
    threshold < 0
  ) {
    return "Low-stock threshold must be a non-negative whole number.";
  }

  return null;
}

function VariantFields({
  prefix,
  draft,
  onChange,
}: VariantFieldsProps) {
  return (
    <>
      <div className="admin-form-grid">
        <div className="admin-form-field">
          <label htmlFor={`${prefix}-sku`}>
            SKU
          </label>

          <input
            id={`${prefix}-sku`}
            maxLength={100}
            onChange={(event) =>
              onChange(
                "sku",
                formatSku(
                  event.target.value,
                ),
              )
            }
            required
            value={draft.sku}
          />
        </div>

        <div className="admin-form-field">
          <label htmlFor={`${prefix}-name`}>
            Variant name
          </label>

          <input
            id={`${prefix}-name`}
            maxLength={150}
            onChange={(event) =>
              onChange(
                "name",
                event.target.value,
              )
            }
            required
            value={draft.name}
          />
        </div>

        <div className="admin-form-field">
          <label htmlFor={`${prefix}-size`}>
            Size label
          </label>

          <input
            id={`${prefix}-size`}
            maxLength={100}
            onChange={(event) =>
              onChange(
                "sizeLabel",
                event.target.value,
              )
            }
            placeholder="90 × 120 cm"
            value={draft.sizeLabel}
          />
        </div>

        <div className="admin-form-field">
          <label htmlFor={`${prefix}-price`}>
            Price (₹)
          </label>

          <input
            id={`${prefix}-price`}
            max={MAX_PRICE_RUPEES}
            min="0"
            onChange={(event) =>
              onChange(
                "priceRupees",
                event.target.value,
              )
            }
            required
            step="0.01"
            type="number"
            value={draft.priceRupees}
          />
        </div>

        <div className="admin-form-field">
          <label htmlFor={`${prefix}-colour`}>
            Colour
          </label>

          <input
            id={`${prefix}-colour`}
            onChange={(event) =>
              onChange(
                "colour",
                event.target.value,
              )
            }
            value={draft.colour}
          />
        </div>

        <div className="admin-form-field">
          <label htmlFor={`${prefix}-material`}>
            Material
          </label>

          <input
            id={`${prefix}-material`}
            onChange={(event) =>
              onChange(
                "material",
                event.target.value,
              )
            }
            value={draft.material}
          />
        </div>

        <div className="admin-form-field">
          <label htmlFor={`${prefix}-length`}>
            Length (cm)
          </label>

          <input
            id={`${prefix}-length`}
            min="0"
            onChange={(event) =>
              onChange(
                "lengthCm",
                event.target.value,
              )
            }
            step="0.01"
            type="number"
            value={draft.lengthCm}
          />
        </div>

        <div className="admin-form-field">
          <label htmlFor={`${prefix}-width`}>
            Width (cm)
          </label>

          <input
            id={`${prefix}-width`}
            min="0"
            onChange={(event) =>
              onChange(
                "widthCm",
                event.target.value,
              )
            }
            step="0.01"
            type="number"
            value={draft.widthCm}
          />
        </div>

        <div className="admin-form-field">
          <label htmlFor={`${prefix}-height`}>
            Height (cm)
          </label>

          <input
            id={`${prefix}-height`}
            min="0"
            onChange={(event) =>
              onChange(
                "heightCm",
                event.target.value,
              )
            }
            step="0.01"
            type="number"
            value={draft.heightCm}
          />
        </div>

        <div className="admin-form-field">
          <label htmlFor={`${prefix}-weight`}>
            Weight (grams)
          </label>

          <input
            id={`${prefix}-weight`}
            min="0"
            onChange={(event) =>
              onChange(
                "weightGrams",
                event.target.value,
              )
            }
            step="1"
            type="number"
            value={draft.weightGrams}
          />
        </div>

        <div className="admin-form-field">
          <label htmlFor={`${prefix}-stock`}>
            Quantity on hand
          </label>

          <input
            id={`${prefix}-stock`}
            min="0"
            onChange={(event) =>
              onChange(
                "quantityOnHand",
                event.target.value,
              )
            }
            required
            step="1"
            type="number"
            value={draft.quantityOnHand}
          />
        </div>

        <div className="admin-form-field">
          <label htmlFor={`${prefix}-reserved`}>
            Reserved quantity
          </label>

          <input
            id={`${prefix}-reserved`}
            min="0"
            onChange={(event) =>
              onChange(
                "reservedQuantity",
                event.target.value,
              )
            }
            required
            step="1"
            type="number"
            value={draft.reservedQuantity}
          />
        </div>

        <div className="admin-form-field">
          <label htmlFor={`${prefix}-threshold`}>
            Low-stock threshold
          </label>

          <input
            id={`${prefix}-threshold`}
            min="0"
            onChange={(event) =>
              onChange(
                "lowStockThreshold",
                event.target.value,
              )
            }
            required
            step="1"
            type="number"
            value={draft.lowStockThreshold}
          />
        </div>
      </div>

      <label className="admin-variant-active-option">
        <input
          checked={draft.isActive}
          onChange={(event) =>
            onChange(
              "isActive",
              event.target.checked,
            )
          }
          type="checkbox"
        />

        Active variant
      </label>
    </>
  );
}

export function AdminProductVariantsEditor({
  product,
  onChanged,
}: AdminProductVariantsEditorProps) {
  const [drafts, setDrafts] =
  useState<
    Record<string, VariantDraft>
  >(() =>
    createVariantDrafts(
      product,
    ),
  );

  const [newVariant, setNewVariant] =
    useState<VariantDraft>(
      emptyVariant(product),
    );

  const [showNewVariant, setShowNewVariant] =
    useState(false);

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



  function beginRequest(): void {
    setError(null);
    setSuccessMessage(null);
  }

  function updateDraft<
    Field extends keyof VariantDraft,
  >(
    variantId: string,
    field: Field,
    value: VariantDraft[Field],
  ): void {
    setDrafts((current) => ({
      ...current,
      [variantId]: {
        ...current[variantId],
        [field]: value,
      },
    }));
  }

  function updateNewVariant<
    Field extends keyof VariantDraft,
  >(
    field: Field,
    value: VariantDraft[Field],
  ): void {
    setNewVariant((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function buildCreatePayload(
    draft: VariantDraft,
  ): ProductVariantCreateRequest {
    return {
      sku: draft.sku.trim(),
      name: draft.name.trim(),
      size_label:
        optionalText(
          draft.sizeLabel,
        ),
      colour:
        optionalText(
          draft.colour,
        ),
      material:
        optionalText(
          draft.material,
        ),
      price_paise:
        toPaise(
          draft.priceRupees,
        ),
      length_cm:
        optionalNumber(
          draft.lengthCm,
        ),
      width_cm:
        optionalNumber(
          draft.widthCm,
        ),
      height_cm:
        optionalNumber(
          draft.heightCm,
        ),
      weight_grams:
        optionalInteger(
          draft.weightGrams,
        ),
      is_active:
        draft.isActive,

      inventory: {
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
    };
  }

  async function handleSaveVariant(
    variant: ProductVariant,
  ): Promise<void> {
    const draft =
      drafts[variant.id];

    if (!draft) {
      return;
    }

    const validationError =
      validateVariant(draft);

    if (validationError) {
      setError(validationError);
      return;
    }

    beginRequest();
    setBusyVariantId(variant.id);

    const variantPayload:
      ProductVariantUpdateRequest = {
        sku: draft.sku.trim(),
        name: draft.name.trim(),
        size_label:
          optionalText(
            draft.sizeLabel,
          ),
        colour:
          optionalText(
            draft.colour,
          ),
        material:
          optionalText(
            draft.material,
          ),
        price_paise:
          toPaise(
            draft.priceRupees,
          ),
        length_cm:
          optionalNumber(
            draft.lengthCm,
          ),
        width_cm:
          optionalNumber(
            draft.widthCm,
          ),
        height_cm:
          optionalNumber(
            draft.heightCm,
          ),
        weight_grams:
          optionalInteger(
            draft.weightGrams,
          ),
        is_active:
          draft.isActive,
      };

    try {
      await updateProductVariant(
        variant.id,
        variantPayload,
      );

      await updateVariantInventory(
        variant.id,
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

      await onChanged();

      setSuccessMessage(
        `${draft.name} was updated.`,
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

  async function handleAddVariant(): Promise<void> {
    const validationError =
      validateVariant(newVariant);

    if (validationError) {
      setError(validationError);
      return;
    }

    beginRequest();
    setBusyVariantId("new");

    try {
      await addProductVariant(
        product.id,
        buildCreatePayload(
          newVariant,
        ),
      );

      await onChanged();

      setNewVariant(
        emptyVariant(product),
      );

      setShowNewVariant(false);

      setSuccessMessage(
        "New product variant added.",
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

  async function handleDeleteVariant(
    variant: ProductVariant,
  ): Promise<void> {
    if (
      product.variants.length === 1
    ) {
      setError(
        "A product must keep at least one variant.",
      );
      return;
    }

    const shouldDelete =
      window.confirm(
        `Delete variant "${variant.name}"?`,
      );

    if (!shouldDelete) {
      return;
    }

    beginRequest();
    setBusyVariantId(variant.id);

    try {
      await deleteProductVariant(
        variant.id,
      );

      await onChanged();

      setSuccessMessage(
        `${variant.name} was deleted.`,
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

  return (
    <section className="admin-form-section">
      <div className="admin-form-heading admin-form-heading-with-action">
        <span>3</span>

        <div>
          <h3>Product variants</h3>

          <p>
            Add, edit or remove sizes,
            colours, prices and inventory.
          </p>
        </div>

        <button
          className="admin-secondary-button"
          disabled={
            product.variants.length >=
            50
          }
          onClick={() => {
            setShowNewVariant(true);
            setError(null);
          }}
          type="button"
        >
          Add variant
        </button>
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

      {showNewVariant && (
        <article className="admin-variant-card admin-new-variant-card">
          <div className="admin-variant-card-heading">
            <div>
              <h4>New variant</h4>

              <p>
                Enter the new purchasable
                option.
              </p>
            </div>
          </div>

          <VariantFields
            draft={newVariant}
            onChange={
              updateNewVariant
            }
            prefix="new-variant"
          />

          <div className="admin-variant-editor-actions">
            <button
              className="admin-primary-button"
              disabled={
                busyVariantId ===
                "new"
              }
              onClick={() =>
                void handleAddVariant()
              }
              type="button"
            >
              {busyVariantId === "new"
                ? "Adding..."
                : "Add variant"}
            </button>

            <button
              disabled={
                busyVariantId ===
                "new"
              }
              onClick={() => {
                setShowNewVariant(
                  false,
                );

                setNewVariant(
                  emptyVariant(
                    product,
                  ),
                );
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </article>
      )}

      <div className="admin-variant-list">
        {product.variants.map(
          (variant) => {
            const draft =
              drafts[variant.id];

            if (!draft) {
              return null;
            }

            const isBusy =
              busyVariantId ===
              variant.id;

            return (
              <article
                className="admin-variant-card"
                key={variant.id}
              >
                <div className="admin-variant-card-heading">
                  <div>
                    <h4>
                      {variant.name}
                    </h4>

                    <p>
                      {variant.sku}
                    </p>
                  </div>

                  <span>
                    {variant.inventory
                      ?.available_quantity ??
                      0}{" "}
                    available
                  </span>
                </div>

                <VariantFields
                  draft={draft}
                  onChange={(
                    field,
                    value,
                  ) =>
                    updateDraft(
                      variant.id,
                      field,
                      value,
                    )
                  }
                  prefix={`variant-${variant.id}`}
                />

                <div className="admin-variant-editor-actions">
                  <button
                    className="admin-primary-button"
                    disabled={isBusy}
                    onClick={() =>
                      void handleSaveVariant(
                        variant,
                      )
                    }
                    type="button"
                  >
                    {isBusy
                      ? "Saving..."
                      : "Save variant"}
                  </button>

                  <button
                    className="admin-delete-button"
                    disabled={
                      isBusy ||
                      product.variants
                        .length === 1
                    }
                    onClick={() =>
                      void handleDeleteVariant(
                        variant,
                      )
                    }
                    type="button"
                  >
                    Delete variant
                  </button>
                </div>
              </article>
            );
          },
        )}
      </div>
    </section>
  );
}