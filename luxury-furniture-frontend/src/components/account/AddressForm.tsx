import { useState } from "react";

import type {
  Address,
  AddressCreateRequest,
} from "../../types/address";

interface AddressFormProps {
  /** Supplied when editing; omitted when creating. */
  address?: Address | null;

  onSubmit: (data: AddressCreateRequest) => Promise<void>;
  onCancel?: () => void;

  submitLabel?: string;
}

interface FormState {
  label: string;
  recipient_name: string;
  phone: string;
  address_line_1: string;
  address_line_2: string;
  landmark: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

function toFormState(address?: Address | null): FormState {
  return {
    label: address?.label ?? "Home",
    recipient_name: address?.recipient_name ?? "",
    phone: address?.phone ?? "",
    address_line_1: address?.address_line_1 ?? "",
    address_line_2: address?.address_line_2 ?? "",
    landmark: address?.landmark ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    postal_code: address?.postal_code ?? "",
    country: address?.country ?? "India",
    is_default: address?.is_default ?? false,
  };
}

/*
 * Client-side rules mirror the backend AddressBase constraints so the
 * shopper is corrected before a request is sent rather than after a 422.
 */
function validate(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};

  if (form.label.trim().length < 1 || form.label.trim().length > 50) {
    errors.label = "Use between 1 and 50 characters.";
  }

  if (
    form.recipient_name.trim().length < 2 ||
    form.recipient_name.trim().length > 150
  ) {
    errors.recipient_name = "Enter the full name of the recipient.";
  }

  const phone = form.phone.trim();

  if (phone.length < 8 || phone.length > 20) {
    errors.phone = "Enter a contact number between 8 and 20 characters.";
  }

  if (
    form.address_line_1.trim().length < 5 ||
    form.address_line_1.trim().length > 250
  ) {
    errors.address_line_1 = "Enter at least 5 characters.";
  }

  if (form.city.trim().length < 2) {
    errors.city = "Enter a city.";
  }

  if (form.state.trim().length < 2) {
    errors.state = "Enter a state.";
  }

  const postalCode = form.postal_code.trim();

  if (postalCode.length < 4 || postalCode.length > 20) {
    errors.postal_code = "Enter a valid postal code.";
  }

  if (form.country.trim().length < 2) {
    errors.country = "Enter a country.";
  }

  return errors;
}

/** Trims text and converts empty optional fields to null for the API. */
function toRequest(form: FormState): AddressCreateRequest {
  const optional = (value: string): string | null =>
    value.trim() === "" ? null : value.trim();

  return {
    label: form.label.trim(),
    recipient_name: form.recipient_name.trim(),
    phone: form.phone.trim(),
    address_line_1: form.address_line_1.trim(),
    address_line_2: optional(form.address_line_2),
    landmark: optional(form.landmark),
    city: form.city.trim(),
    state: form.state.trim(),
    postal_code: form.postal_code.trim(),
    country: form.country.trim(),
    is_default: form.is_default,
  };
}

function AddressForm({
  address = null,
  onSubmit,
  onCancel,
  submitLabel = "Save address",
}: AddressFormProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(address));
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function update<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ): void {
    setForm((current) => ({ ...current, [key]: value }));

    /* Clear the field error as soon as the shopper edits it. */
    setErrors((current) =>
      current[key] ? { ...current, [key]: undefined } : current,
    );
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const validationErrors = validate(form);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);
    setSubmitError(null);

    try {
      await onSubmit(toRequest(form));
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to save this address.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="address-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
      {submitError && (
        <p className="notice notice-error" role="alert">
          {submitError}
        </p>
      )}

      <div className="address-form-grid">
        <label className="field">
          <span className="field-label">Label</span>

          <input
            className="control"
            maxLength={50}
            onChange={(event) => update("label", event.target.value)}
            placeholder="Home, Office..."
            value={form.label}
          />

          {errors.label && <span className="field-error">{errors.label}</span>}
        </label>

        <label className="field">
          <span className="field-label">Recipient name</span>

          <input
            autoComplete="name"
            className="control"
            maxLength={150}
            onChange={(event) => update("recipient_name", event.target.value)}
            required
            value={form.recipient_name}
          />

          {errors.recipient_name && (
            <span className="field-error">{errors.recipient_name}</span>
          )}
        </label>

        <label className="field">
          <span className="field-label">Phone</span>

          <input
            autoComplete="tel"
            className="control"
            inputMode="tel"
            maxLength={20}
            onChange={(event) => update("phone", event.target.value)}
            required
            value={form.phone}
          />

          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </label>

        <label className="field">
          <span className="field-label">Postal code</span>

          <input
            autoComplete="postal-code"
            className="control"
            inputMode="numeric"
            maxLength={20}
            onChange={(event) => update("postal_code", event.target.value)}
            required
            value={form.postal_code}
          />

          {errors.postal_code && (
            <span className="field-error">{errors.postal_code}</span>
          )}
        </label>

        <label className="field is-wide">
          <span className="field-label">Address line 1</span>

          <input
            autoComplete="address-line1"
            className="control"
            maxLength={250}
            onChange={(event) => update("address_line_1", event.target.value)}
            required
            value={form.address_line_1}
          />

          {errors.address_line_1 && (
            <span className="field-error">{errors.address_line_1}</span>
          )}
        </label>

        <label className="field is-wide">
          <span className="field-label">
            Address line 2 <span className="field-hint">(optional)</span>
          </span>

          <input
            autoComplete="address-line2"
            className="control"
            maxLength={250}
            onChange={(event) => update("address_line_2", event.target.value)}
            value={form.address_line_2}
          />
        </label>

        <label className="field">
          <span className="field-label">
            Landmark <span className="field-hint">(optional)</span>
          </span>

          <input
            className="control"
            maxLength={150}
            onChange={(event) => update("landmark", event.target.value)}
            value={form.landmark}
          />
        </label>

        <label className="field">
          <span className="field-label">City</span>

          <input
            autoComplete="address-level2"
            className="control"
            maxLength={100}
            onChange={(event) => update("city", event.target.value)}
            required
            value={form.city}
          />

          {errors.city && <span className="field-error">{errors.city}</span>}
        </label>

        <label className="field">
          <span className="field-label">State</span>

          <input
            autoComplete="address-level1"
            className="control"
            maxLength={100}
            onChange={(event) => update("state", event.target.value)}
            required
            value={form.state}
          />

          {errors.state && <span className="field-error">{errors.state}</span>}
        </label>

        <label className="field">
          <span className="field-label">Country</span>

          <input
            autoComplete="country-name"
            className="control"
            maxLength={100}
            onChange={(event) => update("country", event.target.value)}
            required
            value={form.country}
          />

          {errors.country && (
            <span className="field-error">{errors.country}</span>
          )}
        </label>
      </div>

      <label className="checkbox-row">
        <input
          checked={form.is_default}
          onChange={(event) => update("is_default", event.target.checked)}
          type="checkbox"
        />
        Use this as my default delivery address
      </label>

      <div className="address-form-actions">
        <button className="btn btn-primary" disabled={isSaving} type="submit">
          {isSaving ? "Saving..." : submitLabel}
        </button>

        {onCancel && (
          <button
            className="btn btn-ghost"
            disabled={isSaving}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default AddressForm;
