import { unwrapCoreEnvelope } from "@/lib/officialOmiFromCore";
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

/** Map raw error messages to user-friendly Italian microcopy */
function friendlyMessage(raw: string, status?: number): string {
  if (status === 413) return "Immagine troppo pesante. Riprova con una foto più leggera.";
  if (status === 401) return "Configurazione di collegamento non valida.";
  if (status === 503) return "Servizio in configurazione o temporaneamente non disponibile.";
  if (status === 504) return "Il servizio ha impiegato troppo tempo. Riprova.";
  if (status === 502) return "Errore di comunicazione — riprova più tardi.";
  if (/timeout/i.test(raw)) return "Il servizio ha impiegato troppo tempo. Riprova.";
  if (/network|fetch|abort/i.test(raw)) return "Errore di connessione — verifica la rete.";
  if (/payload|too large|entity/i.test(raw)) return "Immagine troppo pesante. Riprova con una foto più leggera.";
  return "Servizio temporaneamente non disponibile.";
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
  if (!navigator.onLine) {
    return { error: true, message: "Sei offline — verifica la connessione e riprova." };
  }

  if (isCircuitOpen()) {
    return { error: true, message: "Servizio temporaneamente non raggiungibile — riprova tra qualche istante." };
  }

  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke("core-proxy", {
        body: { endpoint, method, payload: body, timeout },
      });

      if (error) {
        if (attempt < MAX_ATTEMPTS - 1) {
          await backoff(attempt);
          continue;
        }
        recordFailure();
        return { error: true, message: friendlyMessage(error.message || "") };
      }

      // Edge function returned an error object
      if (data && typeof data === "object" && "error" in data && data.error?.message) {
        const status = data.status ?? data.error?.status;
        // Retry on transient server errors
        if (attempt < MAX_ATTEMPTS - 1 && isTransient(status)) {
          await backoff(attempt);
          continue;
        }
        recordFailure();
        return { error: true, message: friendlyMessage(data.error.message, status) };
      }

      // Central Core V3 wrapper: { ok, data } plus optional top-level zona/pricing
      if (data && typeof data === "object" && "ok" in data) {
        if (!data.ok) {
          const status = data.status;
          if (attempt < MAX_ATTEMPTS - 1 && isTransient(status)) {
            await backoff(attempt);
            continue;
          }
          recordFailure();
          return { error: true, message: friendlyMessage(data.error?.message ?? "", status) };
        }
        recordSuccess();
        const unwrapped = unwrapCoreEnvelope(data);
        if (unwrapped) return unwrapped as T;
        return data.data as T;
      }

      recordSuccess();
      return data as T;
    } catch (err: unknown) {
      if (attempt < MAX_ATTEMPTS - 1) {
        await backoff(attempt);
        continue;
      }
      recordFailure();
      if (err instanceof DOMException && err.name === "AbortError") {
        return { error: true, message: friendlyMessage("timeout") };
      }
      return {
        error: true,
        message: friendlyMessage(err instanceof Error ? err.message : ""),
      };
    }
  }

  recordFailure();
  return { error: true, message: "Servizio temporaneamente non disponibile." };
}

/** Exponential backoff: ~1s, ~2s, ~4s with jitter */
function backoff(attempt: number): Promise<void> {
  const base = Math.min(1000 * 2 ** attempt, 8000);
  const jitter = Math.random() * 500;
  return new Promise((r) => setTimeout(r, base + jitter));
}

/** Status codes worth retrying */
function isTransient(status?: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
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
