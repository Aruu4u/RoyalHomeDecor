import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { ApiError } from "../../services/api";
import { profileService } from "../../services/profile";

import "./auth.css";

const MIN_PASSWORD_LENGTH = 8;

function SignupPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(
    null,
  );

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const trimmedName = fullName.trim();

    if (trimmedName.length < 2 || trimmedName.length > 150) {
      setError("Enter your full name (2 to 150 characters).");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await signUp(email.trim(), password);

      /*
       * When the project requires email confirmation there is no session
       * yet, so the profile cannot be created until after the first sign
       * in. The account page handles that case.
       */
      if (result.requiresEmailConfirmation) {
        setConfirmationNotice(
          "Check your inbox to confirm your email address, then sign in to finish setting up your profile.",
        );
        return;
      }

      /*
       * The API needs a profile row before cart, address and order calls
       * will work, so it is created immediately after sign-up. A 409
       * means one already exists, which is fine.
       */
      try {
        await profileService.createProfile({
          full_name: trimmedName,
          phone: null,
        });
      } catch (profileError) {
        if (!(profileError instanceof ApiError && profileError.status === 409)) {
          throw profileError;
        }
      }

      navigate("/", { replace: true });
    } catch (signUpError) {
      setError(
        signUpError instanceof Error
          ? signUpError.message
          : "We could not create your account. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="shell auth-page page-enter">
      <div className="auth-card">
        <header className="auth-head">
          <p className="eyebrow">Join us</p>

          <h1 className="auth-title">Create an account</h1>

          <p className="auth-subtitle">
            Save favourites, track orders and check out in a couple of taps.
          </p>
        </header>

        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}

        {confirmationNotice ? (
          <>
            <p className="notice notice-success" role="status">
              {confirmationNotice}
            </p>

            <Link className="btn btn-primary btn-block" to="/login">
              Go to sign in
            </Link>
          </>
        ) : (
          <form
            className="auth-form"
            onSubmit={(event) => void handleSubmit(event)}
          >
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
              <span className="field-label">Email</span>

              <input
                autoComplete="email"
                className="control"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>

            <label className="field">
              <span className="auth-password-row">
                <span className="field-label">Password</span>

                <button
                  className="auth-reveal"
                  onClick={() => setShowPassword((shown) => !shown)}
                  type="button"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>

              <input
                autoComplete="new-password"
                className="control"
                minLength={MIN_PASSWORD_LENGTH}
                onChange={(event) => setPassword(event.target.value)}
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />

              <span className="field-hint">
                At least {MIN_PASSWORD_LENGTH} characters.
              </span>
            </label>

            <button
              className="btn btn-primary btn-lg btn-block"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
          </form>
        )}

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default SignupPage;
