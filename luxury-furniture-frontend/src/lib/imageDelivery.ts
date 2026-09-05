/* =========================================================
   IMAGE DELIVERY

   Two separate concerns, both aimed at how quickly product
   photography appears:

   1. Connection setup. Images live on a different origin to the app
      (Supabase Storage). The first image therefore pays DNS, TCP and
      TLS before a single byte arrives, which measured at roughly a
      second even for a 6 KB file. Warming that connection early
      removes it from the critical path.

   2. Persistence. A service worker caches images so a reload serves
      them from disk with no network at all.
   ========================================================= */

/**
 * Opens the connection to the image host as early as possible.
 *
 * `preconnect` performs the DNS lookup, TCP handshake and TLS
 * negotiation up front. Because the storage origin is derived from the
 * configured Supabase URL, this stays correct if the project changes.
 */
export function preconnectToImageHost(): void {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  if (!supabaseUrl) {
    return;
  }

  let origin: string;

  try {
    origin = new URL(supabaseUrl).origin;
  } catch {
    return;
  }

  /* Avoid stacking duplicate hints across hot reloads. */
  if (document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) {
    return;
  }

  const preconnect = document.createElement("link");

  preconnect.rel = "preconnect";
  preconnect.href = origin;
  /* Images are CORS requests, so the warmed connection must match. */
  preconnect.crossOrigin = "anonymous";

  document.head.appendChild(preconnect);

  /* dns-prefetch is a cheap fallback for engines ignoring preconnect. */
  const dnsPrefetch = document.createElement("link");

  dnsPrefetch.rel = "dns-prefetch";
  dnsPrefetch.href = origin;

  document.head.appendChild(dnsPrefetch);
}

/**
 * Registers the image-caching service worker.
 *
 * The worker only handles image requests, never the app shell or API
 * calls, so it cannot serve stale code or stale prices. Registration
 * failure is non-fatal: without it images simply fall back to ordinary
 * HTTP caching, which the storage host already allows for a year.
 */
export function registerImageCache(): void {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  /*
   * Production only, on purpose.
   *
   * In development the worker adds an extra fetch hop per image and
   * sits between the browser and Vite, which makes performance
   * problems harder to reason about. It also is not needed there:
   * the storage host already sends a one-year Cache-Control, so
   * repeat loads come from the browser's own disk cache regardless.
   */
  if (!import.meta.env.PROD) {
    return;
  }

  /*
   * Registered after load so it never competes with the first paint
   * for bandwidth or main-thread time.
   */
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Image cache unavailable:", error);
    });
  });
}

/** Clears cached imagery, for use after replacing files in public/images. */
export async function clearImageCache(): Promise<void> {
  const registration = await navigator.serviceWorker?.ready;

  registration?.active?.postMessage("clear-image-cache");
}
