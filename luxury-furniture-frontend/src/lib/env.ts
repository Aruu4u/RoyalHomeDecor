/* =========================================================
   BUILD-TIME CONFIGURATION

   Every `VITE_*` value is substituted into the bundle when Vite builds,
   not read at runtime. Two consequences worth remembering:

     * A variable added after a build has no effect until you build
       again.
     * Anything with a `VITE_` prefix ships to the browser and is
       readable by anyone. Publishable keys only, never a service role
       key.

   Nothing in this module throws.

   It used to. `api.ts` and `supabase.ts` each ended with a bare
   `if (!value) throw ...` at module scope, and a missing variable let the
   minifier prove the branch always ran, so the shipped chunk began:

       import "./vendor-supabase.js";
       throw Error("VITE_SUPABASE_URL is not configured.");

   That throw fires while modules are still being imported, before
   `createRoot().render()` is reached. React never mounts, so the error
   boundary cannot catch it and the visitor gets a blank page with no clue
   what is wrong. Collecting the problems instead lets the app decide what
   to show.
   ========================================================= */

function read(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/*
 * Defaults to a relative path, which is correct whenever the API and the
 * storefront share a domain, as they do in the single Vercel project.
 * A relative URL resolves against the current origin, so this also keeps
 * working on preview deployments, whose hostname changes every time.
 *
 * Set the variable explicitly for local development, where the API is on
 * a different port, or if the API ever moves to its own domain.
 */
export const apiBaseUrl = read(import.meta.env.VITE_API_BASE_URL) || "/api/v1";

export const supabaseUrl = read(import.meta.env.VITE_SUPABASE_URL);

export const supabasePublishableKey = read(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

/*
 * Variables with no safe default. Sign-in and image uploads cannot work
 * without them, so the app refuses to start rather than failing later in
 * ways that look like unrelated bugs.
 */
export const missingConfigKeys: string[] = [
  ...(supabaseUrl ? [] : ["VITE_SUPABASE_URL"]),
  ...(supabasePublishableKey ? [] : ["VITE_SUPABASE_PUBLISHABLE_KEY"]),
];

export const isConfigured = missingConfigKeys.length === 0;
