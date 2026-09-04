import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/** Non-secret placeholders so Vitest can import createClient without a committed `.env`.
 *  A local Lovable `.env` is expected on developer machines; CI has none. */
const TEST_VITE_ENV = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  VITE_SUPABASE_PROJECT_ID: "test-project-id",
  VITE_USE_MOCK: "false",
} as const;

for (const [key, value] of Object.entries(TEST_VITE_ENV)) {
  if (!process.env[key]) process.env[key] = value;
}

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? TEST_VITE_ENV.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY:
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? TEST_VITE_ENV.VITE_SUPABASE_PUBLISHABLE_KEY,
      VITE_SUPABASE_PROJECT_ID:
        process.env.VITE_SUPABASE_PROJECT_ID ?? TEST_VITE_ENV.VITE_SUPABASE_PROJECT_ID,
      VITE_USE_MOCK: process.env.VITE_USE_MOCK ?? TEST_VITE_ENV.VITE_USE_MOCK,
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
