/* =========================================================
   CUSTOM SITE IMAGES

   This is the one file to edit to use your own photography for the
   home page hero, the workshop section and the collection cards.

   HOW TO ADD AN IMAGE
   ---------------------------------------------------------
   1. Put the file in:  public/images/
   2. Reference it below as:  "/images/your-file.jpg"
      (the path always starts with /images/, not public/)
   3. Save. The dev server picks it up immediately.

   Anything in public/ is served as-is, so no import or rebuild
   wiring is needed and the filename you choose is the URL.

   IF A FILE IS MISSING OR MISNAMED
   ---------------------------------------------------------
   Nothing breaks. Each slot falls back, in order, to:
   your image -> the matching catalogue image -> a branded
   placeholder. So a typo shows the old behaviour rather than a
   broken image icon.

   Set a value to null to ignore it and use catalogue imagery.

   RECOMMENDED SIZES
   ---------------------------------------------------------
   hero      2400 x 1350 or wider, landscape. This one fills the
             whole banner, so it needs the most resolution.
   workshop  1200 x 1500, portrait (it sits in a 4:5 frame).
   collection  900 x 1200, portrait (3:4 frame).

   Save as JPEG at around 80% quality, or WebP if you can. Keep
   each file under roughly 400 KB so the page stays quick.
   ========================================================= */

export interface SiteImages {
  /** Full-bleed background behind the home page headline. */
  hero: string | null;

  /** Portrait image beside the "Six pairs of hands" copy. */
  workshop: string | null;

  /** Background for the shop and collection page banners. */
  shopBanner: string | null;

  /**
   * Per-collection card art, keyed by the collection's slug.
   * The slug is what appears in the URL, e.g. /collections/mirrors.
   */
  collections: Record<string, string>;
}

export const SITE_IMAGES: SiteImages = {
  /*
   * Drop a file at public/images/hero.jpg and this works as-is.
   * Change the extension here if yours is a .png or .webp.
   */
  hero: "/images/hero.jpg",

  workshop: "/images/workshop.jpg",

  shopBanner: "/images/shop-banner.jpg",

  /*
   * Your current collection slugs are listed below. Add a file at each
   * path to override that card, or delete a line to keep using the
   * image already set on the collection in the admin area.
   */
  collections: {
    "arched-brass-mirror": "/images/collections/arched-brass-mirror.jpg",
    mirrors: "/images/collections/mirrors.jpg",
    "dining-tables": "/images/collections/dining-tables.jpg",
    "wall-decor": "/images/collections/wall-decor.jpg",
    tables: "/images/collections/tables.jpg",
  },
};

/** Custom art for one collection, or null when none is configured. */
export function customCollectionImage(slug: string): string | null {
  return SITE_IMAGES.collections[slug] ?? null;
}

/**
 * Builds a candidate list with any custom image first.
 *
 * Callers pass the catalogue URLs they would otherwise have used; the
 * custom entry simply takes priority, and everything still degrades in
 * order if a file is absent.
 */
export function withCustomFirst(
  custom: string | null,
  fallbacks: Array<string | null | undefined>,
): Array<string | null | undefined> {
  return custom ? [custom, ...fallbacks] : fallbacks;
}
