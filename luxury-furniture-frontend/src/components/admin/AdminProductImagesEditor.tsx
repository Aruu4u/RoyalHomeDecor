import {
  useMemo,
  useState,
} from "react";
import type {
  ChangeEvent,
} from "react";

import {
  addProductImage,
  deleteProductImage,
  updateProductImage,
} from "../../services/productManagement";
import {
  getProductImageStoragePath,
  removeProductImages,
  uploadProductImages,
} from "../../services/productImages";
import {
  updateProduct,
} from "../../services/products";
import type {
  ProductDetails,
  ProductImage,
} from "../../types/product";

const MAX_IMAGES = 20;

const MAX_IMAGE_SIZE =
  5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

interface AdminProductImagesEditorProps {
  product: ProductDetails;
  onChanged: () => Promise<void>;
}

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Unable to update product images.";
}

function validateFile(
  file: File,
): string | null {
  if (
    !ALLOWED_IMAGE_TYPES.has(
      file.type,
    )
  ) {
    return `${file.name} must be a JPG, PNG or WebP image.`;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return `${file.name} must be smaller than 5 MB.`;
  }

  return null;
}

export function AdminProductImagesEditor({
  product,
  onChanged,
}: AdminProductImagesEditorProps) {
  const [altTexts, setAltTexts] =
    useState<Record<string, string>>(
      {},
    );

  const [busyImageId, setBusyImageId] =
    useState<string | null>(null);

  const [isUploading, setIsUploading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(
    null,
  );



  const sortedImages = useMemo(
    () =>
      [...product.images].sort(
        (firstImage, secondImage) =>
          firstImage.display_order -
          secondImage.display_order,
      ),
    [product.images],
  );

  function beginRequest(): void {
    setError(null);
    setSuccessMessage(null);
  }

  async function handleAddImages(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const files = Array.from(
      event.currentTarget.files ?? [],
    );

    event.currentTarget.value = "";

    if (files.length === 0) {
      return;
    }

    if (
      product.images.length +
        files.length >
      MAX_IMAGES
    ) {
      setError(
        `A product can contain a maximum of ${MAX_IMAGES} images.`,
      );
      return;
    }

    for (const file of files) {
      const validationError =
        validateFile(file);

      if (validationError) {
        setError(validationError);
        return;
      }
    }

    beginRequest();
    setIsUploading(true);

    const uploadInputs = files.map(
      (file) => ({
        localId: crypto.randomUUID(),
        file,
      }),
    );

    let uploaded:
      Awaited<
        ReturnType<
          typeof uploadProductImages
        >
      > = [];

    let addedImageCount = 0;

    try {
      uploaded =
        await uploadProductImages(
          uploadInputs,
        );

      const highestDisplayOrder =
        product.images.reduce(
          (highest, image) =>
            Math.max(
              highest,
              image.display_order,
            ),
          -1,
        );

      for (
        let index = 0;
        index < uploaded.length;
        index += 1
      ) {
        const uploadedImage =
          uploaded[index];

        await addProductImage(
          product.id,
          {
            image_url:
              uploadedImage.publicUrl,

            alt_text:
              `${product.name} image ${
                product.images.length +
                index +
                1
              }`,

            display_order:
              highestDisplayOrder +
              index +
              1,

            is_primary: false,
          },
        );

        addedImageCount += 1;
      }

      await onChanged();

      setSuccessMessage(
        `${files.length} image${
          files.length === 1
            ? ""
            : "s"
        } added successfully.`,
      );
    } catch (requestError) {
      const unusedUploads =
        uploaded.slice(
          addedImageCount,
        );

      if (
        unusedUploads.length > 0
      ) {
        await removeProductImages(
          unusedUploads.map(
            (image) => image.path,
          ),
        );
      }

      setError(
        getErrorMessage(
          requestError,
        ),
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSaveAltText(
    image: ProductImage,
  ): Promise<void> {
    const nextAltText = (
  altTexts[image.id] ??
  image.alt_text ??
  product.name
).trim();

    if (nextAltText.length < 3) {
      setError(
        "Image description must contain at least 3 characters.",
      );
      return;
    }

    beginRequest();
    setBusyImageId(image.id);

    try {
      await updateProductImage(
        image.id,
        {
          alt_text: nextAltText,
        },
      );

      await onChanged();

      setSuccessMessage(
        "Image description updated.",
      );
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
        ),
      );
    } finally {
      setBusyImageId(null);
    }
  }

  async function handleMakePrimary(
    image: ProductImage,
  ): Promise<void> {
    if (image.is_primary) {
      return;
    }

    beginRequest();
    setBusyImageId(image.id);

    try {
      await updateProductImage(
        image.id,
        {
          is_primary: true,
        },
      );

      await updateProduct(
        product.id,
        {
          thumbnail_url:
            image.image_url,
        },
      );

      await onChanged();

      setSuccessMessage(
        "Primary image updated.",
      );
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
        ),
      );
    } finally {
      setBusyImageId(null);
    }
  }

  async function handleReplaceImage(
    image: ProductImage,
    file: File,
  ): Promise<void> {
    const validationError =
      validateFile(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    beginRequest();
    setBusyImageId(image.id);

    let uploaded:
      Awaited<
        ReturnType<
          typeof uploadProductImages
        >
      > = [];

    try {
      uploaded =
        await uploadProductImages([
          {
            localId: image.id,
            file,
          },
        ]);

      const replacement =
        uploaded[0];

      if (!replacement) {
        throw new Error(
          "Replacement image upload failed.",
        );
      }

      await updateProductImage(
        image.id,
        {
          image_url:
            replacement.publicUrl,
        },
      );

      if (image.is_primary) {
        await updateProduct(
          product.id,
          {
            thumbnail_url:
              replacement.publicUrl,
          },
        );
      }

      const oldStoragePath =
        getProductImageStoragePath(
          image.image_url,
        );

      if (oldStoragePath) {
        await removeProductImages([
          oldStoragePath,
        ]);
      }

      await onChanged();

      setSuccessMessage(
        "Product image replaced.",
      );
    } catch (requestError) {
      if (uploaded[0]) {
        await removeProductImages([
          uploaded[0].path,
        ]);
      }

      setError(
        getErrorMessage(
          requestError,
        ),
      );
    } finally {
      setBusyImageId(null);
    }
  }

  async function handleDeleteImage(
    image: ProductImage,
  ): Promise<void> {
    if (image.is_primary) {
      setError(
        "Choose another primary image before deleting this image.",
      );
      return;
    }

    if (product.images.length === 1) {
      setError(
        "A product must keep at least one image.",
      );
      return;
    }

    const shouldDelete =
      window.confirm(
        "Delete this product image?",
      );

    if (!shouldDelete) {
      return;
    }

    beginRequest();
    setBusyImageId(image.id);

    try {
      await deleteProductImage(
        image.id,
      );

      const storagePath =
        getProductImageStoragePath(
          image.image_url,
        );

      if (storagePath) {
        await removeProductImages([
          storagePath,
        ]);
      }

      await onChanged();

      setSuccessMessage(
        "Product image deleted.",
      );
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
        ),
      );
    } finally {
      setBusyImageId(null);
    }
  }

  return (
    <section className="admin-form-section">
      <div className="admin-form-heading">
        <span>2</span>

        <div>
          <h3>Product images</h3>

          <p>
            Add, replace, describe,
            delete or select the primary
            product image.
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

      <label
        className="admin-upload-dropzone"
        htmlFor="edit-product-images"
      >
        <strong>
          Add product images
        </strong>

        <span>
          JPG, PNG or WebP. Maximum
          5 MB each. {product.images.length}
          /{MAX_IMAGES} images.
        </span>

        <input
          accept="image/jpeg,image/png,image/webp"
          disabled={isUploading}
          id="edit-product-images"
          multiple
          onChange={(event) =>
            void handleAddImages(
              event,
            )
          }
          type="file"
        />
      </label>

      {isUploading && (
        <p
          className="admin-message admin-upload-progress"
          role="status"
        >
          Uploading images...
        </p>
      )}

      <div className="admin-existing-image-grid">
        {sortedImages.map(
          (image) => {
            const isBusy =
              busyImageId ===
              image.id;

            return (
              <article
                className="admin-existing-image-card"
                key={image.id}
              >
                <img
                  alt={
                    image.alt_text ??
                    product.name
                  }
                  src={image.image_url}
                />

                <div className="admin-image-card-body">
                  <strong>
                    {image.is_primary
                      ? "Primary image"
                      : `Image ${
                          image.display_order +
                          1
                        }`}
                  </strong>

                  <div className="admin-form-field">
                    <label
                      htmlFor={`edit-image-alt-${image.id}`}
                    >
                      Image description
                    </label>

                    <input
                      id={`edit-image-alt-${image.id}`}
                      maxLength={250}
                      minLength={3}
                      onChange={(
                        event,
                      ) =>
                        setAltTexts(
                          (
                            current,
                          ) => ({
                            ...current,
                            [image.id]:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      type="text"
                      value={
  altTexts[image.id] ??
  image.alt_text ??
  product.name
}
                    />
                  </div>

                  <div className="admin-edit-image-actions">
                    <button
                      disabled={isBusy}
                      onClick={() =>
                        void handleSaveAltText(
                          image,
                        )
                      }
                      type="button"
                    >
                      Save description
                    </button>

                    <button
                      disabled={
                        isBusy ||
                        image.is_primary
                      }
                      onClick={() =>
                        void handleMakePrimary(
                          image,
                        )
                      }
                      type="button"
                    >
                      {image.is_primary
                        ? "Current primary"
                        : "Make primary"}
                    </button>

                    <label className="admin-file-action">
                      Replace image

                      <input
                        accept="image/jpeg,image/png,image/webp"
                        disabled={isBusy}
                        onChange={(
                          event,
                        ) => {
                          const file =
                            event
                              .currentTarget
                              .files?.[0];

                          event.currentTarget.value =
                            "";

                          if (file) {
                            void handleReplaceImage(
                              image,
                              file,
                            );
                          }
                        }}
                        type="file"
                      />
                    </label>

                    <button
                      className="admin-delete-button"
                      disabled={
                        isBusy ||
                        image.is_primary ||
                        product.images
                          .length === 1
                      }
                      onClick={() =>
                        void handleDeleteImage(
                          image,
                        )
                      }
                      type="button"
                    >
                      Delete
                    </button>
                  </div>

                  {isBusy && (
                    <small>
                      Saving image...
                    </small>
                  )}
                </div>
              </article>
            );
          },
        )}
      </div>
    </section>
  );
}