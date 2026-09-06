import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

/*
 * The React entry point, not the Next.js one.
 *
 * Vercel's setup screen shows `@vercel/analytics/next`, which only works
 * in a Next.js app. This project is Vite plus React Router, so importing
 * that path fails to resolve. The package ships a separate entry for each
 * framework; `/react` is ours.
 */
import { Analytics } from "@vercel/analytics/react";

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
        {/*
          Renders nothing: it injects Vercel's analytics script, which then
          follows history changes on its own, so client-side navigation is
          counted without any router wiring.

          Placed inside the boundary but outside the router. Inside the
          boundary, because a fault in a page-view counter should show the
          notice rather than blank the storefront. Outside the router,
          because it needs no routing context, and nesting it there would
          imply a dependency it does not have.

          It is inert during local development, reporting to the console
          instead of sending anything.
        */}
        <Analytics />

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
