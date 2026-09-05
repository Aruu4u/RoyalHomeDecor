import {
  useEffect,
  useState,
} from "react";
import type {
  FormEvent,
} from "react";
import {
  Link,
  useParams,
} from "react-router-dom";

import {
  AdminProductImagesEditor,
} from "../components/admin/AdminProductImagesEditor";
import {
  AdminProductVariantsEditor,
} from "../components/admin/AdminProductVariantsEditor";
import {
  getAdminCollections,
} from "../services/collections";
import {
  getAdminProductById,
  updateProduct,
} from "../services/products";
import {
  formatPrice,
  formatRupees,
} from "../lib/currency";
import {
  describeOfferEnd,
  durationChoiceToDays,
  OFFER_DURATION_PRESETS,
} from "../lib/offerTime";
import {
  applyPercent,
} from "../lib/pricing";
import {
  offerService,
} from "../services/offers";
import type {
  Collection,
} from "../types/collection";
import type {
  ProductOfferStatus,
} from "../types/offer";
import type {
  ProductDetails,
  ProductUpdateRequest,
} from "../types/product";

const MAX_PRICE_PAISE =
  2_147_483_647;

const MAX_PRICE_RUPEES =
  MAX_PRICE_PAISE / 100;

interface ProductEditForm {
  collectionId: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  basePriceRupees: string;
  topMaterial: string;
  baseMaterial: string;
  finish: string;
  colour: string;
  style: string;
  isActive: boolean;
  isRecommended: boolean;

  /* Standalone offer. Empty string means no offer. */
  offerPercent: string;
  offerLabel: string;

  /*
   * How long the offer runs for. "never" is a sentinel rather than an
   * empty string, because an empty select value cannot be told apart from
   * "nothing chosen yet".
   */
  offerDuration: string;
}

const emptyForm: ProductEditForm = {
  collectionId: "",
  name: "",
  slug: "",
  shortDescription: "",
  description: "",
  basePriceRupees: "",
  topMaterial: "",
  baseMaterial: "",
  finish: "",
  colour: "",
  style: "",
  isActive: true,
  isRecommended: false,
  offerPercent: "",
  offerLabel: "",
  offerDuration: "never",
};

/*
 * No slug generation here on purpose. An existing product keeps the
 * slug it was created with, so there is nothing to derive.
 */

function optionalText(
  value: string,
): string | null {
  const trimmed = value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
}

function toRupees(
  paise: number,
): string {
  return (paise / 100).toFixed(2);
}

function toPaise(
  rupeesValue: string,
): number {
  return Math.round(
    Number(rupeesValue) * 100,
  );
}

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Unable to update the product.";
}

function createProductForm(
  product: ProductDetails,
): ProductEditForm {
  return {
    collectionId:
      product.collection_id,

    name:
      product.name,

    slug:
      product.slug,

    shortDescription:
      product.short_description ?? "",

    description:
      product.description ?? "",

    basePriceRupees:
      toRupees(
        product.base_price_paise,
      ),

    topMaterial:
      product.top_material ?? "",

    baseMaterial:
      product.base_material ?? "",

    finish:
      product.finish ?? "",

    colour:
      product.colour ?? "",

    style:
      product.style ?? "",

    isActive:
      product.is_active,

    isRecommended:
      product.is_recommended,

    offerPercent:
      product.offer_percent === null ||
      product.offer_percent === undefined
        ? ""
        : String(product.offer_percent),

    offerLabel:
      product.offer_label ?? "",

    /*
     * Reset to "keep" whenever the saved product is loaded. The stored
     * value is an absolute date, not a number of days, so re-deriving a
     * duration from it would silently restart the clock on every save.
     * "keep" sends nothing and leaves the existing deadline alone.
     */
    offerDuration:
      product.offer_percent == null
        ? "never"
        : "keep",
  };
}

/**
 * Shows what the discount works out to, using the same rounding as the
 * backend, so the administrator can confirm before saving.
 */
function buildOfferPreview(
  basePriceRupees: string,
  offerPercent: string,
): string | null {
  const rupees = Number.parseFloat(basePriceRupees);
  const percent = Number.parseInt(offerPercent, 10);

  if (
    Number.isNaN(rupees) ||
    rupees <= 0 ||
    Number.isNaN(percent) ||
    percent < 1 ||
    percent > 90
  ) {
    return null;
  }

  const basePaise = Math.round(rupees * 100);
  const offerPaise = applyPercent(basePaise, percent);

  return (
    `${percent}% off: ${formatPrice(basePaise)} becomes ` +
    `${formatPrice(offerPaise)} (saving ${formatPrice(
      basePaise - offerPaise,
    )})`
  );
}


