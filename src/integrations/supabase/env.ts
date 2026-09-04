/**
 * Publishable Supabase env — used at runtime (boot gate) and at build time
 * (vite production guard). Never throws at module load.
 *
 * Production publish (Lovable) must set:
 *   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
 *   VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
 * Do not commit `.env`. CI may use https://example.supabase.co for tests only.
 */

export const SUPABASE_PLACEHOLDER_HOSTS = [
  "example.supabase.co",
  "your-project.supabase.co",
] as const;

/** Italian copy shown via ErrorBoundary / main.tsx when the client cannot boot. */
export const SUPABASE_BOOT_ERROR_IT = {
  missingUrl:
    "Impossibile avviare Sottra: manca l'indirizzo del backend. Ricarica dopo il prossimo aggiornamento.",
  invalidUrl:
    "Impossibile avviare Sottra: indirizzo del backend non valido. Ricarica dopo il prossimo aggiornamento.",
  placeholder:
    "Impossibile avviare Sottra: configurazione di test al posto del backend reale. Ricarica dopo il prossimo aggiornamento.",
  missingKey:
    "Impossibile avviare Sottra: manca la chiave pubblica del backend. Ricarica dopo il prossimo aggiornamento.",
} as const;

export type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

export type SupabaseEnvEvaluation =
  | { ok: true }
  | { ok: false; code: "missing_url" | "invalid_url" | "placeholder" | "missing_key"; message: string };

export function normalizeSupabaseUrl(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

export function isPlaceholderSupabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (SUPABASE_PLACEHOLDER_HOSTS as readonly string[]).includes(host);
  } catch {
    return false;
  }
}

/** https://<project-ref>.supabase.co — rejects empty, relative, and non-https values. */
export function isValidSupabaseProjectUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.supabase\.co$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Shared evaluation for runtime boot and production packaging.
 * `allowPlaceholders` is true for Vitest / CI test packaging only.
 */
export function evaluateSupabasePublicEnv(
  env: SupabasePublicEnv,
  options: { allowPlaceholders: boolean },
): SupabaseEnvEvaluation {
  const url = normalizeSupabaseUrl(env.url);
  const key = typeof env.publishableKey === "string" ? env.publishableKey.trim() : "";

  if (!url) {
    return { ok: false, code: "missing_url", message: SUPABASE_BOOT_ERROR_IT.missingUrl };
  }
  if (!isValidSupabaseProjectUrl(url)) {
    return { ok: false, code: "invalid_url", message: SUPABASE_BOOT_ERROR_IT.invalidUrl };
  }
  if (!options.allowPlaceholders && isPlaceholderSupabaseUrl(url)) {
    return { ok: false, code: "placeholder", message: SUPABASE_BOOT_ERROR_IT.placeholder };
  }
  if (!key) {
    return { ok: false, code: "missing_key", message: SUPABASE_BOOT_ERROR_IT.missingKey };
  }
  return { ok: true };
}

/** True in Vite/Vitest unit tests so placeholders from vitest.config.ts are accepted. */
export function allowSupabasePlaceholdersAtRuntime(): boolean {
  return import.meta.env.DEV === true || import.meta.env.MODE === "test";
}

/**
 * Runtime boot check. Returns Italian copy or null.
 * Must not throw — callers decide whether to surface ErrorBoundary.
 */
export function getSupabaseBootError(): string | null {
  const result = evaluateSupabasePublicEnv(
    {
      url: String(import.meta.env.VITE_SUPABASE_URL ?? ""),
      publishableKey: String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ""),
    },
    { allowPlaceholders: allowSupabasePlaceholdersAtRuntime() },
  );
  return result.ok ? null : result.message;
}

const BUILD_MISSING_URL =
  "[Sottra] Production build blocked: VITE_SUPABASE_URL is empty. Lovable publish must set VITE_SUPABASE_URL=https://<project-ref>.supabase.co (and VITE_SUPABASE_PUBLISHABLE_KEY) then rebuild. Do not ship an empty bundle.";

const BUILD_INVALID_URL =
  "[Sottra] Production build blocked: VITE_SUPABASE_URL must be https://<project-ref>.supabase.co";

const BUILD_PLACEHOLDER =
  "[Sottra] Production build blocked: VITE_SUPABASE_URL is a CI/test placeholder (https://example.supabase.co). Set the real project URL for production packaging. CI test builds may keep placeholders when CI=true.";

const BUILD_MISSING_KEY =
  "[Sottra] Production build blocked: VITE_SUPABASE_PUBLISHABLE_KEY is empty. Lovable publish must set the publishable (anon) key and rebuild.";

/**
 * Fail a production `vite build` when publishable env cannot be shipped.
 * CI test packaging (CI=true, VERIFY_PRODUCTION_SUPABASE unset) may use placeholders.
 * Empty URL always fails — that is the sottra.app black-screen root cause.
 */
export function assertProductionSupabaseEnv(input: {
  url: string;
  publishableKey: string;
  ci: boolean;
  forceProductionVerify: boolean;
}): void {
  const url = normalizeSupabaseUrl(input.url);
  const key = typeof input.publishableKey === "string" ? input.publishableKey.trim() : "";
  const allowPlaceholders = input.ci && !input.forceProductionVerify;

  if (!url) {
    throw new Error(BUILD_MISSING_URL);
  }
  if (!isValidSupabaseProjectUrl(url)) {
    throw new Error(BUILD_INVALID_URL);
  }
  if (!allowPlaceholders && isPlaceholderSupabaseUrl(url)) {
    throw new Error(BUILD_PLACEHOLDER);
  }
  if (!key) {
    throw new Error(BUILD_MISSING_KEY);
  }
}
