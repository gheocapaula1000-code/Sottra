import { supabase } from "@/integrations/supabase/client";

interface CoreError {
  error: true;
  message: string;
}

// ── Circuit Breaker ──
const CB_THRESHOLD = 5;
const CB_RESET_MS = 30_000;

const cb = { failures: 0, lastFailure: 0, open: false };

function isCircuitOpen(): boolean {
  if (!cb.open) return false;
  if (Date.now() - cb.lastFailure > CB_RESET_MS) {
    cb.open = false;
    cb.failures = 0;
    return false;
  }
  return true;
}

function recordSuccess() {
  cb.failures = 0;
  cb.open = false;
}

function recordFailure() {
  cb.failures++;
  cb.lastFailure = Date.now();
  if (cb.failures >= CB_THRESHOLD) cb.open = true;
}

/**
 * Proxy all Core API requests through the backend edge function.
 * No API keys are exposed to the client.
 */
export async function coreRequest<T = unknown>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "POST",
  body?: unknown,
  timeout = 10000,
): Promise<T | CoreError> {
  if (isCircuitOpen()) {
    return { error: true, message: "Servizio temporaneamente non raggiungibile" };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke("core-proxy", {
        body: { endpoint, method, payload: body, timeout },
      });

      if (error) {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        recordFailure();
        return { error: true, message: error.message || "Errore di rete" };
      }

      // Central Core V3 wrapper: { ok, data, warnings, debug_id }
      if (data && typeof data === "object" && "ok" in data) {
        if (!data.ok) {
          recordFailure();
          return { error: true, message: data.error?.message ?? "Errore sconosciuto" };
        }
        recordSuccess();
        return data.data as T;
      }

      recordSuccess();
      return data as T;
    } catch (err: unknown) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      recordFailure();
      if (err instanceof DOMException && err.name === "AbortError") {
        return { error: true, message: "Timeout richiesta" };
      }
      return {
        error: true,
        message: err instanceof Error ? err.message : "Errore sconosciuto",
      };
    }
  }

  recordFailure();
  return { error: true, message: "Errore sconosciuto" };
}

export function isError(res: unknown): res is CoreError {
  return typeof res === "object" && res !== null && (res as CoreError).error === true;
}

/** Reset circuit breaker — only for tests */
export function _resetCircuitBreaker() {
  cb.failures = 0;
  cb.lastFailure = 0;
  cb.open = false;
}
