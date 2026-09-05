import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";

import "./auth.css";

interface RedirectState {
  from?: { pathname?: string };
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Return the shopper to whatever sent them here. */
  const redirectTo =
    (location.state as RedirectState | null)?.from?.pathname ?? "/";

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setIsSubmitting(true);
    setError(null);

    try {
      await signIn(email.trim(), password);

      navigate(redirectTo, { replace: true });
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "We could not sign you in. Check your details and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="shell auth-page page-enter">
      <div className="auth-card">
        <header className="auth-head">
          <p className="eyebrow">Welcome back</p>

          <h1 className="auth-title">Sign in</h1>

          <p className="auth-subtitle">
            Sign in to track orders, save favourites and check out faster.
          </p>
        </header>

        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}

        <form
          className="auth-form"
          onSubmit={(event) => void handleSubmit(event)}
        >
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
              autoComplete="current-password"
              className="control"
              onChange={(event) => setPassword(event.target.value)}
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
          </label>

          <button
            className="btn btn-primary btn-lg btn-block"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="auth-footer">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
