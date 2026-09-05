import { useCallback, useMemo, useState } from "react";

import { useAsync } from "../hooks/useAsync";
import { formatPrice } from "../lib/currency";
import { friendlyMessage } from "../lib/errors";
import { applyPercent } from "../lib/pricing";
import { loadProducts } from "../services/catalogueCache";
import { offerService } from "../services/offers";
import ImageDropzone from "../components/admin/ImageDropzone";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import {
  describeOfferEnd,
  durationChoiceToDays,
  OFFER_DURATION_PRESETS,
} from "../lib/offerTime";
import { uploadOfferBackgroundImage } from "../services/offerImages";
import {
  normaliseTheme,
  THEME_SUGGESTIONS,
  type OfferSection,
  type ProductOfferStatus,
} from "../types/offer";
import type { Product } from "../types/product";

const MIN_PERCENT = 1;
const MAX_PERCENT = 90;

interface SectionDraft {
  title: string;
  slug: string;
  subtitle: string;

  /** Free text; normalised to a key on save. */
  theme: string;
  backgroundImageUrl: string;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  badgeLabel: string;
  displayOrder: string;
  isActive: boolean;
}

function emptyDraft(): SectionDraft {
  return {
    title: "",
    slug: "",
    subtitle: "",
    theme: "diwali",
    backgroundImageUrl: "",
    backgroundColor: "",
    accentColor: "",
    textColor: "",
    badgeLabel: "",
    displayOrder: "0",
    isActive: true,
  };
}

/** Same rules as the backend slug pattern. */
function createSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 130)
    .replace(/-$/, "");
}

