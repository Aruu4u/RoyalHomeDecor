import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    /*
     * The backend's CORS allowlist is hardcoded to port 4173, so the dev
     * server has to run there for API calls to be accepted. strictPort
     * makes a port clash fail loudly instead of silently moving to 4174
     * and breaking every request with an opaque CORS error.
     */
    port: 4173,
    strictPort: true,
    host: "127.0.0.1",
  },

  preview: {
    port: 4173,
    strictPort: true,
    host: "127.0.0.1",
  },

  build: {
    target: "es2022",
    cssCodeSplit: true,
    /* Warn only for genuinely large chunks now that routes are split. */
    chunkSizeWarningLimit: 700,

    rollupOptions: {
      output: {
        /*
         * Keeping React and Supabase in their own long-lived chunks means
         * a storefront change does not invalidate the vendor cache.
         */
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (
            id.includes("react-router") ||
            id.includes("/react-dom/") ||
            id.includes("/react/")
          ) {
            return "vendor-react";
          }

          if (id.includes("@supabase")) {
            return "vendor-supabase";
          }

          return undefined;
        },
      },
    },
  },
});
