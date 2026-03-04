const CORE_API_URL =
  import.meta.env.VITE_CORE_API_URL ??
  "https://xyzcompanyid.supabase.co/functions/v1";

const CORE_API_KEY = import.meta.env.VITE_CORE_API_KEY ?? "";

interface CoreError {
  error: true;
  message: string;
}

export async function coreRequest<T = unknown>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "POST",
  body?: unknown,
  timeout = 5000,
): Promise<T | CoreError> {
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
      const text = await res.text().catch(() => res.statusText);
      return { error: true, message: `HTTP ${res.status}: ${text}` };
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { error: true, message: "Request timeout" };
    }
    return {
      error: true,
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export function isError(res: unknown): res is CoreError {
  return typeof res === "object" && res !== null && (res as CoreError).error === true;
}
