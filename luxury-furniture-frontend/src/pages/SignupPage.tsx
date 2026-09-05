import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../services/api";
import { profileService } from "../services/profile";
import "./auth.css";

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAuthSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await signUp(email.trim(), password);

      if (result.requiresEmailConfirmation) {
        setConfirmationSent(true);
        return;
      }

      try {
        await profileService.getProfile();
        navigate("/", { replace: true });
      } catch (requestError) {
        if (requestError instanceof ApiError && requestError.status === 404) {
          setStep(2);
          return;
        }

        throw requestError;
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create your account.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleProfileSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await profileService.createProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
      });

      navigate("/", { replace: true });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to complete your profile.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (confirmationSent) {
    return (
      <main className="auth-page">
        <section className="auth-container" aria-live="polite">
          <p className="eyebrow">Account created</p>
          <h1>Check your email</h1>
          <p className="auth-subtitle">
            We sent a confirmation link to <strong>{email}</strong>.
            Confirm your email, then sign in to complete your profile.
          </p>
          <Link className="primary-button full-width" to="/login">
            Go to sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-container">
        <h1>{step === 1 ? "Create Account" : "Complete Profile"}</h1>
        <p className="auth-subtitle">
          {step === 1
            ? "Join Royal Home Decor"
            : "Add the details needed for your orders and deliveries."}
        </p>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <div className="form-group">
              <label htmlFor="signup-email">Email</label>
              <input
                autoComplete="email"
                disabled={isSubmitting}
                id="signup-email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </div>

            <div className="form-group">
              <label htmlFor="signup-password">Password</label>
              <input
                autoComplete="new-password"
                disabled={isSubmitting}
                id="signup-password"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>

            <button
              className="primary-button full-width"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Creating account..." : "Continue"}
            </button>

            <div className="auth-links">
              <p>
                Already have an account? <Link to="/login">Sign in</Link>
              </p>
            </div>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleProfileSubmit}>
            <div className="form-group">
              <label htmlFor="full-name">Full name</label>
              <input
                autoComplete="name"
                disabled={isSubmitting}
                id="full-name"
                onChange={(event) => setFullName(event.target.value)}
                required
                type="text"
                value={fullName}
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone number</label>
              <input
                autoComplete="tel"
                disabled={isSubmitting}
                id="phone"
                inputMode="tel"
                maxLength={15}
                minLength={10}
                onChange={(event) => setPhone(event.target.value)}
                required
                type="tel"
                value={phone}
              />
            </div>

            <button
              className="primary-button full-width"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Saving..." : "Complete signup"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
