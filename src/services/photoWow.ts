import type { PhotoWowResponse } from "@/types/photoWow";

const CORE_PROXY_URL =
  (import.meta.env.VITE_CORE_PROXY_URL as string | undefined) ??
  "https://jpunnzgixcghuydstdlt.supabase.co/functions/v1/core-proxy";

/**
 * Calls the Central Core `civiko-property-from-photo` orchestrator
 * via the Central Core's core-proxy edge function (absolute URL).
 * Bypasses Sottra's local Supabase client to ensure the request
 * reaches the correct project.
 */
export async function getPhotoWow(
  photo: string,
  lat: number,
  lng: number,
): Promise<{ error: boolean; message: string | null; data: PhotoWowResponse | null }> {
  try {
    const res = await fetch(CORE_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "/civiko-property-from-photo",
        method: "POST",
        payload: {
          photo,
          geo: { latitude: lat, longitude: lng, source: "device" },
          quickFacts: {},
        },
        timeout: 60000,
      }),
      signal: AbortSignal.timeout(65000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        error: true,
        message: `core-proxy HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
        data: null,
      };
    }

    const data = (await res.json()) as PhotoWowResponse;
    return { error: false, message: null, data };
  } catch (err) {
    return {
      error: true,
      message: err instanceof Error ? err.message : "Errore di rete photoWow",
      data: null,
    };
  }
}
