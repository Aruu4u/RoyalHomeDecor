import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  ChangeEvent,
  FormEvent,
} from "react";

import {
  removeCollectionHeroImage,
  uploadCollectionHeroImage,
} from "../services/collectionImages";
import {
  createCollection,
  deleteCollection,
  getAdminCollections,
  updateCollection,
} from "../services/collections";
import {
  getAdminProducts,
} from "../services/products";
import type {
  Collection,
  CollectionCreateRequest,
  CollectionUpdateRequest,
} from "../types/collection";
import type {
  Product,
} from "../types/product";

const MAX_IMAGE_SIZE =
  5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

interface CollectionDraft {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  displayOrder: string;
  isActive: boolean;

  heroFile: File | null;
  heroPreviewUrl: string | null;
  removeHeroImage: boolean;
}

function createEmptyDraft(): CollectionDraft {
  return {
    name: "",
    slug: "",
    shortDescription: "",
    description: "",
    displayOrder: "0",
    isActive: true,

    heroFile: null,
    heroPreviewUrl: null,
    removeHeroImage: false,
  };
}

function createDraftFromCollection(
  collection: Collection,
): CollectionDraft {
  return {
    name: collection.name,
    slug: collection.slug,

    shortDescription:
      collection.short_description ?? "",

    description:
      collection.description ?? "",

    displayOrder:
      collection.display_order.toString(),

    isActive:
      collection.is_active,

    heroFile: null,

    heroPreviewUrl:
      collection.hero_image_url,

    removeHeroImage: false,
  };
}

/*
 * Builds a URL slug from a collection name.
 *
 * Must satisfy the backend rule ^[a-z0-9]+(?:-[a-z0-9]+)*$ and fit the
 * 120-character column. Accents are folded to their base letter so a
 * name like "Décor" yields "decor" rather than losing the character.
 */
function createSlug(
  value: string,
): string {
  const slug = value
    .normalize("NFD")
    /* Strip the combining accent marks NFD leaves behind. */
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  /* Trim to a safe length without leaving a trailing hyphen. */
  return slug.slice(0, 110).replace(/-$/, "");
}

function optionalText(
  value: string,
): string | null {
  const trimmed = value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
}

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Unable to complete the collection request.";
}

function validateImage(
  file: File,
): string | null {
  if (
    !ALLOWED_IMAGE_TYPES.has(
      file.type,
    )
  ) {
    return "Collection image must be a JPG, PNG or WebP file.";
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return "Collection image must be smaller than 5 MB.";
  }

  return null;
}

function validateDraft(
  draft: CollectionDraft,
): string | null {
  if (
    draft.name.trim().length < 2
  ) {
    return "Collection name must contain at least 2 characters.";
  }

  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      draft.slug,
    )
  ) {
    return "Collection slug can contain lowercase letters, numbers and hyphens only.";
  }

  if (
    draft.shortDescription.trim() &&
    draft.shortDescription
      .trim()
      .length < 3
  ) {
    return "Short description must contain at least 3 characters.";
  }

  if (
    draft.description.trim() &&
    draft.description
      .trim()
      .length < 10
  ) {
    return "Full description must contain at least 10 characters.";
  }

  const displayOrder = Number(
    draft.displayOrder,
  );

  if (
    !Number.isInteger(displayOrder) ||
    displayOrder < 0
  ) {
    return "Display order must be a non-negative whole number.";
  }

  return null;
}

