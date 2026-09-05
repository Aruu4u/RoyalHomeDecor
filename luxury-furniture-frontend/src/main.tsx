import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import ErrorBoundary from "./components/error/ErrorBoundary";
import ServiceNotice from "./components/error/ServiceNotice";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartProvider";
import { FavouriteProvider } from "./context/FavouriteProvider";
import { isConfigured, missingConfigKeys } from "./lib/env";
import {
  preconnectToImageHost,
  registerImageCache,
} from "./lib/imageDelivery";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

/*
 * Configuration is checked before anything else runs.
 *
 * Without it the app would mount and then fail on the first sign-in or
 * data load, in ways that look like unrelated bugs. Stopping here gives
 * one clear answer instead.
 *
 * The visitor sees the ordinary service notice, with no mention of
 * variables or builds, because a deployment mistake is not their problem
 * to understand. The specific keys go to the console, and in development
 * onto the screen as well, so whoever deployed it can see the cause
 * immediately rather than staring at a blank page.
 */
if (!isConfigured) {
  console.error(
    `Missing build-time configuration: ${missingConfigKeys.join(", ")}.\n` +
      "These are read when the app is BUILT, not when it runs, so adding " +
      "them to the hosting platform requires a fresh deploy before they " +
      "take effect.",
  );

  root.render(
    <StrictMode>
      <ServiceNotice variant="surveillance" />

      {import.meta.env.DEV && (
        <pre
          style={{
            margin: "0 auto 3rem",
            maxWidth: "44rem",
            padding: "1rem 1.25rem",
            borderRadius: "0.5rem",
            background: "#2c241f",
            color: "#ffd9d6",
            fontSize: "0.85rem",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {`Development only — not shown in production.\n\n` +
            `Missing: ${missingConfigKeys.join(", ")}\n\n` +
            `Add these to .env (see .env.example), then restart the dev server.`}
        </pre>
      )}
    </StrictMode>,
  );
} else {
  /*
   * Warm the image host connection before React renders, so the first
   * product photo is not waiting on DNS and TLS, then register the
   * image cache so repeat visits skip the network entirely.
   */
  preconnectToImageHost();
  registerImageCache();

  root.render(
    <StrictMode>
      {/*
        The boundary sits outside the providers so a failure while setting
        up auth, cart or favourites is caught too, rather than taking the
        whole page down to a blank screen.
      */}
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <FavouriteProvider>
              <CartProvider>
                <App />
              </CartProvider>
            </FavouriteProvider>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  );
}
