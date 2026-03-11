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
  if (isCircuitOpen()) {
    return { error: true, message: "Servizio temporaneamente non raggiungibile — riprova tra qualche istante" };
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
        return { error: true, message: friendlyMessage(error.message || "") };
      }

      // Edge function returned an error object
      if (data && typeof data === "object" && "error" in data && data.error?.message) {
        const status = data.status ?? data.error?.status;
        recordFailure();
        return { error: true, message: friendlyMessage(data.error.message, status) };
      }

      // Central Core V3 wrapper: { ok, data, warnings, debug_id }
      if (data && typeof data === "object" && "ok" in data) {
        if (!data.ok) {
          recordFailure();
          return { error: true, message: friendlyMessage(data.error?.message ?? "", data.status) };
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
        return { error: true, message: friendlyMessage("timeout") };
      }
      return {
        error: true,
        message: friendlyMessage(err instanceof Error ? err.message : ""),
      };
    }
  }

  recordFailure();
  return { error: true, message: "Servizio temporaneamente non disponibile" };
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
