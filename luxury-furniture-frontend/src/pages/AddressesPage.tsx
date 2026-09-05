import {
  useEffect,
  useState,
} from "react";

import { AccountSidebar } from "../components/account/AccountSidebar";
import { addressService } from "../services/addresses";
import type {
  Address,
  AddressCreateRequest,
} from "../types/address";

interface AddressFormState {
  label: string;
  recipient_name: string;
  phone_country_code: string;
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
interface ReverseGeocodingAddress {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

interface ReverseGeocodingResponse {
  address?: ReverseGeocodingAddress;
  display_name?: string;
  error?: string;
}
const emptyAddressForm: AddressFormState = {
  label: "Home",
  recipient_name: "",
  phone_country_code: "+91",
  phone: "",
  address_line_1: "",
  address_line_2: "",
  landmark: "",
  city: "",
  state: "",
  postal_code: "",
  country: "India",
  is_default: false,
};
function formatCountryCodeInput(
  value: string,
): string {
  const digits = value
    .replace(/\D/g, "")
    .slice(0, 4);

  return `+${digits}`;
}

function formatPhoneNumberInput(
  value: string,
): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 14);
}

function normalizeInternationalPhone(
  countryCode: string,
  phoneNumber: string,
): string | null {
  const countryCodeDigits =
    countryCode.replace(/\D/g, "");

  const phoneDigits =
    phoneNumber.replace(/\D/g, "");

  if (
    countryCodeDigits.length < 1 ||
    countryCodeDigits.length > 4
  ) {
    return null;
  }

  if (
    phoneDigits.length < 6 ||
    phoneDigits.length > 14
  ) {
    return null;
  }

  return `+${countryCodeDigits} ${phoneDigits}`;
}

function splitStoredPhone(
  value: string,
): {
  countryCode: string;
  phoneNumber: string;
} {
  const trimmedValue = value.trim();

  const formattedMatch = trimmedValue.match(
    /^(\+\d{1,4})\s+(\d{6,14})$/,
  );

  if (formattedMatch) {
    return {
      countryCode: formattedMatch[1],
      phoneNumber: formattedMatch[2],
    };
  }

  /*
   * Compatibility with numbers previously saved
   * by the old Indian-only phone field.
   */
  if (trimmedValue.startsWith("+91")) {
    return {
      countryCode: "+91",
      phoneNumber: trimmedValue
        .slice(3)
        .replace(/\D/g, "")
        .slice(0, 14),
    };
  }

  return {
    countryCode: "+",
    phoneNumber: trimmedValue
      .replace(/\D/g, "")
      .slice(0, 14),
  };
}

function getLocationErrorMessage(
  error: GeolocationPositionError,
): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission was denied. Allow location access and try again.";

    case error.POSITION_UNAVAILABLE:
      return "Your current location could not be detected.";

    case error.TIMEOUT:
      return "Location detection took too long. Please try again.";

    default:
      return "Unable to detect your current location.";
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to complete the address request.";
}

