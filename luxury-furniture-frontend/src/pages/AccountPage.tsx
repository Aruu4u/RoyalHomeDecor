import { useEffect, useState } from "react";

import { AccountSidebar } from "../components/account/AccountSidebar";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { ApiError } from "../services/api";
import { profileService } from "../services/profile";
import type { Profile } from "../types/profile";

function AccountPage() {
  const { user } = useAuth();
  const { refreshCart } = useCart();

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isProfileCreated, setIsProfileCreated] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadProfile(): Promise<void> {
      try {
        const profileData =
          await profileService.getProfile();

        if (!isActive) {
          return;
        }

        setProfile(profileData);
        setFullName(profileData.full_name);
        setPhone(profileData.phone ?? "");
        setIsProfileCreated(true);
      } catch (requestError) {
        if (!isActive) {
          return;
        }

        if (
          requestError instanceof ApiError &&
          requestError.status === 404
        ) {
          const metadataName =
            typeof user?.user_metadata.full_name ===
            "string"
              ? user.user_metadata.full_name
              : "";

          setFullName(metadataName);
          setIsProfileCreated(false);
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load your account.",
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [user]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const wasCreatingProfile =
      !isProfileCreated;

    setError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      const savedProfile = wasCreatingProfile
        ? await profileService.createProfile({
            full_name: fullName.trim(),
            phone: phone.trim(),
          })
        : await profileService.updateProfile({
            full_name: fullName.trim(),
            phone: phone.trim(),
          });

      setProfile(savedProfile);
      setFullName(savedProfile.full_name);
      setPhone(savedProfile.phone ?? "");
      setIsProfileCreated(true);

      if (wasCreatingProfile) {
        await refreshCart();
      }

      setSuccessMessage(
        wasCreatingProfile
          ? "Profile created successfully."
          : "Profile updated successfully.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save your profile.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="account-page">
        <p>Loading your account...</p>
      </main>
    );
  }

  return (
    <main className="account-page">
      <section className="account-heading">
        <p className="eyebrow">My account</p>

        <h1>Welcome to Royal Home Decor</h1>

        <p>
          Manage your personal details, addresses
          and orders from your account.
        </p>
      </section>

      <div className="account-layout">
        <AccountSidebar onError={setError} />

        <section className="account-panel">
          <div className="account-panel-heading">
            <h2>
              {isProfileCreated
                ? "Personal information"
                : "Complete your profile"}
            </h2>

            <p>
              Signed in as{" "}
              <strong>{user?.email}</strong>
            </p>
          </div>

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

          <form
            className="account-form"
            onSubmit={handleSubmit}
          >
            <div className="account-form-group">
              <label htmlFor="full-name">
                Full name
              </label>

              <input
                autoComplete="name"
                id="full-name"
                minLength={2}
                onChange={(event) =>
                  setFullName(event.target.value)
                }
                required
                type="text"
                value={fullName}
              />
            </div>

            <div className="account-form-group">
              <label htmlFor="phone">
                Phone number
              </label>

              <input
                autoComplete="tel"
                id="phone"
                minLength={8}
                onChange={(event) =>
                  setPhone(event.target.value)
                }
                placeholder="9876543210"
                required
                type="tel"
                value={phone}
              />
            </div>

            <button
              className="account-save-button"
              disabled={isSaving}
              type="submit"
            >
              {isSaving
                ? "Saving..."
                : isProfileCreated
                  ? "Save changes"
                  : "Create profile"}
            </button>
          </form>

          {profile && (
            <p className="account-created-date">
              Account profile created{" "}
              {new Date(
                profile.created_at,
              ).toLocaleDateString("en-IN")}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

export default AccountPage;