/** Empty strings become null so optional fields are cleared, not blanked. */
function optional(value: string): string | null {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function AdminOffersPage() {
  const [draft, setDraft] = useState<SectionDraft>(emptyDraft);
  const [isCreating, setIsCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  /* Percentage being typed, keyed by section id. */
  const [percentDrafts, setPercentDrafts] = useState<Record<string, string>>(
    {},
  );

  const [productChoice, setProductChoice] = useState<Record<string, string>>(
    {},
  );

  /* Expiry choice per section's add form. "never" is the default. */
  const [durationDrafts, setDurationDrafts] = useState<Record<string, string>>(
    {},
  );

  /*
   * A pending add that the server refused because the product is already
   * discounted. Holding it here is what lets the dialogue ask whether the
   * running offer should be removed, then retry the exact same request
   * with confirmation rather than rebuilding it from the form.
   */
  const [conflict, setConflict] = useState<{
    sectionId: string;
    sectionTitle: string;
    productId: string;
    productName: string;
    discountPercent: number;
    durationDays: number | null;
    status: ProductOfferStatus;
  } | null>(null);

  const [isResolvingConflict, setIsResolvingConflict] = useState(false);

  const [isUploading, setIsUploading] = useState(false);

  /* Whether the typed theme matches one with built-in colours. */
  const themeHasPreset = THEME_SUGGESTIONS.includes(
    normaliseTheme(draft.theme),
  );

  /** Uploads a dropped file and stores its public URL on the draft. */
  const handleBackgroundUpload = useCallback(async (file: File) => {
    setIsUploading(true);

    try {
      const uploaded = await uploadOfferBackgroundImage(file);

      setDraft((current) => ({
        ...current,
        backgroundImageUrl: uploaded.publicUrl,
      }));
    } finally {
      setIsUploading(false);
    }
  }, []);

  const [sections, setSections] = useState<OfferSection[] | null>(null);

  /* Hidden sections must be visible here, hence active_only=false. */
  const { isLoading, error, reload } = useAsync(
    useCallback(async (signal: AbortSignal) => {
      const loaded = await offerService.listSections({
        activeOnly: false,
        signal,
      });

      setSections(loaded);

      return loaded;
    }, []),
    [],
    "Unable to load offer sections.",
  );

  const { data: products } = useAsync(
    useCallback(
      (signal: AbortSignal) => loadProducts({ limit: 100 }, signal),
      [],
    ),
    [],
    "Unable to load products.",
  );

  const productsById = useMemo(() => {
    const map = new Map<string, Product>();

    for (const product of products ?? []) {
      map.set(product.id, product);
    }

    return map;
  }, [products]);

  function report(text: string, isError: boolean): void {
    setMessage({ text, isError });
  }

  function replaceSection(updated: OfferSection): void {
    setSections((current) =>
      (current ?? []).map((section) =>
        section.id === updated.id ? updated : section,
      ),
    );
  }

  async function handleCreate(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (draft.title.trim().length < 2) {
      report("Give the offer section a title.", true);
      return;
    }

    setIsCreating(true);
    setMessage(null);

    try {
      const created = await offerService.createSection({
        title: draft.title.trim(),
        slug: createSlug(draft.slug || draft.title),
        subtitle: optional(draft.subtitle),
        theme: normaliseTheme(draft.theme) || "custom",
        background_image_url: optional(draft.backgroundImageUrl),
        background_color: optional(draft.backgroundColor),
        accent_color: optional(draft.accentColor),
        text_color: optional(draft.textColor),
        badge_label: optional(draft.badgeLabel),
        display_order: Number.parseInt(draft.displayOrder, 10) || 0,
        is_active: draft.isActive,
      });

      setSections((current) => [...(current ?? []), created]);
      setDraft(emptyDraft());

      report(`Created "${created.title}".`, false);
    } catch (createError) {
      report(
        friendlyMessage(createError, "Unable to create the offer section."),
        true,
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggleVisibility(section: OfferSection): Promise<void> {
    setBusyId(section.id);

    try {
      const updated = await offerService.updateSection(section.id, {
        is_active: !section.is_active,
      });

      replaceSection(updated);

      report(
        updated.is_active
          ? `"${updated.title}" is now visible on the storefront.`
          : `"${updated.title}" is now hidden.`,
        false,
      );
    } catch (toggleError) {
      report(friendlyMessage(toggleError, "Unable to update it."), true);
    } finally {
      setBusyId(null);
    }
  }

  async function handleThemeChange(
    section: OfferSection,
    theme: string,
  ): Promise<void> {
    setBusyId(section.id);

    try {
      replaceSection(await offerService.updateSection(section.id, { theme }));
    } catch (themeError) {
      report(friendlyMessage(themeError, "Unable to change the theme."), true);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteSection(section: OfferSection): Promise<void> {
    setBusyId(section.id);

    try {
      await offerService.deleteSection(section.id);

      setSections((current) =>
        (current ?? []).filter((entry) => entry.id !== section.id),
      );

      report(`Deleted "${section.title}". Products were not affected.`, false);
    } catch (deleteError) {
      report(friendlyMessage(deleteError, "Unable to delete it."), true);
    } finally {
      setBusyId(null);
    }
  }

  /** Sends the add request. Shared by the first attempt and the retry. */
  async function submitItem(
    section: OfferSection,
    productId: string,
    percent: number,
    durationDays: number | null,
    replaceExisting: boolean,
  ): Promise<void> {
    const updated = await offerService.addItem(section.id, {
      product_id: productId,
      discount_percent: percent,
      duration_days: durationDays,
      replace_existing: replaceExisting,
    });

    replaceSection(updated);

    setProductChoice((current) => ({ ...current, [section.id]: "" }));
  }

  async function handleAddProduct(section: OfferSection): Promise<void> {
    const productId = productChoice[section.id];
    const percent = Number.parseInt(percentDrafts[section.id] ?? "", 10);

    const durationDays = durationChoiceToDays(
      durationDrafts[section.id] ?? "never",
    );

    if (!productId) {
      report("Choose a product to add.", true);
      return;
    }

    if (
      Number.isNaN(percent) ||
      percent < MIN_PERCENT ||
      percent > MAX_PERCENT
    ) {
      report(
        `Enter a discount between ${MIN_PERCENT} and ${MAX_PERCENT} percent.`,
        true,
      );
      return;
    }

    setBusyId(section.id);
    setMessage(null);

    try {
      /*
       * Checked before submitting rather than waiting for the server's
       * 409, so the dialogue can spell out exactly which offer is running
       * and where. The server still refuses on its own if this check is
       * somehow skipped, so the guard is not load-bearing.
       */
      const status = await offerService.getProductOfferStatus(productId);

      if (status.has_live_offer) {
        setConflict({
          sectionId: section.id,
          sectionTitle: section.title,
          productId,
          productName: status.product_name,
          discountPercent: percent,
          durationDays,
          status,
        });

        return;
      }

      await submitItem(section, productId, percent, durationDays, false);

      report("Product added to the offer.", false);
    } catch (addError) {
      report(friendlyMessage(addError, "Unable to add that product."), true);
    } finally {
      setBusyId(null);
    }
  }

  /** Retries the refused add, withdrawing whatever was already running. */
  async function handleReplaceExisting(): Promise<void> {
    if (!conflict) {
      return;
    }

    const section = (sections ?? []).find(
      (entry) => entry.id === conflict.sectionId,
    );

    if (!section) {
      setConflict(null);
      return;
    }

    setIsResolvingConflict(true);

    try {
      await submitItem(
        section,
        conflict.productId,
        conflict.discountPercent,
        conflict.durationDays,
        true,
      );

      setConflict(null);

      report(
        `Replaced the previous offer on "${conflict.productName}" with ` +
          `${conflict.discountPercent}% off in "${conflict.sectionTitle}".`,
        false,
      );

      /*
       * Removing the old offer may have emptied another section, so the
       * whole list is re-read rather than patched in place.
       */
      reload();
    } catch (replaceError) {
      report(
        friendlyMessage(replaceError, "Unable to replace the offer."),
        true,
      );
    } finally {
      setIsResolvingConflict(false);
    }
  }

  async function handleChangeItemPercent(
    itemId: string,
    percent: number,
  ): Promise<void> {
    setBusyId(itemId);

    try {
      replaceSection(
        await offerService.updateItem(itemId, { discount_percent: percent }),
      );
    } catch (updateError) {
      report(
        friendlyMessage(updateError, "Unable to change the discount."),
        true,
      );
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Changes how long one entry runs for.
   *
   * "keep" is the resting value of the select and means no change, so
   * choosing it does nothing rather than resetting the deadline.
   */
  async function handleChangeItemDuration(
    itemId: string,
    choice: string,
  ): Promise<void> {
    if (choice === "keep") {
      return;
    }

    setBusyId(itemId);

    try {
      replaceSection(
        await offerService.updateItem(itemId, {
          duration_days: durationChoiceToDays(choice),
        }),
      );

      report(
        choice === "never"
          ? "This offer now runs until you remove it."
          : `This offer now ends in ${choice} days.`,
        false,
      );
    } catch (updateError) {
      report(
        friendlyMessage(updateError, "Unable to change the expiry."),
        true,
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemoveItem(
    section: OfferSection,
    itemId: string,
  ): Promise<void> {
    setBusyId(itemId);

    try {
      await offerService.removeItem(itemId);

      replaceSection({
        ...section,
        items: section.items.filter((item) => item.id !== itemId),
        item_count: Math.max(0, section.item_count - 1),
      });

      report("Product removed from the offer.", false);
    } catch (removeError) {
      report(friendlyMessage(removeError, "Unable to remove it."), true);
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading && !sections) {
    return (
      <div className="admin-page">
        <p>Loading offer sections...</p>
      </div>
    );
  }

  const list = sections ?? [];

  /* Preview price for the add form, using the backend's rounding rule. */
  function previewFor(sectionId: string): string | null {
    const productId = productChoice[sectionId];
    const percent = Number.parseInt(percentDrafts[sectionId] ?? "", 10);

    const product = productId ? productsById.get(productId) : undefined;

    if (
      !product ||
      Number.isNaN(percent) ||
      percent < MIN_PERCENT ||
      percent > MAX_PERCENT
    ) {
      return null;
    }

    return `${formatPrice(product.base_price_paise)} becomes ${formatPrice(
      applyPercent(product.base_price_paise, percent),
    )}`;
  }

  /** Plain-English summary of what is already discounting a product. */
  function describeConflict(status: ProductOfferStatus): string {
    const parts: string[] = [];

    if (status.own_offer_is_live && status.offer_percent !== null) {
      const deadline = describeOfferEnd(status.offer_ends_at);

      parts.push(
        `its own ${status.offer_percent}% discount` +
          (deadline.neverExpires ? "" : ` (${deadline.shortLabel})`),
      );
    }

    for (const membership of status.memberships) {
      if (!membership.is_live) {
        continue;
      }

      const deadline = describeOfferEnd(membership.ends_at);

      parts.push(
        `${membership.discount_percent}% off in "${membership.section_title}"` +
          (deadline.neverExpires ? "" : ` (${deadline.shortLabel})`),
      );
    }

    return parts.join(" and ");
  }

  return (
    <div className="admin-page">
      {/* ---------- Already-on-offer conflict ---------- */}

      {/*
        Two overlapping offers are not broken, since the larger simply
        wins, but they leave nobody able to explain why a piece is 40% off
        when it was just set to 25%. So the running offer is named and the
        choice to withdraw it is made deliberately.
      */}
      <ConfirmDialog
        cancelLabel="Cancel"
        confirmLabel="Remove the old offer and add this one"
        isBusy={isResolvingConflict}
        isOpen={conflict !== null}
        message={
          conflict
            ? `"${conflict.productName}" already has a running offer: ` +
              `${describeConflict(conflict.status)}. ` +
              `Customers currently get ${conflict.status.effective_discount_percent}% off. ` +
              `Adding ${conflict.discountPercent}% off in "${conflict.sectionTitle}" ` +
              "will remove the existing offer first, so there is only ever one."
            : ""
        }
        onCancel={() => setConflict(null)}
        onConfirm={() => void handleReplaceExisting()}
        subject={
          conflict
            ? `New discount: ${conflict.discountPercent}% off, ` +
              (conflict.durationDays === null
                ? "no end date"
                : `ending in ${conflict.durationDays} days`)
            : null
        }
        title="This product is already on offer"
      />

      <header className="admin-page-heading">
        <p className="eyebrow">Store management</p>
        <h1>Special offers</h1>

        <p>
          Build a themed offer section, such as a Diwali or Christmas sale,
          and put existing products in it at a discount. Prices are
          calculated automatically and the same figures are charged at
          checkout. Hiding a section removes it from the storefront and
          withdraws its discounts immediately.
        </p>

        <p>
          Each product can be set to expire after a number of days, or to
          run until you remove it. An expired offer stops discounting
          straight away, in the cart and at checkout as well as on the
          storefront, and stays listed here so you can extend it.
        </p>
      </header>

      {error && (
        <p className="admin-message admin-error">
          {error}{" "}
          <button className="btn-quiet" onClick={reload} type="button">
            Retry
          </button>
        </p>
      )}

      {message && (
        <p
          className={
            message.isError
              ? "admin-message admin-error"
              : "admin-message admin-success"
          }
        >
          {message.text}
        </p>
      )}

      {/* ---------- Create ---------- */}

      <section className="admin-collection-create">
        <h2>New offer section</h2>

        <form className="admin-form-grid" onSubmit={(e) => void handleCreate(e)}>
          <div className="admin-form-field">
            <label htmlFor="offer-title">Title</label>
            <input
              id="offer-title"
              maxLength={120}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  title: event.target.value,
                  slug: createSlug(event.target.value),
                }))
              }
              placeholder="Diwali Special Offer"
              required
              value={draft.title}
            />
          </div>

          <div className="admin-form-field">
            <label htmlFor="offer-badge">Badge label</label>
            <input
              id="offer-badge"
              maxLength={60}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  badgeLabel: event.target.value,
                }))
              }
              placeholder="Diwali Special"
              value={draft.badgeLabel}
            />
          </div>

          <div className="admin-form-field admin-form-full">
            <label htmlFor="offer-subtitle">Subtitle</label>
            <textarea
              id="offer-subtitle"
              maxLength={300}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  subtitle: event.target.value,
                }))
              }
              placeholder="Handpicked marble pieces at festive prices."
              rows={2}
              value={draft.subtitle}
            />
          </div>

          {/* Free text: type any occasion name. */}
          <div className="admin-form-field">
            <label htmlFor="offer-theme">Theme name</label>

            <input
              id="offer-theme"
              list="offer-theme-suggestions"
              maxLength={40}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  theme: event.target.value,
                }))
              }
              placeholder="Diwali, Monsoon Clearance, Anniversary..."
              value={draft.theme}
            />

            {/*
              A datalist suggests the themes that have a built-in colour
              preset without restricting what can be typed.
            */}
            <datalist id="offer-theme-suggestions">
              {THEME_SUGGESTIONS.map((theme) => (
                <option key={theme} value={theme} />
              ))}
            </datalist>

            <small className="admin-field-note">
              {themeHasPreset
                ? "This theme has built-in colours. Leave the pickers blank to use them."
                : "No built-in colours for this name, so pick your own below."}
            </small>
          </div>

          <div className="admin-form-field">
            <label htmlFor="offer-order">Display order</label>
            <input
              id="offer-order"
              min={0}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  displayOrder: event.target.value,
                }))
              }
              type="number"
              value={draft.displayOrder}
            />
          </div>

          <div className="admin-form-full">
            <ImageDropzone
              isBusy={isUploading}
              onClear={() =>
                setDraft((current) => ({
                  ...current,
                  backgroundImageUrl: "",
                }))
              }
              onUpload={handleBackgroundUpload}
              value={draft.backgroundImageUrl || null}
            />
          </div>

          {/*
            Optional overrides. Blank uses the theme preset where one
            exists, which is why they are colour pickers with a clear
            action rather than free-text hex fields.
          */}
          <div className="admin-form-full admin-colour-row">
            {(
              [
                ["backgroundColor", "Background", "#2A1206"],
                ["accentColor", "Accent", "#E8B54D"],
                ["textColor", "Text", "#FFF8EC"],
              ] as const
            ).map(([field, colourLabel, fallback]) => (
              <div className="admin-colour-field" key={field}>
                <label htmlFor={`offer-${field}`}>{colourLabel}</label>

                <div className="admin-colour-control">
                  <input
                    id={`offer-${field}`}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [field]: event.target.value.toUpperCase(),
                      }))
                    }
                    type="color"
                    value={draft[field] || fallback}
                  />

                  <span className="admin-colour-value">
                    {draft[field] || "Theme default"}
                  </span>

                  {draft[field] && (
                    <button
                      className="admin-colour-clear"
                      onClick={() =>
                        setDraft((current) => ({ ...current, [field]: "" }))
                      }
                      title="Use the theme default"
                      type="button"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="admin-form-full admin-form-footer">
            <label className="admin-inline-checkbox">
              <input
                checked={draft.isActive}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              <span>Show on the storefront straight away</span>
            </label>

            <button
              className="admin-save-button"
              disabled={isCreating || isUploading}
              type="submit"
            >
              {isCreating ? "Creating..." : "Create offer section"}
            </button>
          </div>
        </form>
      </section>

      {/* ---------- Existing sections ---------- */}

      {list.length === 0 ? (
        <p className="admin-empty-message">
          No offer sections yet. Create one above and it will appear on the
          home page after the collections rail.
        </p>
      ) : (
        <div className="admin-collection-list">
          {list.map((section) => (
            <article className="admin-collection-card" key={section.id}>
              <div className="admin-collection-card-heading">
                <div>
                  <h3>{section.title}</h3>
                  <span>/collections offer &middot; {section.slug}</span>
                </div>

                <span
                  className={
                    section.is_active
                      ? "badge badge-success"
                      : "badge badge-neutral"
                  }
                >
                  {section.is_active ? "Visible" : "Hidden"}
                </span>
              </div>

              <div className="admin-form-grid">
                <div className="admin-form-field">
                  <label htmlFor={`theme-${section.id}`}>Theme name</label>

                  {/* Committed on blur so it is not saved per keystroke. */}
                  <input
                    defaultValue={section.theme}
                    disabled={busyId === section.id}
                    id={`theme-${section.id}`}
                    list="offer-theme-suggestions"
                    maxLength={40}
                    onBlur={(event) => {
                      const next = normaliseTheme(event.target.value);

                      if (next && next !== section.theme) {
                        void handleThemeChange(section, next);
                      }
                    }}
                  />
                </div>

                <div className="admin-form-field">
                  <label>Products in this offer</label>
                  <p className="admin-static-value">{section.item_count}</p>
                </div>
              </div>

              {/* ---------- Products ---------- */}

              {section.items.length > 0 && (
                <ul className="admin-offer-items">
                  {section.items.map((item) => (
                    <li className="admin-offer-item" key={item.id}>
                      <span className="admin-offer-item-name">
                        {item.product.name}
                      </span>

                      <span className="admin-offer-item-price">
                        <s>{formatPrice(item.product.base_price_paise)}</s>{" "}
                        <strong>
                          {formatPrice(item.product.offer_price_paise)}
                        </strong>
                      </span>

                      <span className="admin-offer-item-percent">
                        <input
                          aria-label={`Discount percent for ${item.product.name}`}
                          defaultValue={item.discount_percent}
                          disabled={busyId === item.id}
                          max={MAX_PERCENT}
                          min={MIN_PERCENT}
                          onBlur={(event) => {
                            const next = Number.parseInt(
                              event.target.value,
                              10,
                            );

                            if (
                              !Number.isNaN(next) &&
                              next !== item.discount_percent
                            ) {
                              void handleChangeItemPercent(item.id, next);
                            }
                          }}
                          type="number"
                        />
                        % off
                      </span>

                      {/* ---------- Expiry ---------- */}

                      {/*
                        Changing this restarts the countdown from now, which
                        is why the current state is spelled out beside it
                        rather than being implied by the selected option.
                      */}
                      <span className="admin-offer-item-expiry">
                        <select
                          aria-label={`Expiry for ${item.product.name}`}
                          disabled={busyId === item.id}
                          onChange={(event) =>
                            void handleChangeItemDuration(
                              item.id,
                              event.target.value,
                            )
                          }
                          value="keep"
                        >
                          <option value="keep">
                            {item.is_live
                              ? describeOfferEnd(item.ends_at).neverExpires
                                ? "No end date"
                                : describeOfferEnd(item.ends_at).shortLabel
                              : "Expired"}
                          </option>

                          <option value="never">Never expires</option>

                          {OFFER_DURATION_PRESETS.map((days) => (
                            <option key={days} value={String(days)}>
                              Extend to {days} day{days === 1 ? "" : "s"}
                            </option>
                          ))}
                        </select>

                        {!item.is_live && (
                          <span className="badge badge-neutral">
                            Not discounting
                          </span>
                        )}
                      </span>

                      <button
                        className="admin-delete-button"
                        disabled={busyId === item.id}
                        onClick={() => void handleRemoveItem(section, item.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* ---------- Add a product ---------- */}

              <div className="admin-form-grid admin-offer-add">
                <div className="admin-form-field">
                  <label htmlFor={`product-${section.id}`}>Add a product</label>
                  <select
                    id={`product-${section.id}`}
                    onChange={(event) =>
                      setProductChoice((current) => ({
                        ...current,
                        [section.id]: event.target.value,
                      }))
                    }
                    value={productChoice[section.id] ?? ""}
                  >
                    <option value="">Choose a product</option>

                    {(products ?? [])
                      .filter(
                        (product) =>
                          !section.items.some(
                            (item) => item.product_id === product.id,
                          ),
                      )
                      .map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} &mdash;{" "}
                          {formatPrice(product.base_price_paise)}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="admin-form-field">
                  <label htmlFor={`percent-${section.id}`}>Discount %</label>
                  <input
                    id={`percent-${section.id}`}
                    max={MAX_PERCENT}
                    min={MIN_PERCENT}
                    onChange={(event) =>
                      setPercentDrafts((current) => ({
                        ...current,
                        [section.id]: event.target.value,
                      }))
                    }
                    placeholder="30"
                    type="number"
                    value={percentDrafts[section.id] ?? ""}
                  />
                </div>

                <div className="admin-form-field">
                  <label htmlFor={`duration-${section.id}`}>Expires</label>
                  <select
                    id={`duration-${section.id}`}
                    onChange={(event) =>
                      setDurationDrafts((current) => ({
                        ...current,
                        [section.id]: event.target.value,
                      }))
                    }
                    value={durationDrafts[section.id] ?? "never"}
                  >
                    <option value="never">Never</option>

                    {OFFER_DURATION_PRESETS.map((days) => (
                      <option key={days} value={String(days)}>
                        In {days} day{days === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-form-field">
                  <label>&nbsp;</label>
                  <button
                    className="admin-save-button"
                    disabled={busyId === section.id}
                    onClick={() => void handleAddProduct(section)}
                    type="button"
                  >
                    {busyId === section.id ? "Checking..." : "Add to offer"}
                  </button>
                </div>

                {previewFor(section.id) && (
                  <p className="admin-form-full admin-offer-preview">
                    {previewFor(section.id)}
                  </p>
                )}
              </div>

              <div className="admin-collection-card-actions">
                <button
                  className="btn-quiet"
                  disabled={busyId === section.id}
                  onClick={() => void handleToggleVisibility(section)}
                  type="button"
                >
                  {section.is_active ? "Hide from storefront" : "Show on storefront"}
                </button>

                <button
                  className="admin-delete-button"
                  disabled={busyId === section.id}
                  onClick={() => void handleDeleteSection(section)}
                  type="button"
                >
                  Delete section
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminOffersPage;
