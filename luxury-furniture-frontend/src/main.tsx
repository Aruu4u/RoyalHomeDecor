import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import ErrorBoundary from "./components/error/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartProvider";
import { FavouriteProvider } from "./context/FavouriteProvider";
import {
  preconnectToImageHost,
  registerImageCache,
} from "./lib/imageDelivery";
import "./index.css";

/*
 * Warm the image host connection before React renders, so the first
 * product photo is not waiting on DNS and TLS, then register the
 * image cache so repeat visits skip the network entirely.
 */
preconnectToImageHost();
registerImageCache();

createRoot(document.getElementById("root")!).render(
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