function AddressesPage() {
  const [addresses, setAddresses] =
    useState<Address[]>([]);

  const [form, setForm] =
    useState<AddressFormState>(
      emptyAddressForm,
    );
    const [
    isDetectingLocation,
    setIsDetectingLocation,
    ] = useState(false);

  const [
    editingAddressId,
    setEditingAddressId,
  ] = useState<string | null>(null);

  const [deletingAddressId, setDeletingAddressId] =
    useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    async function loadAddresses(): Promise<void> {
      try {
        const addressData =
          await addressService.listAddresses(
            controller.signal,
          );

        if (isActive) {
          setAddresses(addressData);
        }
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
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

    void loadAddresses();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  function updateFormField<
    Field extends keyof AddressFormState,
  >(
    field: Field,
    value: AddressFormState[Field],
  ): void {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function resetForm(): void {
    setForm(emptyAddressForm);
    setEditingAddressId(null);
  }

  function startEditing(address: Address): void {
    setEditingAddressId(address.id);
    const storedPhone = splitStoredPhone(
  address.phone,
);

    setForm({
      label: address.label,
      recipient_name: address.recipient_name,
      phone_country_code:storedPhone.countryCode,
    phone:storedPhone.phoneNumber,
      address_line_1: address.address_line_1,
      address_line_2:
        address.address_line_2 ?? "",
      landmark: address.landmark ?? "",
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      country: address.country,
      is_default: address.is_default,
    });

    setError(null);
    setSuccessMessage(null);

    window.setTimeout(() => {
      document
        .getElementById("address-form")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 0);
  }

  async function refreshAddresses(): Promise<void> {
    const addressData =
      await addressService.listAddresses();

    setAddresses(addressData);
  }

  function handleDetectLocation(): void {
  if (!navigator.geolocation) {
    setError(
      "Location detection is not supported by this browser.",
    );

    return;
  }

  setIsDetectingLocation(true);
  setError(null);
  setSuccessMessage(null);

  navigator.geolocation.getCurrentPosition(
    (position) => {
      void reverseGeocodeLocation(
        position.coords.latitude,
        position.coords.longitude,
      );
    },
    (locationError) => {
      setError(
        getLocationErrorMessage(locationError),
      );

      setIsDetectingLocation(false);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 300000,
    },
  );
}

async function reverseGeocodeLocation(
  latitude: number,
  longitude: number,
): Promise<void> {
  try {
    const query = new URLSearchParams({
      format: "jsonv2",
      lat: String(latitude),
      lon: String(longitude),
      addressdetails: "1",
      zoom: "18",
      "accept-language": "en",
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${query.toString()}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        "The address could not be found for your location.",
      );
    }

    const locationData =
      (await response.json()) as ReverseGeocodingResponse;

    if (locationData.error || !locationData.address) {
      throw new Error(
        locationData.error ??
          "The address could not be found for your location.",
      );
    }

    const detectedAddress = locationData.address;

    const addressLine1 = [
      detectedAddress.house_number,
      detectedAddress.road,
    ]
      .filter(Boolean)
      .join(", ");

    const addressLine2 =
      detectedAddress.neighbourhood ??
      detectedAddress.suburb ??
      detectedAddress.city_district ??
      "";

    const detectedCity =
      detectedAddress.city ??
      detectedAddress.town ??
      detectedAddress.village ??
      detectedAddress.municipality ??
      detectedAddress.county ??
      "";

    setForm((currentForm) => ({
      ...currentForm,

      address_line_1:
        addressLine1 ||
        currentForm.address_line_1,

      address_line_2:
        addressLine2 ||
        currentForm.address_line_2,

      city:
        detectedCity ||
        currentForm.city,

      state:
        detectedAddress.state ??
        currentForm.state,

      postal_code:
        detectedAddress.postcode ??
        currentForm.postal_code,

      country:
        detectedAddress.country ??
        currentForm.country,
    }));

    setSuccessMessage(
      "Location detected. Please check the address and add your house or flat number.",
    );
  } catch (requestError) {
    setError(
      requestError instanceof Error
        ? requestError.message
        : "Unable to find the address for your location.",
    );
  } finally {
    setIsDetectingLocation(false);
  }
}

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const normalizedPhone =
  normalizeInternationalPhone(
    form.phone_country_code,
    form.phone,
  );

if (!normalizedPhone) {
  setError(
    "Enter a valid country code and phone number.",
  );

  setSuccessMessage(null);
  return;
}

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    const payload: AddressCreateRequest = {
      label: form.label.trim() || "Home",
      recipient_name:
        form.recipient_name.trim(),
      phone: normalizedPhone,
      address_line_1:
        form.address_line_1.trim(),
      address_line_2:
        form.address_line_2.trim() || null,
      landmark:
        form.landmark.trim() || null,
      city: form.city.trim(),
      state: form.state.trim(),
      postal_code:
        form.postal_code.trim(),
      country:
        form.country.trim() || "India",
      is_default: form.is_default,
    };

    try {
      if (editingAddressId) {
        await addressService.updateAddress(
          editingAddressId,
          payload,
        );

        setSuccessMessage(
          "Address updated successfully.",
        );
      } else {
        await addressService.createAddress(
          payload,
        );

        setSuccessMessage(
          "Address added successfully.",
        );
      }

      await refreshAddresses();
      resetForm();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(
    address: Address,
  ): Promise<void> {
    const shouldDelete = window.confirm(
      `Delete the ${address.label} address?`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingAddressId(address.id);
    setError(null);
    setSuccessMessage(null);

    try {
      await addressService.deleteAddress(
        address.id,
      );

      await refreshAddresses();

      if (
        editingAddressId === address.id
      ) {
        resetForm();
      }

      setSuccessMessage(
        "Address deleted successfully.",
      );
    } catch (requestError) {
      setError(
        getErrorMessage(requestError),
      );
    } finally {
      setDeletingAddressId(null);
    }
  }

  return (
    <main className="account-page">
      <section className="account-heading">
        <p className="eyebrow">
          My account
        </p>

        <h1>Delivery addresses</h1>

        <p>
          Add and manage the addresses used for
          furniture delivery.
        </p>
      </section>

      <div className="account-layout">
        <AccountSidebar onError={setError} />

        <section className="account-panel addresses-panel">
          {error && (
            <p
              className="account-message account-error"
              role="alert"
            >
              {error}
            </p>
          )}

          {successMessage && (
            <p
              className="account-message account-success"
              role="status"
            >
              {successMessage}
            </p>
          )}

          <section className="saved-addresses-section">
            <div className="addresses-section-heading">
              <div>
                <h2>Saved addresses</h2>

                <p>
                  Choose a saved address during
                  checkout.
                </p>
              </div>

              <span>
                {addresses.length}{" "}
                {addresses.length === 1
                  ? "address"
                  : "addresses"}
              </span>
            </div>

            {isLoading ? (
              <p>Loading addresses...</p>
            ) : addresses.length === 0 ? (
              <div className="addresses-empty-state">
                <h3>No saved addresses</h3>

                <p>
                  Complete the form below to add
                  your first delivery address.
                </p>
              </div>
            ) : (
              <div className="address-card-grid">
                {addresses.map((address) => (
                  <article
                    className={
                      address.is_default
                        ? "address-card default"
                        : "address-card"
                    }
                    key={address.id}
                  >
                    <div className="address-card-heading">
                      <h3>{address.label}</h3>

                      {address.is_default && (
                        <span>Default</span>
                      )}
                    </div>

                    <p className="address-recipient">
                      {address.recipient_name}
                    </p>

                    <address>
                      <span>
                        {address.address_line_1}
                      </span>

                      {address.address_line_2 && (
                        <span>
                          {address.address_line_2}
                        </span>
                      )}

                      {address.landmark && (
                        <span>
                          Near {address.landmark}
                        </span>
                      )}

                      <span>
                        {address.city},{" "}
                        {address.state}{" "}
                        {address.postal_code}
                      </span>

                      <span>{address.country}</span>
                    </address>

                    <p className="address-phone">
                      Phone: {address.phone}
                    </p>

                    <div className="address-card-actions">
                      <button
                        onClick={() =>
                          startEditing(address)
                        }
                        type="button"
                      >
                        Edit
                      </button>

                      <button
                        className="address-delete-button"
                        disabled={
                          deletingAddressId ===
                          address.id
                        }
                        onClick={() =>
                          void handleDelete(address)
                        }
                        type="button"
                      >
                        {deletingAddressId ===
                        address.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section
            className="address-form-section"
            id="address-form"
          >
            <div className="addresses-section-heading">
              <div>
                <h2>
                  {editingAddressId
                    ? "Edit address"
                    : "Add a new address"}
                </h2>

                <p>
                  Enter the complete delivery
                  information.
                </p>
              </div>

              {editingAddressId && (
                <button
                  className="cancel-address-edit"
                  onClick={resetForm}
                  type="button"
                >
                  Cancel edit
                </button>
              )}
            </div>

            <form
            className="address-form"
            onSubmit={handleSubmit}
            >
            <div className="location-detect-box">
                <div>
                <strong>Use your current location</strong>

                <p>
                    Automatically fill your nearby area,
                    city, state and PIN code.
                </p>
                </div>

                <button
                className="detect-location-button"
                disabled={isDetectingLocation}
                onClick={handleDetectLocation}
                type="button"
                >
                {isDetectingLocation
                    ? "Detecting..."
                    : "Detect my location"}
                </button>
            </div>

            <p className="location-attribution">
                Location data ©{" "}
                <a
                href="https://www.openstreetmap.org/copyright"
                rel="noreferrer"
                target="_blank"
                >
                OpenStreetMap contributors
                </a>
                . Please verify your complete delivery address.
            </p>

            <div className="address-form-grid">
                <div className="account-form-group">
                  <label htmlFor="address-label">
                    Address label
                  </label>

                  <input
                    id="address-label"
                    maxLength={50}
                    minLength={1}
                    onChange={(event) =>
                      updateFormField(
                        "label",
                        event.target.value,
                      )
                    }
                    placeholder="Home"
                    required
                    type="text"
                    value={form.label}
                  />
                </div>

                <div className="account-form-group">
                  <label htmlFor="recipient-name">
                    Recipient name
                  </label>

                  <input
                    autoComplete="name"
                    id="recipient-name"
                    maxLength={150}
                    minLength={2}
                    onChange={(event) =>
                      updateFormField(
                        "recipient_name",
                        event.target.value,
                      )
                    }
                    required
                    type="text"
                    value={form.recipient_name}
                  />
                </div>

                <div className="account-form-group">
                <label htmlFor="address-phone">
                    Phone number
                </label>

                <div className="international-phone-input">
                    <input
                    aria-label="Country calling code"
                    className="country-code-input"
                    id="phone-country-code"
                    inputMode="tel"
                    maxLength={5}
                    onChange={(event) =>
                        updateFormField(
                        "phone_country_code",
                        formatCountryCodeInput(
                            event.target.value,
                        ),
                        )
                    }
                    pattern="[+][0-9]{1,4}"
                    placeholder="+91"
                    required
                    title="Enter a country code such as +91, +1 or +44"
                    type="tel"
                    value={form.phone_country_code}
                    />

                    <input
                    aria-label="Phone number"
                    autoComplete="tel-national"
                    id="address-phone"
                    inputMode="numeric"
                    maxLength={14}
                    minLength={6}
                    onChange={(event) =>
                        updateFormField(
                        "phone",
                        formatPhoneNumberInput(
                            event.target.value,
                        ),
                        )
                    }
                    pattern="[0-9]{6,14}"
                    placeholder="9876543210"
                    required
                    title="Enter 6 to 14 digits"
                    type="tel"
                    value={form.phone}
                    />
                </div>

                <small className="phone-input-help">
                    Enter the international code separately,
                    such as +91, +1, +44 or +971.
                </small>
                </div>

                <div className="account-form-group address-field-full">
                  <label htmlFor="address-line-1">
                    Address line 1
                  </label>

                  <input
                    autoComplete="address-line1"
                    id="address-line-1"
                    maxLength={250}
                    minLength={5}
                    onChange={(event) =>
                      updateFormField(
                        "address_line_1",
                        event.target.value,
                      )
                    }
                    placeholder="House number, building and street"
                    required
                    type="text"
                    value={form.address_line_1}
                  />
                </div>

                <div className="account-form-group address-field-full">
                  <label htmlFor="address-line-2">
                    Address line 2
                  </label>

                  <input
                    autoComplete="address-line2"
                    id="address-line-2"
                    maxLength={250}
                    onChange={(event) =>
                      updateFormField(
                        "address_line_2",
                        event.target.value,
                      )
                    }
                    placeholder="Area or neighbourhood"
                    type="text"
                    value={form.address_line_2}
                  />
                </div>

                <div className="account-form-group address-field-full">
                  <label htmlFor="landmark">
                    Landmark
                  </label>

                  <input
                    id="landmark"
                    maxLength={150}
                    onChange={(event) =>
                      updateFormField(
                        "landmark",
                        event.target.value,
                      )
                    }
                    placeholder="Near a known location"
                    type="text"
                    value={form.landmark}
                  />
                </div>

                <div className="account-form-group">
                  <label htmlFor="city">
                    City
                  </label>

                  <input
                    autoComplete="address-level2"
                    id="city"
                    maxLength={100}
                    minLength={2}
                    onChange={(event) =>
                      updateFormField(
                        "city",
                        event.target.value,
                      )
                    }
                    required
                    type="text"
                    value={form.city}
                  />
                </div>

                <div className="account-form-group">
                  <label htmlFor="state">
                    State
                  </label>

                  <input
                    autoComplete="address-level1"
                    id="state"
                    maxLength={100}
                    minLength={2}
                    onChange={(event) =>
                      updateFormField(
                        "state",
                        event.target.value,
                      )
                    }
                    required
                    type="text"
                    value={form.state}
                  />
                </div>

                <div className="account-form-group">
                  <label htmlFor="postal-code">
                    PIN code
                  </label>

                  <input
                    autoComplete="postal-code"
                    id="postal-code"
                    maxLength={20}
                    minLength={4}
                    onChange={(event) =>
                      updateFormField(
                        "postal_code",
                        event.target.value,
                      )
                    }
                    required
                    type="text"
                    value={form.postal_code}
                  />
                </div>

                <div className="account-form-group">
                  <label htmlFor="country">
                    Country
                  </label>

                  <input
                    autoComplete="country-name"
                    id="country"
                    maxLength={100}
                    minLength={2}
                    onChange={(event) =>
                      updateFormField(
                        "country",
                        event.target.value,
                      )
                    }
                    required
                    type="text"
                    value={form.country}
                  />
                </div>
              </div>

              <label className="address-default-checkbox">
                <input
                  checked={form.is_default}
                  onChange={(event) =>
                    updateFormField(
                      "is_default",
                      event.target.checked,
                    )
                  }
                  type="checkbox"
                />

                <span>
                  Use this as my default delivery
                  address
                </span>
              </label>

              <button
                className="account-save-button"
                disabled={isSaving}
                type="submit"
              >
                {isSaving
                  ? "Saving..."
                  : editingAddressId
                    ? "Save address"
                    : "Add address"}
              </button>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}

export default AddressesPage;