function AdminEditProductPage() {
  const { productId } =
    useParams<{
      productId: string;
    }>();

  const [collections, setCollections] =
    useState<Collection[]>([]);

  const [product, setProduct] =
    useState<ProductDetails | null>(
      null,
    );

  /*
   * Which special offer sections this product already sits in. Loaded
   * separately so a failure here cannot stop the page editing: the offer
   * panel simply shows nothing extra.
   */
  const [offerStatus, setOfferStatus] =
    useState<ProductOfferStatus | null>(
      null,
    );

  const [form, setForm] =
    useState<ProductEditForm>(
      emptyForm,
    );

  const [isLoading, setIsLoading] =
    useState(true);

  const offerPreview = buildOfferPreview(
    form.basePriceRupees,
    form.offerPercent,
  );

  const [isSaving, setIsSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
   if (!productId) {
  return;
}

    const selectedProductId =
      productId;

    const controller =
      new AbortController();

    let isActive = true;

    async function loadPage(): Promise<void> {
      try {
        const [
          productData,
          collectionData,
        ] = await Promise.all([
          getAdminProductById(
            selectedProductId,
            controller.signal,
          ),

          getAdminCollections(
            controller.signal,
          ),
        ]);

        if (!isActive) {
          return;
        }

        setProduct(productData);
        setCollections(collectionData);
        setForm(
          createProductForm(
            productData,
          ),
        );

        /*
         * Fetched after the product because it needs the id, and left
         * deliberately unawaited in the failure sense: a problem reading
         * offer membership should not block editing the product.
         */
        try {
          const status =
            await offerService.getProductOfferStatus(
              productData.id,
              controller.signal,
            );

          if (isActive) {
            setOfferStatus(status);
          }
        } catch (statusError) {
          console.error(
            "Offer status unavailable:",
            statusError,
          );
        }
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

    void loadPage();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [productId]);

  async function refreshProduct(): Promise<void> {
    if (!productId) {
      return;
    }

    const refreshedProduct =
      await getAdminProductById(
        productId,
      );

    setProduct(refreshedProduct);
  }

  /*
   * Re-read after saving so the offer panel reflects the discount that is
   * now in force, including the deadline the server just calculated.
   */
  async function refreshOfferStatus(
    id: string,
  ): Promise<void> {
    try {
      setOfferStatus(
        await offerService.getProductOfferStatus(
          id,
        ),
      );
    } catch (statusError) {
      console.error(
        "Offer status unavailable:",
        statusError,
      );
    }
  }

  function updateField<
    Field extends keyof ProductEditForm,
  >(
    field: Field,
    value: ProductEditForm[Field],
  ): void {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function validateForm(): string | null {
    if (!form.collectionId) {
      return "Select a collection.";
    }

    if (
      form.name.trim().length < 2
    ) {
      return "Product name must contain at least 2 characters.";
    }

    /*
     * The slug is loaded from the saved product and never edited, so it
     * is already valid. Kept as a guard only against a malformed record.
     */
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
        form.slug,
      )
    ) {
      return "This product has an invalid page address and cannot be saved.";
    }

    if (
      form.shortDescription
        .trim()
        .length < 10
    ) {
      return "Short description must contain at least 10 characters.";
    }

    if (
      form.description.trim().length <
      20
    ) {
      return "Full description must contain at least 20 characters.";
    }

    const price = Number(
      form.basePriceRupees,
    );

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      return "Enter a valid base price.";
    }

    if (
      price > MAX_PRICE_RUPEES
    ) {
      return `Base price cannot exceed ${formatRupees(
        MAX_PRICE_RUPEES,
      )}.`;
    }

    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!productId) {
      setError(
        "A product ID was not provided.",
      );
      return;
    }

    const selectedProductId =
      productId;

    const validationError =
      validateForm();

    if (validationError) {
      setError(validationError);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    const payload:
      ProductUpdateRequest = {
        collection_id:
          form.collectionId,

        name:
          form.name.trim(),

        slug:
          form.slug.trim(),

        short_description:
          form.shortDescription.trim(),

        description:
          form.description.trim(),

        base_price_paise:
          toPaise(
            form.basePriceRupees,
          ),

        top_material:
          optionalText(
            form.topMaterial,
          ),

        base_material:
          optionalText(
            form.baseMaterial,
          ),

        finish:
          optionalText(
            form.finish,
          ),

        colour:
          optionalText(
            form.colour,
          ),

        style:
          optionalText(
            form.style,
          ),

        is_active:
          form.isActive,

        is_recommended:
          form.isRecommended,

        /*
         * An empty field clears the offer. The label is only meaningful
         * alongside a percentage, so it is cleared with it.
         */
        offer_percent:
          form.offerPercent.trim() === ""
            ? null
            : Number.parseInt(
                form.offerPercent,
                10,
              ),

        offer_label:
          form.offerPercent.trim() === ""
            ? null
            : optionalText(
                form.offerLabel,
              ),
      };

    /*
     * The expiry is only sent when it is actually being changed, because
     * the API reads three distinct states from this field: absent means
     * leave the deadline alone, null means never expires, and a number
     * means that many days from now.
     *
     * Sending it unconditionally would restart the countdown every time
     * an unrelated field, such as the description, was saved.
     */
    if (
      form.offerPercent.trim() !== "" &&
      form.offerDuration !== "keep"
    ) {
      payload.offer_duration_days =
        durationChoiceToDays(
          form.offerDuration,
        );
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedProduct =
        await updateProduct(
          selectedProductId,
          payload,
        );

      setProduct(updatedProduct);
      setForm(
        createProductForm(
          updatedProduct,
        ),
      );

      void refreshOfferStatus(
        selectedProductId,
      );

      setSuccessMessage(
        "Product information was updated successfully.",
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!productId) {
  return (
    <section className="admin-panel">
      <h2>Product unavailable</h2>

      <p>
        A product ID was not provided.
      </p>

      <Link to="/admin/products">
        Return to products
      </Link>
    </section>
  );
}
  if (isLoading) {
    return (
      <section
        aria-live="polite"
        className="admin-panel"
      >
        <p>Loading product...</p>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="admin-panel">
        <h2>Product unavailable</h2>

        <p>
          {error ??
            "The selected product could not be loaded."}
        </p>

        <Link to="/admin/products">
          Return to products
        </Link>
      </section>
    );
  }

  return (
    <section className="admin-edit-product-page">
      <div className="admin-section-heading">
        <div>
          <h2>Edit product</h2>

          <p>
            Update the catalogue information
            for {product.name}.
          </p>
        </div>

        <div className="admin-edit-heading-links">
          <Link
            to={`/products/${product.slug}`}
          >
            View product
          </Link>

          <Link to="/admin/products">
            Back to products
          </Link>
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

      <form
        className="admin-product-form"
        onSubmit={handleSubmit}
      >
        <section className="admin-form-section">
          <div className="admin-form-heading">
            <span>1</span>

            <div>
              <h3>
                Product information
              </h3>

              <p>
                Main information displayed
                on the storefront.
              </p>
            </div>
          </div>

          <div className="admin-form-grid">
            <div className="admin-form-field">
              <label htmlFor="edit-product-collection">
                Collection
              </label>

              <select
                id="edit-product-collection"
                onChange={(event) =>
                  updateField(
                    "collectionId",
                    event.target.value,
                  )
                }
                required
                value={
                  form.collectionId
                }
              >
                {collections.map(
                  (collection) => (
                    <option
                      key={collection.id}
                      value={
                        collection.id
                      }
                    >
                      {collection.name}

                      {!collection.is_active
                        ? " \u2014 inactive"
                        : ""}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="admin-form-field">
              <label htmlFor="edit-product-name">
                Product name
              </label>

              <input
                id="edit-product-name"
                maxLength={200}
                minLength={2}
                onChange={(event) =>
                  updateField(
                    "name",
                    event.target.value,
                  )
                }
                required
                type="text"
                value={form.name}
              />
            </div>

            {/*
              The slug is intentionally frozen on an existing product and
              is NOT regenerated when the name changes.
              
              It is the product's public address. Changing it breaks every
              link already shared, bookmarked or indexed, and this API has
              no redirect handling, so the old address would simply 404.
              Renaming a product therefore keeps its original address,
              which is how established storefronts behave.
            */}
            <p className="admin-form-field admin-form-full admin-slug-preview">
              <span className="admin-slug-preview-label">Page address</span>

              <span className="admin-slug-preview-value">
                /products/{form.slug}
              </span>

              <span className="admin-slug-preview-note">
                Fixed once published, so existing links keep working.
              </span>
            </p>

            <div className="admin-form-field admin-form-full">
              <label htmlFor="edit-product-short-description">
                Short description
              </label>

              <textarea
                id="edit-product-short-description"
                maxLength={400}
                minLength={10}
                onChange={(event) =>
                  updateField(
                    "shortDescription",
                    event.target.value,
                  )
                }
                required
                rows={3}
                value={
                  form.shortDescription
                }
              />
            </div>

            <div className="admin-form-field admin-form-full">
              <label htmlFor="edit-product-description">
                Full description
              </label>

              <textarea
                id="edit-product-description"
                maxLength={10000}
                minLength={20}
                onChange={(event) =>
                  updateField(
                    "description",
                    event.target.value,
                  )
                }
                required
                rows={6}
                value={form.description}
              />
            </div>

            <div className="admin-form-field">
              <label htmlFor="edit-product-price">
                Base price
              </label>

              <input
                id="edit-product-price"
                max={MAX_PRICE_RUPEES}
                min="0"
                onChange={(event) =>
                  updateField(
                    "basePriceRupees",
                    event.target.value,
                  )
                }
                required
                step="0.01"
                type="number"
                value={
                  form.basePriceRupees
                }
              />
            </div>

            {/*
              Three fields rather than one. Customers filter on the
              surface and the frame separately, so storing "marble and
              brass" in a single box made both unfilterable.
            */}
            <div className="admin-form-field">
              <label htmlFor="edit-product-top-material">
                Top material
              </label>

              <input
                id="edit-product-top-material"
                maxLength={120}
                onChange={(event) =>
                  updateField(
                    "topMaterial",
                    event.target.value,
                  )
                }
                placeholder="Italian marble"
                type="text"
                value={form.topMaterial}
              />
            </div>

            <div className="admin-form-field">
              <label htmlFor="edit-product-base-material">
                Base material
              </label>

              <input
                id="edit-product-base-material"
                maxLength={120}
                onChange={(event) =>
                  updateField(
                    "baseMaterial",
                    event.target.value,
                  )
                }
                placeholder="Solid brass"
                type="text"
                value={form.baseMaterial}
              />
            </div>

            <div className="admin-form-field">
              <label htmlFor="edit-product-finish">
                Finish
              </label>

              <input
                id="edit-product-finish"
                maxLength={120}
                onChange={(event) =>
                  updateField(
                    "finish",
                    event.target.value,
                  )
                }
                placeholder="Hand-polished satin"
                type="text"
                value={form.finish}
              />
            </div>

            <div className="admin-form-field">
              <label htmlFor="edit-product-colour">
                Default colour
              </label>

              <input
                id="edit-product-colour"
                maxLength={80}
                onChange={(event) =>
                  updateField(
                    "colour",
                    event.target.value,
                  )
                }
                type="text"
                value={form.colour}
              />
            </div>

            <div className="admin-form-field">
              <label htmlFor="edit-product-style">
                Style
              </label>

              <input
                id="edit-product-style"
                maxLength={100}
                onChange={(event) =>
                  updateField(
                    "style",
                    event.target.value,
                  )
                }
                type="text"
                value={form.style}
              />
            </div>
          </div>

          <div className="admin-form-checkboxes">
            <label>
              <input
                checked={form.isActive}
                onChange={(event) =>
                  updateField(
                    "isActive",
                    event.target.checked,
                  )
                }
                type="checkbox"
              />

              Active product
            </label>

            <label>
              <input
                checked={
                  form.isRecommended
                }
                onChange={(event) =>
                  updateField(
                    "isRecommended",
                    event.target.checked,
                  )
                }
                type="checkbox"
              />

              Recommended product
            </label>
          </div>

          {/* ---------- Standalone offer ---------- */}

          <fieldset className="admin-offer-fieldset">
            <legend>Offer on this product</legend>

            <p className="admin-offer-hint">
              Applies to this product on its own. If it is also in a
              special offer section, whichever discount is larger is the
              one customers get. Leave the percentage empty for no offer.
            </p>

            {/* ---------- Special offer membership ---------- */}

            {/*
              Shown here because this is where an administrator comes to
              set a discount, and it is the moment they need to know one
              already exists somewhere else. Without it they set 25% here,
              see 40% on the storefront, and have nothing to go on.
            */}
            {offerStatus && offerStatus.memberships.length > 0 && (
              <div className="admin-offer-membership">
                <p className="admin-offer-membership-title">
                  Also in {offerStatus.memberships.length} special offer
                  section
                  {offerStatus.memberships.length === 1 ? "" : "s"}
                </p>

                <ul className="admin-offer-membership-list">
                  {offerStatus.memberships.map((membership) => {
                    const deadline = describeOfferEnd(membership.ends_at);

                    return (
                      <li
                        className={
                          membership.is_live
                            ? "admin-offer-membership-item is-live"
                            : "admin-offer-membership-item"
                        }
                        key={membership.item_id}
                      >
                        <span className="admin-offer-membership-name">
                          {membership.section_title}
                        </span>

                        <span className="admin-offer-membership-percent">
                          {membership.discount_percent}% off
                        </span>

                        <span className="admin-offer-membership-state">
                          {membership.is_live
                            ? deadline.neverExpires
                              ? "Running, no end date"
                              : `Running, ${deadline.shortLabel}`
                            : !membership.section_is_active
                              ? "Section hidden"
                              : "Expired"}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {offerStatus.effective_discount_percent !== null && (
                  <p className="admin-offer-membership-effective">
                    Customers currently pay{" "}
                    <strong>
                      {offerStatus.effective_discount_percent}% off
                    </strong>
                    , the largest live discount from any source.{" "}
                    <Link to="/admin/offers">Manage offer sections</Link>
                  </p>
                )}
              </div>
            )}

            <div className="admin-form-grid">
              <div className="admin-form-field">
                <label htmlFor="edit-offer-percent">Discount %</label>

                <input
                  id="edit-offer-percent"
                  max={90}
                  min={1}
                  onChange={(event) =>
                    updateField(
                      "offerPercent",
                      event.target.value,
                    )
                  }
                  placeholder="No offer"
                  type="number"
                  value={form.offerPercent}
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="edit-offer-label">
                  Label (optional)
                </label>

                <input
                  id="edit-offer-label"
                  maxLength={60}
                  onChange={(event) =>
                    updateField(
                      "offerLabel",
                      event.target.value,
                    )
                  }
                  placeholder="Festive offer"
                  value={form.offerLabel}
                />
              </div>

              {/* ---------- Expiry ---------- */}

              <div className="admin-form-field">
                <label htmlFor="edit-offer-duration">
                  Offer expires
                </label>

                <select
                  disabled={form.offerPercent.trim() === ""}
                  id="edit-offer-duration"
                  onChange={(event) =>
                    updateField(
                      "offerDuration",
                      event.target.value,
                    )
                  }
                  value={form.offerDuration}
                >
                  {/*
                    Only offered once a deadline already exists, so that
                    saving an unrelated field does not restart the
                    countdown.
                  */}
                  {product.offer_ends_at && (
                    <option value="keep">
                      Keep the current end date
                    </option>
                  )}

                  <option value="never">Never expires</option>

                  {OFFER_DURATION_PRESETS.map((days) => (
                    <option key={days} value={String(days)}>
                      In {days} day{days === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>

                <small className="admin-field-note">
                  {form.offerPercent.trim() === ""
                    ? "Set a discount first."
                    : form.offerDuration === "keep"
                      ? describeOfferEnd(product.offer_ends_at).longLabel
                      : form.offerDuration === "never"
                        ? "Runs until you remove it."
                        : "Counted from when you save."}
                </small>
              </div>
            </div>

            {offerPreview && (
              <p className="admin-offer-preview">{offerPreview}</p>
            )}
          </fieldset>

          <div className="admin-edit-save-area">
            <button
              className="admin-primary-button"
              disabled={isSaving}
              type="submit"
            >
              {isSaving
                ? "Saving changes..."
                : "Save product information"}
            </button>
          </div>
        </section>
      </form>

      <AdminProductImagesEditor
        onChanged={refreshProduct}
        product={product}
      />

  <AdminProductVariantsEditor
  key={product.variants
    .map(
      (variant) =>
        `${variant.id}:${variant.updated_at}:${
          variant.inventory
            ?.updated_at ?? ""
        }`,
    )
    .join("|")}
  onChanged={refreshProduct}
  product={product}
/>
    </section>
  );
}

export default AdminEditProductPage;