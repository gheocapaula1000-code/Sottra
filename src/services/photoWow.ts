import { normalizePhotoWow } from "@/lib/officialOmiFromCore";
import type { PhotoWowResponse } from "@/types/photoWow";

const CORE_PROXY_URL =
  (import.meta.env.VITE_CORE_PROXY_URL as string | undefined) ??
  "https://jpunnzgixcghuydstdlt.supabase.co/functions/v1/core-proxy";

/**
 * Cinematic photo opener — plus official OMI crumbs from Central Core 3.4.4.
 *
 * Hits Central Core `civiko-property-from-photo`. The live payload is
 * dual-readable (`{ ok, data }` plus top-level zona/pricing). Official
 * microzona / €/m² are mapped into WowPanel's officialOmi overlay by
 * `officialOmiFromCore`; scores stay null when Core omitted them.
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

    const raw: unknown = await res.json();
    if (raw && typeof raw === "object" && "ok" in raw && (raw as { ok?: unknown }).ok === false) {
      const msg = (raw as { error?: { message?: string }; message?: string }).error?.message
        ?? (raw as { message?: string }).message
        ?? "photoWow non disponibile";
      return { error: true, message: msg, data: null };
    }

    const data = normalizePhotoWow(raw);
    if (!data) {
      return { error: true, message: "Risposta photoWow non valida", data: null };
    }
    return { error: false, message: null, data };
  } catch (err) {
    return {
      error: true,
      message: err instanceof Error ? err.message : "Errore di rete photoWow",
      data: null,
    };
  }
}
