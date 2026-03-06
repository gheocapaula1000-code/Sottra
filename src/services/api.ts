const CORE_API_URL =
  import.meta.env.VITE_CORE_API_URL ??
  "https://xyzcompanyid.supabase.co/functions/v1";

const CORE_API_KEY = import.meta.env.VITE_CORE_API_KEY ?? "";

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

// ── Retryable status ──
function isRetryable(status: number): boolean {
  return status === 502 || status === 503 || status === 504 || status === 429;
}

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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${CORE_API_URL}${endpoint}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CORE_API_KEY}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        if (attempt === 0 && isRetryable(res.status)) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        const text = await res.text().catch(() => res.statusText);
        recordFailure();
        return { error: true, message: `HTTP ${res.status}: ${text}` };
      }

      const json = await res.json();

      // Central Core V3 wrapper: { ok, data, warnings, debug_id }
      if (json && typeof json === "object" && "ok" in json) {
        if (!json.ok) {
          recordFailure();
          return { error: true, message: json.error?.message ?? "Unknown error" };
        }
        recordSuccess();
        return json.data as T;
      }

      recordSuccess();
      return json as T;
    } catch (err: unknown) {
      clearTimeout(timer);
      if (attempt === 0 && !(err instanceof DOMException && err.name === "AbortError")) {
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

  // Should never reach here, but TypeScript needs it
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
