// Lovable may regenerate a default createClient() here — keep lazy init + fallbacks.
// Top-level createClient(undefined) throws `supabaseUrl is required` and blanks the page.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { brokeredPreviewStorage } from "./previewAuthStorage";
import { getSupabaseBootError } from "./env";

type SottraSupabase = SupabaseClient<Database>;

let client: SottraSupabase | undefined;

function createUnavailableClient(reason: string): SottraSupabase {
  const auth = {
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe() {} } },
    }),
    getSession: async () => ({
      data: { session: null },
      error: { message: reason, name: "AuthError", status: 0 },
    }),
    getUser: async () => ({
      data: { user: null },
      error: { message: reason, name: "AuthError", status: 0 },
    }),
    signOut: async () => ({ error: null }),
    signInWithPassword: async () => {
      throw new Error(reason);
    },
    signUp: async () => {
      throw new Error(reason);
    },
    resetPasswordForEmail: async () => {
      throw new Error(reason);
    },
    updateUser: async () => {
      throw new Error(reason);
    },
    setSession: async () => {
      throw new Error(reason);
    },
  };

  const nest = (): unknown =>
    new Proxy(
      () => {
        throw new Error(reason);
      },
      {
        get(_target, prop) {
          if (prop === "then") return undefined;
          if (prop === "unsubscribe") return () => undefined;
          return nest();
        },
        apply() {
          throw new Error(reason);
        },
      },
    );

  return new Proxy({} as SottraSupabase, {
    get(_target, prop) {
      if (prop === "then") return undefined;
      if (prop === "auth") return auth;
      return nest();
    },
  });
}

/**
 * Prefer Vite env when Lovable actually injects it. If publish leaves
 * VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY empty, use the known
 * Sottra Lovable Cloud publishable values (anon key is public-by-design).
 */
const FALLBACK_SUPABASE_URL = "https://vveunbxfcfhnkkhrqutf.supabase.co";
const FALLBACK_SUPABASE_PROJECT_ID = "vveunbxfcfhnkkhrqutf";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2ZXVuYnhmY2ZobmtraHJxdXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NzI4MjMsImV4cCI6MjA4ODQ0ODgyM30.TrEbZx-Jz7n2q_uiC1j_vWVU_SRwKjpvA9EBRXqw1pg";

function resolveClientConfig(): { url: string; publishableKey: string; projectId: string } {
  const envUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  const envKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  const envProjectId = String(import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "").trim();
  return {
    url: envUrl || FALLBACK_SUPABASE_URL,
    publishableKey: envKey || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
    projectId: envProjectId || FALLBACK_SUPABASE_PROJECT_ID,
  };
}

function getSupabaseClient(): SottraSupabase {
  if (client) return client;

  const bootError = getSupabaseBootError();
  if (bootError) {
    console.error("[Sottra] Supabase client not initialized:", bootError);
    client = createUnavailableClient(bootError);
    return client;
  }

  try {
    const { url, publishableKey } = resolveClientConfig();
    client = createClient<Database>(url, publishableKey, {
      auth: {
        storage: brokeredPreviewStorage(),
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return client;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Supabase init failed";
    console.error("[Sottra] Supabase createClient failed:", err);
    client = createUnavailableClient(reason);
    return client;
  }
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase: SottraSupabase = new Proxy({} as SottraSupabase, {
  get(_target, prop, _receiver) {
    const real = getSupabaseClient();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
