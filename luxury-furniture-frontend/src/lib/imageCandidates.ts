/*
 * Helpers for choosing a usable image out of catalogue data.
 *
 * Not every URL in the catalogue points at real artwork: some rows still
 * carry placeholder-service links or hosts that do not resolve. Those
 * load "successfully" (or hang) yet look broken on a hero, so they are
 * filtered out before any network work happens.
 */

const PLACEHOLDER_PATTERNS = [
  "placehold.co",
  "placeholder.com",
  "via.placeholder",
  "placekitten",
  "dummyimage",
  "example.com",
  "example.org",
  "images.example",
];

/** True when a URL is a stand-in rather than real photography. */
export function isLikelyPlaceholder(url: string | null | undefined): boolean {
  if (!url) {
    return true;
  }

  const lower = url.toLowerCase();

  return PLACEHOLDER_PATTERNS.some((pattern) => lower.includes(pattern));
}

/** Keeps only real, non-placeholder image URLs, preserving order. */
export function usableImageUrls(
  urls: Array<string | null | undefined>,
): string[] {
  const seen = new Set<string>();

  for (const url of urls) {
    if (!isLikelyPlaceholder(url) && url) {
      seen.add(url);
    }
  }

  return [...seen];
}
