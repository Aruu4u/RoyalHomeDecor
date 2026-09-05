/* =========================================================
   IMAGE CACHE SERVICE WORKER

   Scope is deliberately narrow: this worker caches IMAGES ONLY.

   It never touches HTML, JavaScript, CSS or API responses. That is
   intentional. A service worker that caches the app shell is the usual
   cause of "I changed the code but the browser shows the old version",
   and caching API responses would show shoppers stale prices and stock.
   Images are content-addressed by URL and effectively immutable, so
   they are the safe thing to cache aggressively.

   Strategy: cache-first. A cached image is served without touching the
   network at all, so a reload is instant even on a poor connection.
   ========================================================= */

const CACHE_NAME = "rhd-images-v1";

/* Keeps the cache from growing without bound on a long browsing session. */
const MAX_ENTRIES = 180;

/** Extensions we treat as cacheable imagery. */
const IMAGE_PATTERN = /\.(?:png|jpe?g|webp|avif|gif|svg)(?:\?|$)/i;

self.addEventListener("install", (event) => {
  /* Take over as soon as possible rather than waiting for a tab close. */
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      /* Drop caches from earlier versions of this worker. */
      const names = await caches.keys();

      await Promise.all(
        names
          .filter((name) => name.startsWith("rhd-images-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );

      await self.clients.claim();
    })(),
  );
});

/** True when this request is an image we are willing to cache. */
function isCacheableImage(request) {
  if (request.method !== "GET") {
    return false;
  }

  /*
   * `destination` is the reliable signal in modern browsers; the URL
   * pattern is the fallback for requests that do not set it, such as
   * CSS background-image fetches in some engines.
   */
  if (request.destination === "image") {
    return true;
  }

  return IMAGE_PATTERN.test(new URL(request.url).pathname);
}

/**
 * Trims the cache back under the limit.
 *
 * The Cache API has no ordering guarantees, so this removes an
 * arbitrary slice rather than a true least-recently-used set. Good
 * enough: the goal is bounding growth, not perfect eviction.
 */
async function trimCache(cache) {
  const keys = await cache.keys();

  if (keys.length <= MAX_ENTRIES) {
    return;
  }

  const excess = keys.length - MAX_ENTRIES;

  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (!isCacheableImage(request)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      const cached = await cache.match(request);

      if (cached) {
        return cached;
      }

      try {
        /*
         * An <img> fetches cross-origin in no-cors mode by default,
         * which yields an opaque response (status 0). Opaque responses
         * cannot be written to the cache, so caching would silently
         * never happen.
         *
         * Requesting explicitly in cors mode gives a readable,
         * cacheable response. Supabase Storage sends
         * Access-Control-Allow-Origin: *, so this succeeds there and
         * for anything same-origin. A service worker may respond to a
         * no-cors request with a CORS response, so the image still
         * renders normally.
         */
        const corsResponse = await fetch(
          new Request(request.url, {
            mode: "cors",
            credentials: "omit",
          }),
        ).catch(() => null);

        if (corsResponse && corsResponse.ok && corsResponse.status === 200) {
          await cache.put(request, corsResponse.clone());

          /* Trim in the background; the response is already on its way. */
          event.waitUntil(trimCache(cache));

          return corsResponse;
        }

        /*
         * The host does not permit CORS. Fall back to the original
         * request so the image still displays; it just will not be
         * cached by us, and relies on ordinary HTTP caching instead.
         */
        return await fetch(request);
      } catch (error) {
        /*
         * Offline with nothing cached. Returning a transparent 1x1 GIF
         * keeps the layout intact and lets the app's own placeholder
         * logic take over instead of showing a broken-image icon.
         */
        return new Response(
          Uint8Array.from([
            0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80,
            0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04,
            0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01,
            0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
          ]),
          {
            status: 200,
            headers: { "Content-Type": "image/gif" },
          },
        );
      }
    })(),
  );
});

/* Lets the page ask for the image cache to be cleared. */
self.addEventListener("message", (event) => {
  if (event.data === "clear-image-cache") {
    event.waitUntil(caches.delete(CACHE_NAME));
  }
});
