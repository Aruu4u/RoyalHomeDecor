/*
 * Fails the build when required VITE_ variables are missing.
 *
 * Why this exists
 * ---------------
 * `VITE_*` values are substituted into the bundle at build time. A missing
 * one therefore cannot be fixed by restarting or by adding the variable
 * afterwards: the deployed JavaScript already has the gap baked in.
 *
 * Without this check the build succeeds, the deploy goes green, and the
 * fault only appears when somebody opens the site. Worse, the build log
 * looks identical either way, so there is nothing to diagnose from.
 *
 * Failing here is the safer outcome. A failed deploy leaves the previous
 * working version serving traffic, whereas a successful deploy of a broken
 * bundle takes the storefront down.
 *
 * `loadEnv` is Vite's own loader, so this sees exactly what Vite will
 * inline: `.env` files for local development, and platform environment
 * variables on a host such as Vercel.
 */

import { loadEnv } from "vite";

const REQUIRED = [
  {
    key: "VITE_SUPABASE_URL",
    purpose: "Sign-in and image uploads",
    example: "https://abcdefghijk.supabase.co",
  },
  {
    key: "VITE_SUPABASE_PUBLISHABLE_KEY",
    purpose: "Sign-in and image uploads",
    example: "eyJhbGciOi... (the anon / publishable key)",
  },
];

/*
 * Not required. It defaults to /api/v1, which is correct whenever the API
 * and the storefront share a domain. Reported only so the log records
 * which base URL the bundle was built against.
 */
const OPTIONAL = [{ key: "VITE_API_BASE_URL", fallback: "/api/v1" }];

const mode = process.env.NODE_ENV || "production";
const env = loadEnv(mode, process.cwd(), "VITE_");

const value = (key) => (env[key] ?? "").trim();

const missing = REQUIRED.filter(({ key }) => !value(key));

const line = "-".repeat(68);

if (missing.length > 0) {
  console.error(`\n${line}`);
  console.error("  BUILD STOPPED - required configuration is missing");
  console.error(line);
  console.error(
    "\n  These are read when the app is BUILT, so the bundle cannot work",
  );
  console.error("  without them. Nothing has been deployed.\n");

  for (const { key, purpose, example } of missing) {
    console.error(`    x ${key}`);
    console.error(`        needed for : ${purpose}`);
    console.error(`        example    : ${example}\n`);
  }

  console.error("  On Vercel:");
  console.error("    Settings -> Environment Variables -> add each one,");
  console.error("    ticking Production, Preview AND Development,");
  console.error("    then redeploy with the build cache disabled.\n");
  console.error("  Locally:");
  console.error(
    "    copy .env.example to .env and fill it in, then build again.\n",
  );
  console.error(`${line}\n`);

  process.exit(1);
}

/* Recorded in the build log so a wrong value is visible after the fact. */
console.log("Configuration check passed:");

for (const { key } of REQUIRED) {
  const raw = value(key);

  /*
   * Only the shape is logged, never the value. Build logs are retained and
   * often shared, and although these are publishable keys, printing
   * credentials into a log is a habit worth not forming.
   */
  const shown =
    raw.startsWith("http") ? new URL(raw).host : `${raw.length} characters`;

  console.log(`  ok  ${key}  (${shown})`);
}

for (const { key, fallback } of OPTIONAL) {
  const raw = value(key);

  console.log(`  ok  ${key}  (${raw || `not set, using ${fallback}`})`);
}

console.log("");