function AdminCollectionsPage() {
  const [collections, setCollections] =
    useState<Collection[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [drafts, setDrafts] =
    useState<
      Record<string, CollectionDraft>
    >({});

  const [newDraft, setNewDraft] =
    useState<CollectionDraft>(
      createEmptyDraft(),
    );

  const [isLoading, setIsLoading] =
    useState(true);

  const [busyId, setBusyId] =
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

    async function loadPage(): Promise<void> {
      try {
        const [
          collectionData,
          productData,
        ] = await Promise.all([
          getAdminCollections(
            controller.signal,
          ),

          getAdminProducts(
            controller.signal,
          ),
        ]);

        if (!isActive) {
          return;
        }

        const loadedDrafts:
          Record<
            string,
            CollectionDraft
          > = {};

        collectionData.forEach(
          (collection) => {
            loadedDrafts[
              collection.id
            ] =
              createDraftFromCollection(
                collection,
              );
          },
        );

        setCollections(collectionData);
        setProducts(productData);
        setDrafts(loadedDrafts);
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
  }, []);

  const productCounts = useMemo(() => {
    const counts =
      new Map<string, number>();

    products.forEach((product) => {
      counts.set(
        product.collection_id,
        (counts.get(
          product.collection_id,
        ) ?? 0) + 1,
      );
    });

    return counts;
  }, [products]);

  const sortedCollections = useMemo(
    () =>
      [...collections].sort(
        (first, second) =>
          first.display_order -
          second.display_order,
      ),
    [collections],
  );

  function beginRequest(): void {
    setError(null);
    setSuccessMessage(null);
  }

  function updateNewField<
    Field extends keyof CollectionDraft,
  >(
    field: Field,
    value: CollectionDraft[Field],
  ): void {
    setNewDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateDraftField<
    Field extends keyof CollectionDraft,
  >(
    collectionId: string,
    field: Field,
    value: CollectionDraft[Field],
  ): void {
    setDrafts((current) => ({
      ...current,

      [collectionId]: {
        ...current[collectionId],
        [field]: value,
      },
    }));
  }

  /*
   * The slug always follows the name on a new collection. The previous
   * conditional existed to protect a hand-typed slug, which no longer
   * applies now that the field is not editable.
   */
  function handleNewNameChange(
    value: string,
  ): void {
    setNewDraft((current) => ({
      ...current,
      name: value,
      slug: createSlug(value),
    }));
  }

  function createPreviewUrl(
    file: File,
  ): string {
    return URL.createObjectURL(file);
  }

  function handleNewImage(
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    const file =
      event.currentTarget.files?.[0];

    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    const validationError =
      validateImage(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (
      newDraft.heroPreviewUrl?.startsWith(
        "blob:",
      )
    ) {
      URL.revokeObjectURL(
        newDraft.heroPreviewUrl,
      );
    }

    setNewDraft((current) => ({
      ...current,
      heroFile: file,
      heroPreviewUrl:
        createPreviewUrl(file),
      removeHeroImage: false,
    }));
  }

  function handleExistingImage(
    collectionId: string,
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    const file =
      event.currentTarget.files?.[0];

    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    const validationError =
      validateImage(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    const currentDraft =
      drafts[collectionId];

    if (
      currentDraft?.heroPreviewUrl
        ?.startsWith("blob:")
    ) {
      URL.revokeObjectURL(
        currentDraft.heroPreviewUrl,
      );
    }

    updateDraftField(
      collectionId,
      "heroFile",
      file,
    );

    updateDraftField(
      collectionId,
      "heroPreviewUrl",
      createPreviewUrl(file),
    );

    updateDraftField(
      collectionId,
      "removeHeroImage",
      false,
    );
  }

  function resetExistingImage(
    collection: Collection,
  ): void {
    const currentDraft =
      drafts[collection.id];

    if (
      currentDraft?.heroPreviewUrl
        ?.startsWith("blob:")
    ) {
      URL.revokeObjectURL(
        currentDraft.heroPreviewUrl,
      );
    }

    setDrafts((current) => ({
      ...current,

      [collection.id]: {
        ...current[collection.id],
        heroFile: null,

        heroPreviewUrl:
          collection.hero_image_url,

        removeHeroImage: false,
      },
    }));
  }

  function markImageForRemoval(
    collectionId: string,
  ): void {
    const currentDraft =
      drafts[collectionId];

    if (
      currentDraft?.heroPreviewUrl
        ?.startsWith("blob:")
    ) {
      URL.revokeObjectURL(
        currentDraft.heroPreviewUrl,
      );
    }

    setDrafts((current) => ({
      ...current,

      [collectionId]: {
        ...current[collectionId],
        heroFile: null,
        heroPreviewUrl: null,
        removeHeroImage: true,
      },
    }));
  }

  async function handleCreateCollection(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const validationError =
      validateDraft(newDraft);

    if (validationError) {
      setError(validationError);
      return;
    }

    beginRequest();
    setBusyId("new");

    let uploadedImage:
      Awaited<
        ReturnType<
          typeof uploadCollectionHeroImage
        >
      > | null = null;

    try {
      if (newDraft.heroFile) {
        uploadedImage =
          await uploadCollectionHeroImage(
            newDraft.heroFile,
          );
      }

      const payload:
        CollectionCreateRequest = {
          name:
            newDraft.name.trim(),

          slug:
            newDraft.slug.trim(),

          short_description:
            optionalText(
              newDraft.shortDescription,
            ),

          description:
            optionalText(
              newDraft.description,
            ),

          hero_image_url:
            uploadedImage?.publicUrl ??
            null,

          display_order:
            Number(
              newDraft.displayOrder,
            ),

          is_active:
            newDraft.isActive,
        };

      const createdCollection =
        await createCollection(
          payload,
        );

      setCollections((current) => [
        ...current,
        createdCollection,
      ]);

      setDrafts((current) => ({
        ...current,

        [createdCollection.id]:
          createDraftFromCollection(
            createdCollection,
          ),
      }));

      if (
        newDraft.heroPreviewUrl
          ?.startsWith("blob:")
      ) {
        URL.revokeObjectURL(
          newDraft.heroPreviewUrl,
        );
      }

      setNewDraft(
        createEmptyDraft(),
      );

      setSuccessMessage(
        `${createdCollection.name} was created.`,
      );
    } catch (requestError) {
      if (uploadedImage) {
        await removeCollectionHeroImage(
          uploadedImage.publicUrl,
        );
      }

      setError(
        getErrorMessage(
          requestError,
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveCollection(
    collection: Collection,
  ): Promise<void> {
    const draft =
      drafts[collection.id];

    if (!draft) {
      return;
    }

    const validationError =
      validateDraft(draft);

    if (validationError) {
      setError(validationError);
      return;
    }

    beginRequest();
    setBusyId(collection.id);

    let uploadedImage:
      Awaited<
        ReturnType<
          typeof uploadCollectionHeroImage
        >
      > | null = null;

    try {
      if (draft.heroFile) {
        uploadedImage =
          await uploadCollectionHeroImage(
            draft.heroFile,
          );
      }

      const finalHeroUrl =
        uploadedImage?.publicUrl ??
        (draft.removeHeroImage
          ? null
          : collection.hero_image_url);

      const payload:
        CollectionUpdateRequest = {
          name:
            draft.name.trim(),

          slug:
            draft.slug.trim(),

          short_description:
            optionalText(
              draft.shortDescription,
            ),

          description:
            optionalText(
              draft.description,
            ),

          hero_image_url:
            finalHeroUrl,

          display_order:
            Number(
              draft.displayOrder,
            ),

          is_active:
            draft.isActive,
        };

      const updatedCollection =
        await updateCollection(
          collection.id,
          payload,
        );

      if (
        collection.hero_image_url &&
        (
          uploadedImage ||
          draft.removeHeroImage
        )
      ) {
        await removeCollectionHeroImage(
          collection.hero_image_url,
        );
      }

      setCollections((current) =>
        current.map((item) =>
          item.id === collection.id
            ? updatedCollection
            : item,
        ),
      );

      setDrafts((current) => ({
        ...current,

        [collection.id]:
          createDraftFromCollection(
            updatedCollection,
          ),
      }));

      setSuccessMessage(
        `${updatedCollection.name} was updated.`,
      );
    } catch (requestError) {
      if (uploadedImage) {
        await removeCollectionHeroImage(
          uploadedImage.publicUrl,
        );
      }

      setError(
        getErrorMessage(
          requestError,
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteCollection(
    collection: Collection,
  ): Promise<void> {
    const productCount =
      productCounts.get(
        collection.id,
      ) ?? 0;

    if (productCount > 0) {
      setError(
        `Move or delete the ${productCount} product${
          productCount === 1
            ? ""
            : "s"
        } in this collection first.`,
      );

      return;
    }

    const shouldDelete =
      window.confirm(
        `Delete collection "${collection.name}"?`,
      );

    if (!shouldDelete) {
      return;
    }

    beginRequest();
    setBusyId(collection.id);

    try {
      await deleteCollection(
        collection.id,
      );

      if (
        collection.hero_image_url
      ) {
        await removeCollectionHeroImage(
          collection.hero_image_url,
        );
      }

      setCollections((current) =>
        current.filter(
          (item) =>
            item.id !== collection.id,
        ),
      );

      setDrafts((current) => {
        const next = {
          ...current,
        };

        delete next[collection.id];

        return next;
      });

      setSuccessMessage(
        `${collection.name} was deleted.`,
      );
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return (
      <section
        aria-live="polite"
        className="admin-panel"
      >
        <p>Loading collections...</p>
      </section>
    );
  }

  return (
    <section className="admin-collections-page">
      <div className="admin-section-heading">
        <div>
          <h2>Collections</h2>

          <p>
            Manage the collection groups
            displayed throughout the store.
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

      <form
        className="admin-form-section admin-collection-create"
        onSubmit={
          handleCreateCollection
        }
      >
        <div className="admin-form-heading">
          <span>+</span>

          <div>
            <h3>Create collection</h3>

            <p>
              Add a new collection and its
              optional hero image.
            </p>
          </div>
        </div>

        <div className="admin-form-grid">
          <div className="admin-form-field">
            <label htmlFor="new-collection-name">
              Name
            </label>

            <input
              id="new-collection-name"
              maxLength={150}
              minLength={2}
              onChange={(event) =>
                handleNewNameChange(
                  event.target.value,
                )
              }
              required
              value={newDraft.name}
            />
          </div>

          {/* Derived from the collection name; shown for reference only. */}
          {newDraft.slug && (
            <p className="admin-form-field admin-slug-preview">
              <span className="admin-slug-preview-label">Page address</span>

              <span className="admin-slug-preview-value">
                /collections/{newDraft.slug}
              </span>
            </p>
          )}

          <div className="admin-form-field admin-form-full">
            <label htmlFor="new-collection-short-description">
              Short description
            </label>

            <textarea
              id="new-collection-short-description"
              maxLength={400}
              onChange={(event) =>
                updateNewField(
                  "shortDescription",
                  event.target.value,
                )
              }
              rows={2}
              value={
                newDraft.shortDescription
              }
            />
          </div>

          <div className="admin-form-field admin-form-full">
            <label htmlFor="new-collection-description">
              Full description
            </label>

            <textarea
              id="new-collection-description"
              maxLength={5000}
              onChange={(event) =>
                updateNewField(
                  "description",
                  event.target.value,
                )
              }
              rows={4}
              value={
                newDraft.description
              }
            />
          </div>

          <div className="admin-form-field">
            <label htmlFor="new-collection-order">
              Display order
            </label>

            <input
              id="new-collection-order"
              min="0"
              onChange={(event) =>
                updateNewField(
                  "displayOrder",
                  event.target.value,
                )
              }
              required
              step="1"
              type="number"
              value={
                newDraft.displayOrder
              }
            />
          </div>

          <div className="admin-form-field">
            <label htmlFor="new-collection-image">
              Hero image
            </label>

            <input
              accept="image/jpeg,image/png,image/webp"
              id="new-collection-image"
              onChange={handleNewImage}
              type="file"
            />

            <small>
              JPG, PNG or WebP. Maximum
              5 MB.
            </small>
          </div>
        </div>

        {newDraft.heroPreviewUrl && (
          <div className="admin-collection-image-preview">
            <img
              alt="New collection preview"
              src={
                newDraft.heroPreviewUrl
              }
            />

            <button
              onClick={() => {
                if (
                  newDraft.heroPreviewUrl
                    ?.startsWith("blob:")
                ) {
                  URL.revokeObjectURL(
                    newDraft.heroPreviewUrl,
                  );
                }

                setNewDraft(
                  (current) => ({
                    ...current,
                    heroFile: null,
                    heroPreviewUrl: null,
                  }),
                );
              }}
              type="button"
            >
              Remove selected image
            </button>
          </div>
        )}

        <div className="admin-form-checkboxes">
          <label>
            <input
              checked={
                newDraft.isActive
              }
              onChange={(event) =>
                updateNewField(
                  "isActive",
                  event.target.checked,
                )
              }
              type="checkbox"
            />

            Active collection
          </label>
        </div>

        <div className="admin-collection-form-actions">
          <button
            className="admin-primary-button"
            disabled={
              busyId === "new"
            }
            type="submit"
          >
            {busyId === "new"
              ? "Creating..."
              : "Create collection"}
          </button>
        </div>
      </form>

      <div className="admin-collection-list">
        {sortedCollections.map(
          (collection) => {
            const draft =
              drafts[collection.id];

            if (!draft) {
              return null;
            }

            const productCount =
              productCounts.get(
                collection.id,
              ) ?? 0;

            const isBusy =
              busyId === collection.id;

            return (
              <article
                className="admin-collection-card"
                key={collection.id}
              >
                <div className="admin-collection-card-heading">
                  <div>
                    <span>
                      {productCount} product
                      {productCount === 1
                        ? ""
                        : "s"}
                    </span>

                    <h3>
                      {collection.name}
                    </h3>
                  </div>

                  <span
                    className={
                      collection.is_active
                        ? "admin-product-badge active"
                        : "admin-product-badge inactive"
                    }
                  >
                    {collection.is_active
                      ? "Active"
                      : "Inactive"}
                  </span>
                </div>

                <div className="admin-form-grid">
                  <div className="admin-form-field">
                    <label
                      htmlFor={`collection-name-${collection.id}`}
                    >
                      Name
                    </label>

                    <input
                      id={`collection-name-${collection.id}`}
                      onChange={(event) =>
                        updateDraftField(
                          collection.id,
                          "name",
                          event.target.value,
                        )
                      }
                      value={draft.name}
                    />
                  </div>

                  {/*
                    Frozen on an existing collection. Renaming it keeps the
                    original address so shared and indexed links, and the
                    custom image filename in public/images/collections,
                    all continue to match.
                  */}
                  <p className="admin-form-field admin-slug-preview">
                    <span className="admin-slug-preview-label">
                      Page address
                    </span>

                    <span className="admin-slug-preview-value">
                      /collections/{draft.slug}
                    </span>
                  </p>

                  <div className="admin-form-field admin-form-full">
                    <label
                      htmlFor={`collection-short-${collection.id}`}
                    >
                      Short description
                    </label>

                    <textarea
                      id={`collection-short-${collection.id}`}
                      onChange={(event) =>
                        updateDraftField(
                          collection.id,
                          "shortDescription",
                          event.target.value,
                        )
                      }
                      rows={2}
                      value={
                        draft.shortDescription
                      }
                    />
                  </div>

                  <div className="admin-form-field admin-form-full">
                    <label
                      htmlFor={`collection-description-${collection.id}`}
                    >
                      Full description
                    </label>

                    <textarea
                      id={`collection-description-${collection.id}`}
                      onChange={(event) =>
                        updateDraftField(
                          collection.id,
                          "description",
                          event.target.value,
                        )
                      }
                      rows={4}
                      value={
                        draft.description
                      }
                    />
                  </div>

                  <div className="admin-form-field">
                    <label
                      htmlFor={`collection-order-${collection.id}`}
                    >
                      Display order
                    </label>

                    <input
                      id={`collection-order-${collection.id}`}
                      min="0"
                      onChange={(event) =>
                        updateDraftField(
                          collection.id,
                          "displayOrder",
                          event.target.value,
                        )
                      }
                      step="1"
                      type="number"
                      value={
                        draft.displayOrder
                      }
                    />
                  </div>

                  <div className="admin-form-field">
                    <label
                      htmlFor={`collection-image-${collection.id}`}
                    >
                      Replace hero image
                    </label>

                    <input
                      accept="image/jpeg,image/png,image/webp"
                      id={`collection-image-${collection.id}`}
                      onChange={(event) =>
                        handleExistingImage(
                          collection.id,
                          event,
                        )
                      }
                      type="file"
                    />
                  </div>
                </div>

                {draft.heroPreviewUrl ? (
                  <div className="admin-collection-image-preview">
                    <img
                      alt={`${draft.name} collection`}
                      src={
                        draft.heroPreviewUrl
                      }
                    />

                    <div>
                      {draft.heroFile && (
                        <button
                          onClick={() =>
                            resetExistingImage(
                              collection,
                            )
                          }
                          type="button"
                        >
                          Cancel new image
                        </button>
                      )}

                      <button
                        onClick={() =>
                          markImageForRemoval(
                            collection.id,
                          )
                        }
                        type="button"
                      >
                        Remove hero image
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="admin-collection-no-image">
                    No hero image selected.
                  </p>
                )}

                <div className="admin-form-checkboxes">
                  <label>
                    <input
                      checked={
                        draft.isActive
                      }
                      onChange={(event) =>
                        updateDraftField(
                          collection.id,
                          "isActive",
                          event.target.checked,
                        )
                      }
                      type="checkbox"
                    />

                    Active collection
                  </label>
                </div>

                <div className="admin-collection-card-actions">
                  <button
                    className="admin-primary-button"
                    disabled={isBusy}
                    onClick={() =>
                      void handleSaveCollection(
                        collection,
                      )
                    }
                    type="button"
                  >
                    {isBusy
                      ? "Saving..."
                      : "Save collection"}
                  </button>

                  <button
                    className="admin-delete-button"
                    disabled={
                      isBusy ||
                      productCount > 0
                    }
                    onClick={() =>
                      void handleDeleteCollection(
                        collection,
                      )
                    }
                    title={
                      productCount > 0
                        ? "Move or delete this collection's products first."
                        : "Delete collection"
                    }
                    type="button"
                  >
                    Delete collection
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

export default AdminCollectionsPage;