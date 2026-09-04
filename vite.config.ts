import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { assertProductionSupabaseEnv } from "./src/integrations/supabase/env";

/** Empty Vite env is OK — Sottra Cloud publishable fallbacks are baked in source. */
function supabaseProductionEnvGuard(): Plugin {
  return {
    name: "sottra-supabase-production-env",
    configResolved(config) {
      if (config.command !== "build") return;
      if (config.mode !== "production") return;
      const loaded = loadEnv(config.mode, process.cwd(), "VITE_");
      assertProductionSupabaseEnv({
        url: process.env.VITE_SUPABASE_URL || loaded.VITE_SUPABASE_URL || "",
        publishableKey:
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY || loaded.VITE_SUPABASE_PUBLISHABLE_KEY || "",
        ci: process.env.CI === "true",
        forceProductionVerify: process.env.VERIFY_PRODUCTION_SUPABASE === "1",
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
          ],
          "vendor-charts": ["recharts"],
        },
      },
    },
  },
  plugins: [
    supabaseProductionEnvGuard(),
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-192.png",
        "icons/icon-maskable-512.png",
        "icons/apple-touch-icon.png",
        "icons/icon-32.png",
      ],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,webmanifest,woff2}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api/, /^\/functions/],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-cache", expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
        ],
      },
      manifest: {
        id: "https://sottra.app/",
        name: "Sottra — Quadro immobiliare da una foto",
        short_name: "Sottra",
        lang: "it",
        dir: "ltr",
        description: "Fotografa un edificio: OMI ufficiale di microzona e contesto di zona. Le stime restano stime.",
        theme_color: "#0A0A0F",
        background_color: "#0A0A0F",
        display: "standalone",
        start_url: "/",
        scope: "/",
        orientation: "portrait",
        categories: ["business", "utilities"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
}));
