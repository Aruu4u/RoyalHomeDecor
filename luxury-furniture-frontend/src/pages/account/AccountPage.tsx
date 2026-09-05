import { useCallback, useEffect, useState } from "react";

import AccountNav from "../../components/account/AccountNav";
import { PageLoader } from "../../components/ui/Feedback";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../hooks/useAuth";
import { ApiError } from "../../services/api";
import { profileService } from "../../services/profile";
import type { Profile } from "../../types/profile";

import "./account.css";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function AccountPage() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  /*
   * A 404 from /profile means the row has not been created yet, which is
   * the normal state straight after sign-up. It is handled as "create
   * mode" rather than an error.
   */
  const {
    data: loadedProfile,
    isLoading,
    error,
  } = useAsync(
    useCallback(async () => {
      try {
        return await profileService.getProfile();
      } catch (requestError) {
        if (requestError instanceof ApiError && requestError.status === 404) {
          return null;
        }

        throw requestError;
      }
    }, []),
    [],
    "Unable to load your profile.",
  );

  /* Seed the form once the profile request settles. */
  useEffect(() => {
    if (loadedProfile) {
      setProfile(loadedProfile);
      setFullName(loadedProfile.full_name);
      setPhone(loadedProfile.phone ?? "");
    }
  }, [loadedProfile]);

  const hasProfile = profile !== null;

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();

    if (trimmedName.length < 2 || trimmedName.length > 150) {
      setMessage({
        text: "Enter your full name (2 to 150 characters).",
        isError: true,
      });
      return;
    }

    if (trimmedPhone !== "" && (trimmedPhone.length < 8 || trimmedPhone.length > 20)) {
      setMessage({
        text: "Enter a contact number between 8 and 20 characters.",
        isError: true,
      });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const payload = {
        full_name: trimmedName,
        phone: trimmedPhone === "" ? null : trimmedPhone,
      };

      const saved = hasProfile
        ? await profileService.updateProfile(payload)
        : await profileService.createProfile({
            full_name: payload.full_name,
            phone: payload.phone,
          });

      setProfile(saved);
      setFullName(saved.full_name);
      setPhone(saved.phone ?? "");

      setMessage({
        text: hasProfile
          ? "Your profile has been updated."
          : "Your profile is ready. You can now place orders.",
        isError: false,
      });
    } catch (saveError) {
      setMessage({
        text:
          saveError instanceof Error
            ? saveError.message
            : "Unable to save your profile.",
        isError: true,
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <PageLoader label="Loading your account" />;
  }

  return (
    <div className="shell account-page page-enter">
      <header className="account-header">
        <p className="eyebrow">Your account</p>

        <h1 className="account-title">
          {profile?.full_name ?? "Welcome"}
        </h1>

        <p className="lede account-subtitle">
          {hasProfile
            ? "Manage your details, delivery addresses and order history."
            : "Add your name and contact number to finish setting up your account."}
        </p>
      </header>

      <div className="account-layout">
        <AccountNav />

        <div className="account-content">
          <section className="panel">
            <header className="account-panel-head">
              <div>
                <h2 className="account-panel-title">
                  {hasProfile ? "Profile details" : "Create your profile"}
                </h2>

                <p className="account-panel-subtitle">
                  Used on your orders and for delivery updates.
                </p>
              </div>
            </header>

            {error && (
              <p className="notice notice-error" role="alert">
                {error}
              </p>
            )}

            {message && (
              <p
                className={`notice ${
                  message.isError ? "notice-error" : "notice-success"
                }`}
                role="status"
              >
                {message.text}
              </p>
            )}

            <form
              className="account-form"
              noValidate
              onSubmit={(event) => void handleSubmit(event)}
            >
              <div className="account-form-grid">
                <label className="field">
                  <span className="field-label">Full name</span>

                  <input
                    autoComplete="name"
                    className="control"
                    maxLength={150}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    value={fullName}
                  />
                </label>

                <label className="field">
                  <span className="field-label">
                    Phone <span className="field-hint">(optional)</span>
                  </span>

                  <input
                    autoComplete="tel"
                    className="control"
                    inputMode="tel"
                    maxLength={20}
                    onChange={(event) => setPhone(event.target.value)}
                    value={phone}
                  />
                </label>

                <label className="field">
                  <span className="field-label">Email</span>

                  <input
                    className="control"
                    disabled
                    value={user?.email ?? ""}
                  />

                  <span className="field-hint">
                    Managed by your sign-in provider.
                  </span>
                </label>
              </div>

              <button
                className="btn btn-primary"
                disabled={isSaving}
                type="submit"
              >
                {isSaving
                  ? "Saving..."
                  : hasProfile
                    ? "Save changes"
                    : "Create profile"}
              </button>
            </form>

            {profile && (
              <p className="account-meta">
                Account created {formatDate(profile.created_at)}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default AccountPage;
