import { createClient } from "@supabase/supabase-js";

import { supabasePublishableKey, supabaseUrl } from "./env";

/*
 * Placeholders keep `createClient` from throwing when configuration is
 * missing, because it rejects an empty URL or key.
 *
 * Nothing ever calls through them: `main.tsx` checks `isConfigured` and
 * shows a notice instead of mounting the app, so an unconfigured client is
 * created and then left alone. The point is only that constructing it must
 * not throw during module import, which is what previously turned a
 * missing variable into a blank page.
 *
 * `.invalid` is reserved by RFC 2606 and can never resolve, so a stray
 * request would fail locally rather than reaching somebody's real host.
 */
const effectiveUrl = supabaseUrl || "https://unconfigured.invalid";
const effectiveKey = supabasePublishableKey || "unconfigured";

export const supabase = createClient(effectiveUrl, effectiveKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
