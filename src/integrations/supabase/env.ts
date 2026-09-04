/**
 * Publishable Supabase env — used at runtime (boot gate) and at build time
 * (vite production guard). Never throws at module load.
 *
 * Lovable publish has shipped bundles with empty `import.meta.env.VITE_*`.
 * Source fallbacks below are the Sottra Lovable Cloud project (anon key is
 * public-by-design). Prefer Vite env when present; use these when empty.
 * Do not commit `.env`.
 */

export const SUPABASE_PLACEHOLDER_HOSTS = [
  "example.supabase.co",
  "your-project.supabase.co",
] as const;

/** Sottra Lovable Cloud — publishable (anon) credentials for empty Vite env. */
export const SOTTRA_CLOUD_SUPABASE = {
  url: "https://vveunbxfcfhnkkhrqutf.supabase.co",
  projectId: "vveunbxfcfhnkkhrqutf",
  publishableKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2ZXVuYnhmY2ZobmtraHJxdXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NzI4MjMsImV4cCI6MjA4ODQ0ODgyM30.TrEbZx-Jz7n2q_uiC1j_vWVU_SRwKjpvA9EBRXqw1pg",
} as const;

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
  projectId?: string;
};

export type ResolvedSupabasePublicEnv = {
  url: string;
  publishableKey: string;
  projectId: string;
  source: "env" | "fallback";
};

export type SupabaseEnvErrorCode = "missing_url" | "invalid_url" | "placeholder" | "missing_key";

export type SupabaseEnvEvaluation = {
  ok: boolean;
  code?: SupabaseEnvErrorCode;
  message?: string;
};

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
 * Shared evaluation for explicit env values (no source fallback).
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

/** Prefer Vite env when non-empty; otherwise Sottra Cloud publishable fallbacks. */
export function resolveSupabasePublicConfig(env: SupabasePublicEnv): ResolvedSupabasePublicEnv {
  const envUrl = normalizeSupabaseUrl(env.url);
  const envKey = typeof env.publishableKey === "string" ? env.publishableKey.trim() : "";
  const envProjectId = typeof env.projectId === "string" ? env.projectId.trim() : "";
  const usedEnv = Boolean(envUrl && envKey);
  return {
    url: envUrl || SOTTRA_CLOUD_SUPABASE.url,
    publishableKey: envKey || SOTTRA_CLOUD_SUPABASE.publishableKey,
    projectId: envProjectId || SOTTRA_CLOUD_SUPABASE.projectId,
    source: usedEnv ? "env" : "fallback",
  };
}

/** import.meta.env accessor that also typechecks under the node tsconfig. */
function viteEnv(): Record<string, unknown> {
  const meta = import.meta as unknown as { env?: Record<string, unknown> };
  return meta.env ?? {};
}

export function readViteSupabaseEnv(): SupabasePublicEnv {
  const env = viteEnv();
  return {
    url: String(env.VITE_SUPABASE_URL ?? ""),
    publishableKey: String(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ""),
    projectId: String(env.VITE_SUPABASE_PROJECT_ID ?? ""),
  };
}

export function resolveViteSupabaseConfig(): ResolvedSupabasePublicEnv {
  return resolveSupabasePublicConfig(readViteSupabaseEnv());
}

/** True in Vite/Vitest unit tests so placeholders from vitest.config.ts are accepted. */
export function allowSupabasePlaceholdersAtRuntime(): boolean {
  const env = viteEnv();
  return env.DEV === true || env.MODE === "test";
}

/**
 * Runtime boot check against the *resolved* config (env or source fallback).
 * Must not throw — callers decide whether to surface ErrorBoundary.
 */
export function getSupabaseBootError(): string | null {
  const resolved = resolveViteSupabaseConfig();
  const result = evaluateSupabasePublicEnv(resolved, {
    allowPlaceholders: allowSupabasePlaceholdersAtRuntime(),
  });
  return result.ok ? null : (result.message ?? SUPABASE_BOOT_ERROR_IT.missingUrl);
}

const BUILD_INVALID_URL =
  "[Sottra] Production build blocked: VITE_SUPABASE_URL must be https://<project-ref>.supabase.co (or empty to use the Sottra Cloud source fallback).";

const BUILD_PLACEHOLDER =
  "[Sottra] Production build blocked: VITE_SUPABASE_URL is a CI/test placeholder (https://example.supabase.co). Omit it to use the Sottra Cloud source fallback, or set the real project URL. CI test builds may keep placeholders when CI=true.";

/**
 * Production `vite build` guard.
 * Empty VITE_* is allowed: `client.ts` / `SOTTRA_CLOUD_SUPABASE` bake the real
 * project into the bundle (Lovable publish has been omitting Vite env).
 * Explicit CI placeholders still fail outside CI test packaging.
 */
export function assertProductionSupabaseEnv(input: {
  url: string;
  publishableKey: string;
  ci: boolean;
  forceProductionVerify: boolean;
}): void {
  const url = normalizeSupabaseUrl(input.url);
  const allowPlaceholders = input.ci && !input.forceProductionVerify;

  if (!url) {
    return;
  }
  if (!isValidSupabaseProjectUrl(url)) {
    throw new Error(BUILD_INVALID_URL);
  }
  if (!allowPlaceholders && isPlaceholderSupabaseUrl(url)) {
    throw new Error(BUILD_PLACEHOLDER);
  }
}
