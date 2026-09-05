import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";

import { formatRupees } from "../lib/currency";
import { getAdminCollections } from "../services/collections";
import {
  removeProductImages,
  uploadProductImages,
} from "../services/productImages";
import type { UploadedProductImage } from "../services/productImages";
import { createProduct } from "../services/products";
import type { Collection } from "../types/collection";
import type {
  ProductCreateRequest,
  ProductDetails,
} from "../types/product";

const MAX_IMAGES = 20;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const MAX_PRICE_PAISE = 2_147_483_647;
const MAX_PRICE_RUPEES =
  MAX_PRICE_PAISE / 100;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

interface ProductFormState {
  collectionId: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  basePriceRupees: string;

  /*
   * Three material fields rather than one. Customers filter on the surface
   * and the frame separately, so a single "marble and brass" box left both
   * unfilterable.
   */
  topMaterial: string;
  baseMaterial: string;
  finish: string;

  colour: string;
  style: string;
  isActive: boolean;
  isRecommended: boolean;
}

interface ImageDraft {
  id: string;
  file: File;
  previewUrl: string;
  altText: string;
}

interface VariantDraft {
  id: string;
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

const initialForm: ProductFormState = {
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
};

function createVariant(): VariantDraft {
  return {
    id: crypto.randomUUID(),
    sku: "",
    name: "Standard",
    sizeLabel: "",
    colour: "",
    material: "",
    priceRupees: "",
    lengthCm: "",
    widthCm: "",
    heightCm: "",
    weightGrams: "",
    quantityOnHand: "10",
    reservedQuantity: "0",
    lowStockThreshold: "3",
    isActive: true,
  };
}

/*
 * Builds a URL slug from a product name.
 *
 * Must satisfy the backend rule ^[a-z0-9]+(?:-[a-z0-9]+)*$ and stay
 * within the 220-character column. Accented characters are folded to
 * their base letter first, so "CafÃ© Table" becomes "cafe-table" rather
 * than losing the letter entirely.
 */
function createSlug(value: string): string {
  const slug = value
    .normalize("NFD")
    /* Strip combining accent marks left behind by NFD. */
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  /* Trim to a safe length without leaving a trailing hyphen. */
  return slug.slice(0, 200).replace(/-$/, "");
}

function formatSku(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-/, "");
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalInteger(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function toPaise(value: string): number {
  const rupees = Number(value);

  if (
    !Number.isFinite(rupees) ||
    rupees < 0
  ) {
    throw new Error(
      "Enter a valid non-negative price.",
    );
  }

  const paise = Math.round(
    rupees * 100,
  );

  if (paise > MAX_PRICE_PAISE) {
    throw new Error(
      `Price cannot exceed ${formatRupees(MAX_PRICE_RUPEES)}.`,
    );
  }

  return paise;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to create the product.";
}

function AdminNewProductPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [form, setForm] = useState<ProductFormState>(initialForm);
  const [images, setImages] = useState<ImageDraft[]>([]);
  const imagesRef = useRef<ImageDraft[]>([]);
  const [primaryImageId, setPrimaryImageId] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>(() => [createVariant()]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdProduct, setCreatedProduct] = useState<ProductDetails | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadCollections(): Promise<void> {
      try {
        const data = await getAdminCollections(controller.signal);
        if (!active) return;
        setCollections(data);
        const first = data.find((collection) => collection.is_active) ?? data[0];
        if (first) {
          setForm((current) => ({ ...current, collectionId: first.id }));
        }
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }
        if (active) setError(getErrorMessage(requestError));
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadCollections();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.previewUrl),
      );
    };
  }, []);

  const uploadedImageCountText = useMemo(
    () => `${images.length}/${MAX_IMAGES} images selected`,
    [images.length],
  );

  function updateField<Field extends keyof ProductFormState>(
    field: Field,
    value: ProductFormState[Field],
  ): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateVariant<Field extends keyof VariantDraft>(
    variantId: string,
    field: Field,
    value: VariantDraft[Field],
  ): void {
    setVariants((current) =>
      current.map((variant) =>
        variant.id === variantId ? { ...variant, [field]: value } : variant,
      ),
    );
  }

  /*
   * The slug is always derived from the name on a new product. The old
   * conditional logic existed to avoid overwriting a hand-typed slug,
   * which no longer applies now that the field is not editable.
   */
  function handleNameChange(name: string): void {
    setForm((current) => ({
      ...current,
      name,
      slug: createSlug(name),
    }));
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;

    if (images.length + files.length > MAX_IMAGES) {
      setError(`You can upload a maximum of ${MAX_IMAGES} images.`);
      return;
    }

    const invalid = files.find(
      (file) => !ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_SIZE,
    );

    if (invalid) {
      setError(`${invalid.name} must be JPG, PNG or WebP and smaller than 5 MB.`);
      return;
    }

    const drafts = files.map((file, index) => {
      const id = crypto.randomUUID();
      return {
        id,
        file,
        previewUrl: URL.createObjectURL(file),
        altText: `${form.name.trim() || "Product"} image ${images.length + index + 1}`,
      };
    });

    setImages((current) => [...current, ...drafts]);
    if (!primaryImageId && drafts[0]) setPrimaryImageId(drafts[0].id);
    setError(null);
  }

  function removeImage(imageId: string): void {
    setImages((current) => {
      const removed = current.find((image) => image.id === imageId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      const remaining = current.filter((image) => image.id !== imageId);
      if (primaryImageId === imageId) setPrimaryImageId(remaining[0]?.id ?? "");
      return remaining;
    });
  }

  function moveImage(index: number, direction: -1 | 1): void {
    setImages((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  }

  function addVariant(): void {
    if (variants.length >= 50) {
      setError("A product can contain a maximum of 50 variants.");
      return;
    }
    setVariants((current) => [...current, createVariant()]);
  }

  function removeVariant(variantId: string): void {
    if (variants.length === 1) {
      setError("A product must contain at least one variant.");
      return;
    }
    setVariants((current) => current.filter((variant) => variant.id !== variantId));
  }

  function validate(): string | null {
    if (!form.collectionId) return "Select a collection.";
    if (form.name.trim().length < 2) return "Enter a valid product name.";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) return "Enter a valid slug.";
    if (form.shortDescription.trim().length < 10) return "Short description is too short.";
    if (form.description.trim().length < 20) return "Full description is too short.";
    const basePriceRupees = Number(
  form.basePriceRupees,
);

if (
  !Number.isFinite(basePriceRupees) ||
  basePriceRupees < 0
) {
  return "Enter a valid base price.";
}

if (
  basePriceRupees >
  MAX_PRICE_RUPEES
) {
  return `Base price cannot exceed ${formatRupees(MAX_PRICE_RUPEES)}.`;
}
    if (!images.length) return "Select at least one product image.";
    if (!primaryImageId || !images.some((image) => image.id === primaryImageId)) {
      return "Select one primary image.";
    }
    if (images.some((image) => image.altText.trim().length < 3)) {
      return "Every image description must contain at least 3 characters.";
    }

    const skus = variants.map((variant) => variant.sku.trim());
    if (new Set(skus).size !== skus.length) return "Every variant must have a unique SKU.";

    for (let index = 0; index < variants.length; index += 1) {
      const variant = variants[index];
      const number = index + 1;
      if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(variant.sku)) {
        return `Variant ${number}: enter a valid uppercase SKU.`;
      }
      if (!variant.name.trim()) return `Variant ${number}: enter a name.`;
const price =
  variant.priceRupees.trim()
    ? Number(variant.priceRupees)
    : basePriceRupees;

if (
  !Number.isFinite(price) ||
  price < 0
) {
  return `Variant ${number}: enter a valid price.`;
}

if (price > MAX_PRICE_RUPEES) {
  return `Variant ${number}: price cannot exceed ${formatRupees(
    MAX_PRICE_RUPEES,
  )}.`;
}

      const decimalFields = [variant.lengthCm, variant.widthCm, variant.heightCm];
      if (
        decimalFields.some(
          (value) => value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0),
        )
      ) {
        return `Variant ${number}: dimensions must be non-negative numbers.`;
      }

      if (
        variant.weightGrams.trim() &&
        (!Number.isInteger(Number(variant.weightGrams)) || Number(variant.weightGrams) < 0)
      ) {
        return `Variant ${number}: weight must be a non-negative whole number.`;
      }

      const stock = Number(variant.quantityOnHand);
      const reserved = Number(variant.reservedQuantity);
      const threshold = Number(variant.lowStockThreshold);
      if (!Number.isInteger(stock) || stock < 0) return `Variant ${number}: enter valid stock.`;
      if (!Number.isInteger(reserved) || reserved < 0) {
        return `Variant ${number}: enter a valid reserved quantity.`;
      }
      if (reserved > stock) return `Variant ${number}: reserved quantity exceeds stock.`;
      if (!Number.isInteger(threshold) || threshold < 0) {
        return `Variant ${number}: enter a valid low-stock threshold.`;
      }
    }

    return null;
  }

  function buildPayload(uploaded: UploadedProductImage[]): ProductCreateRequest {
    const uploadedById = new Map(uploaded.map((image) => [image.localId, image]));
    const primary = uploadedById.get(primaryImageId);
    if (!primary) throw new Error("Primary image upload is missing.");

    const basePricePaise = toPaise(form.basePriceRupees);

    return {
      collection_id: form.collectionId,
      name: form.name.trim(),
      slug: form.slug,
      short_description: form.shortDescription.trim(),
      description: form.description.trim(),
      base_price_paise: basePricePaise,
      top_material: optionalText(form.topMaterial),
      base_material: optionalText(form.baseMaterial),
      finish: optionalText(form.finish),
      colour: optionalText(form.colour),
      style: optionalText(form.style),
      thumbnail_url: primary.publicUrl,
      is_active: form.isActive,
      is_recommended: form.isRecommended,
      images: images.map((image, index) => {
        const stored = uploadedById.get(image.id);
        if (!stored) throw new Error(`Image ${index + 1} upload is missing.`);
        return {
          image_url: stored.publicUrl,
          alt_text: image.altText.trim(),
          display_order: index,
          is_primary: image.id === primaryImageId,
        };
      }),
      variants: variants.map((variant) => ({
        sku: variant.sku.trim(),
        name: variant.name.trim(),
        size_label: optionalText(variant.sizeLabel),
        colour: optionalText(variant.colour) ?? optionalText(form.colour),
        /*
         * Falls back to the top material, which is the surface a variant is
         * normally described by. Still overridable per variant.
         */
        material:
          optionalText(variant.material) ?? optionalText(form.topMaterial),
        price_paise: variant.priceRupees.trim()
          ? toPaise(variant.priceRupees)
          : basePricePaise,
        length_cm: optionalNumber(variant.lengthCm),
        width_cm: optionalNumber(variant.widthCm),
        height_cm: optionalNumber(variant.heightCm),
        weight_grams: optionalInteger(variant.weightGrams),
        is_active: variant.isActive,
        inventory: {
          quantity_on_hand: Number(variant.quantityOnHand),
          reserved_quantity: Number(variant.reservedQuantity),
          low_stock_threshold: Number(variant.lowStockThreshold),
        },
      })),
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSaving(true);
    setError(null);
    setCreatedProduct(null);
    let uploaded: UploadedProductImage[] = [];

    try {
      setProgress(`Uploading ${images.length} image${images.length === 1 ? "" : "s"}...`);
      uploaded = await uploadProductImages(
        images.map((image) => ({ localId: image.id, file: image.file })),
      );
      setProgress(`Creating ${variants.length} variant${variants.length === 1 ? "" : "s"}...`);
      const product = await createProduct(buildPayload(uploaded));
      setCreatedProduct(product);
      setProgress(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      if (uploaded.length) {
        await removeProductImages(uploaded.map((image) => image.path));
      }
      setError(getErrorMessage(requestError));
      setProgress(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <section className="admin-panel"><p>Loading product form...</p></section>;
  }

  return (
    <section className="admin-new-product-page">
      <div className="admin-section-heading">
        <div>
          <h2>Add product</h2>
          <p>Upload several images and create all product variants with separate stock.</p>
        </div>
        <Link to="/admin/products">Back to products</Link>
      </div>

      {error && <p className="admin-message admin-error" role="alert">{error}</p>}
      {progress && <p className="admin-message admin-upload-progress" role="status">{progress}</p>}

      {createdProduct && (
        <div className="admin-product-created" role="status">
          <div>
            <strong>Product created successfully</strong>
            <p>
              {createdProduct.name} has {createdProduct.images.length} images and{" "}
              {createdProduct.variants.length} variants.
            </p>
          </div>
          <div>
            <Link to={`/products/${createdProduct.slug}`}>View product</Link>
            <Link to="/admin/products">Product list</Link>
          </div>
        </div>
      )}

      {collections.length === 0 ? (
        <section className="admin-panel">
          <h3>No collections available</h3>
          <p>Create a collection before adding a product.</p>
        </section>
      ) : (
        <form className="admin-product-form" onSubmit={handleSubmit}>
          <section className="admin-form-section">
            <div className="admin-form-heading">
              <span>1</span>
              <div>
                <h3>Product information</h3>
                <p>Main information shown in the catalogue.</p>
              </div>
            </div>

            <div className="admin-form-grid">
              <div className="admin-form-field">
                <label htmlFor="product-collection">Collection</label>
                <select
                  id="product-collection"
                  value={form.collectionId}
                  onChange={(event) => updateField("collectionId", event.target.value)}
                  required
                >
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                      {collection.is_active ? "" : " \u2014 inactive"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-form-field">
                <label htmlFor="product-name">Product name</label>
                <input
                  id="product-name"
                  value={form.name}
                  onChange={(event) => handleNameChange(event.target.value)}
                  minLength={2}
                  maxLength={200}
                  required
                />
              </div>

              {/*
                The URL slug is derived from the product name rather than
                typed. It is shown read-only so you can see the address
                the product will get, but there is nothing to fill in.
              */}
              {form.slug && (
                <p className="admin-form-field admin-form-full admin-slug-preview">
                  <span className="admin-slug-preview-label">Page address</span>
                  <span className="admin-slug-preview-value">
                    /products/{form.slug}
                  </span>
                </p>
              )}

              <div className="admin-form-field admin-form-full">
                <label htmlFor="product-short-description">Short description</label>
                <textarea
                  id="product-short-description"
                  value={form.shortDescription}
                  onChange={(event) => updateField("shortDescription", event.target.value)}
                  minLength={10}
                  maxLength={400}
                  rows={3}
                  required
                />
              </div>

              <div className="admin-form-field admin-form-full">
                <label htmlFor="product-description">Full description</label>
                <textarea
                  id="product-description"
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  minLength={20}
                  maxLength={10000}
                  rows={6}
                  required
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="product-price">Base price</label>
                <input
                  id="product-price"
                  type="number"
                  min="0"
                  max={MAX_PRICE_RUPEES}
                  step="0.01"
                  value={form.basePriceRupees}
                  onChange={(event) => updateField("basePriceRupees", event.target.value)}
                  required
                />
                <small>
                  Maximum {formatRupees(MAX_PRICE_RUPEES)}
                </small>
              </div>

              <div className="admin-form-field">
                <label htmlFor="product-top-material">Top material</label>
                <input
                  id="product-top-material"
                  value={form.topMaterial}
                  onChange={(event) => updateField("topMaterial", event.target.value)}
                  placeholder="Italian marble"
                  maxLength={120}
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="product-base-material">Base material</label>
                <input
                  id="product-base-material"
                  value={form.baseMaterial}
                  onChange={(event) => updateField("baseMaterial", event.target.value)}
                  placeholder="Solid brass"
                  maxLength={120}
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="product-finish">Finish</label>
                <input
                  id="product-finish"
                  value={form.finish}
                  onChange={(event) => updateField("finish", event.target.value)}
                  placeholder="Hand-polished satin"
                  maxLength={120}
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="product-colour">Default colour</label>
                <input
                  id="product-colour"
                  value={form.colour}
                  onChange={(event) => updateField("colour", event.target.value)}
                  maxLength={80}
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="product-style">Style</label>
                <input
                  id="product-style"
                  value={form.style}
                  onChange={(event) => updateField("style", event.target.value)}
                  maxLength={100}
                />
              </div>
            </div>

            <div className="admin-form-checkboxes">
              <label>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => updateField("isActive", event.target.checked)}
                />
                Active product
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.isRecommended}
                  onChange={(event) => updateField("isRecommended", event.target.checked)}
                />
                Recommended product
              </label>
            </div>
          </section>

          <section className="admin-form-section">
            <div className="admin-form-heading">
              <span>2</span>
              <div>
                <h3>Product images</h3>
                <p>Select multiple images from your computer. Choose one primary image.</p>
              </div>
            </div>

            <label className="admin-upload-dropzone" htmlFor="product-images">
              <strong>Select images</strong>
              <span>JPG, PNG or WebP. Maximum 5 MB each. {uploadedImageCountText}.</span>
              <input
                id="product-images"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFiles}
                disabled={isSaving}
              />
            </label>

            <div className="admin-local-image-grid">
              {images.map((image, index) => (
                <article className="admin-local-image-card" key={image.id}>
                  <img src={image.previewUrl} alt={image.altText} />
                  <div className="admin-image-card-body">
                    <label className="admin-primary-image-option">
                      <input
                        type="radio"
                        name="primary-image"
                        checked={primaryImageId === image.id}
                        onChange={() => setPrimaryImageId(image.id)}
                      />
                      Primary image
                    </label>
                    <div className="admin-form-field">
                      <label htmlFor={`image-alt-${image.id}`}>Image description</label>
                      <input
                        id={`image-alt-${image.id}`}
                        value={image.altText}
                        onChange={(event) =>
                          setImages((current) =>
                            current.map((item) =>
                              item.id === image.id
                                ? { ...item, altText: event.target.value }
                                : item,
                            ),
                          )
                        }
                        minLength={3}
                        maxLength={250}
                        required
                      />
                    </div>
                    <div className="admin-image-card-actions">
                      <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0 || isSaving}>
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(index, 1)}
                        disabled={index === images.length - 1 || isSaving}
                      >
                        Next
                      </button>
                      <button
                        className="admin-delete-button"
                        type="button"
                        onClick={() => removeImage(image.id)}
                        disabled={isSaving}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-form-section">
            <div className="admin-form-heading admin-form-heading-with-action">
              <span>3</span>
              <div>
                <h3>Variants</h3>
                <p>Add each available size, colour or material option.</p>
              </div>
              <button className="admin-secondary-button" type="button" onClick={addVariant} disabled={isSaving}>
                Add variant
              </button>
            </div>

            <div className="admin-variant-list">
              {variants.map((variant, index) => (
                <article className="admin-variant-card" key={variant.id}>
                  <div className="admin-variant-card-heading">
                    <div>
                      <span>Variant {index + 1}</span>
                      <h4>{variant.name || "Unnamed variant"}</h4>
                    </div>
                    <button
                      className="admin-variant-remove"
                      type="button"
                      onClick={() => removeVariant(variant.id)}
                      disabled={variants.length === 1 || isSaving}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="admin-form-grid">
                    <div className="admin-form-field">
                      <label htmlFor={`sku-${variant.id}`}>SKU</label>
                      <input
                        id={`sku-${variant.id}`}
                        value={variant.sku}
                        onChange={(event) => updateVariant(variant.id, "sku", formatSku(event.target.value))}
                        pattern="[A-Z0-9]+(?:-[A-Z0-9]+)*"
                        minLength={3}
                        maxLength={100}
                        required
                      />
                    </div>
                    <div className="admin-form-field">
                      <label htmlFor={`name-${variant.id}`}>Variant name</label>
                      <input
                        id={`name-${variant.id}`}
                        value={variant.name}
                        onChange={(event) => updateVariant(variant.id, "name", event.target.value)}
                        maxLength={150}
                        required
                      />
                    </div>
                    <div className="admin-form-field">
                      <label htmlFor={`size-${variant.id}`}>Size label</label>
                      <input
                        id={`size-${variant.id}`}
                        value={variant.sizeLabel}
                        onChange={(event) => updateVariant(variant.id, "sizeLabel", event.target.value)}
                        placeholder={"90 \u00D7 120 cm"}
                        maxLength={100}
                      />
                    </div>
                    <div className="admin-form-field">
                      <label htmlFor={`price-${variant.id}`}>Price</label>
                      <input
                        id={`price-${variant.id}`}
                        type="number"
                        min="0"
                         max={MAX_PRICE_RUPEES}
                        step="0.01"
                        value={variant.priceRupees}
                        onChange={(event) => updateVariant(variant.id, "priceRupees", event.target.value)}
                        placeholder="Uses base price"
                      />
                    </div>
                    <div className="admin-form-field">
                      <label htmlFor={`colour-${variant.id}`}>Colour</label>
                      <input
                        id={`colour-${variant.id}`}
                        value={variant.colour}
                        onChange={(event) => updateVariant(variant.id, "colour", event.target.value)}
                        placeholder="Uses product colour"
                        maxLength={80}
                      />
                    </div>
                    <div className="admin-form-field">
                      <label htmlFor={`material-${variant.id}`}>Material</label>
                      <input
                        id={`material-${variant.id}`}
                        value={variant.material}
                        onChange={(event) => updateVariant(variant.id, "material", event.target.value)}
                        placeholder="Uses the top material"
                        maxLength={120}
                      />
                    </div>
                    <div className="admin-form-field">
                      <label htmlFor={`length-${variant.id}`}>Length (cm)</label>
                      <input
                        id={`length-${variant.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={variant.lengthCm}
                        onChange={(event) => updateVariant(variant.id, "lengthCm", event.target.value)}
                      />
                    </div>
                    <div className="admin-form-field">
                      <label htmlFor={`width-${variant.id}`}>Width (cm)</label>
                      <input
                        id={`width-${variant.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={variant.widthCm}
                        onChange={(event) => updateVariant(variant.id, "widthCm", event.target.value)}
                      />
                    </div>
                    <div className="admin-form-field">
                      <label htmlFor={`height-${variant.id}`}>Height (cm)</label>
                      <input
                        id={`height-${variant.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={variant.heightCm}
                        onChange={(event) => updateVariant(variant.id, "heightCm", event.target.value)}
                      />
                    </div>
                    <div className="admin-form-field">
                      <label htmlFor={`weight-${variant.id}`}>Weight (grams)</label>
                      <input
                        id={`weight-${variant.id}`}
                        type="number"
                        min="0"
                        step="1"
                        value={variant.weightGrams}
                        onChange={(event) => updateVariant(variant.id, "weightGrams", event.target.value)}
                      />
                    </div>
                    <div className="admin-form-field">
                      <label htmlFor={`stock-${variant.id}`}>Quantity on hand</label>
                      <input
                        id={`stock-${variant.id}`}
                        type="number"
                        min="0"
                        step="1"
                        value={variant.quantityOnHand}
                        onChange={(event) => updateVariant(variant.id, "quantityOnHand", event.target.value)}
                        required
                      />
                    </div>
                    <div className="admin-form-field">
                      <label htmlFor={`reserved-${variant.id}`}>Reserved quantity</label>
                      <input
                        id={`reserved-${variant.id}`}
                        type="number"
                        min="0"
                        step="1"
                        value={variant.reservedQuantity}
                        onChange={(event) => updateVariant(variant.id, "reservedQuantity", event.target.value)}
                        required
                      />
                    </div>
                    <div className="admin-form-field">
                      <label htmlFor={`threshold-${variant.id}`}>Low-stock threshold</label>
                      <input
                        id={`threshold-${variant.id}`}
                        type="number"
                        min="0"
                        step="1"
                        value={variant.lowStockThreshold}
                        onChange={(event) => updateVariant(variant.id, "lowStockThreshold", event.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <label className="admin-variant-active-option">
                    <input
                      type="checkbox"
                      checked={variant.isActive}
                      onChange={(event) => updateVariant(variant.id, "isActive", event.target.checked)}
                    />
                    Active variant
                  </label>
                </article>
              ))}
            </div>

            <button className="admin-add-another-variant" type="button" onClick={addVariant} disabled={isSaving}>
              + Add another variant
            </button>
          </section>

          <div className="admin-product-form-actions">
            <button className="admin-primary-button" type="submit" disabled={isSaving}>
              {isSaving ? progress ?? "Creating product..." : "Create product"}
            </button>
            <Link to="/admin/products">Cancel</Link>
          </div>
        </form>
      )}
    </section>
  );
}

export default AdminNewProductPage;