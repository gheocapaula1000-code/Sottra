import { isValidGps } from "@/lib/imageUtils";
import { normalizePhotoWow } from "@/lib/officialOmiFromCore";
import { coreRequest, isError } from "@/services/api";
import type { PhotoWowResponse } from "@/types/photoWow";

/**
 * Cinematic photo opener — NOT the official Sottra report.
 *
 * Routes through Sottra `core-proxy` → Central Core `/sottra/scan/photo-wow`
 * (same auth path as identify/pricing/forecast). Accepts both flat lat/lng
 * and Civiko-style `{ geo: { latitude, longitude } }` upstream.
 */
export async function getPhotoWow(
  photo: string,
  lat: number,
  lng: number,
  geoSource: "device" | "address" = "device",
  address?: string,
): Promise<{ error: boolean; message: string | null; data: PhotoWowResponse | null }> {
  if (!isValidGps(lat, lng)) {
    return { error: true, message: "Posizione dell'indirizzo non disponibile", data: null };
  }

  try {
    const res = await coreRequest<unknown>("/scan/photo-wow", "POST", {
      photo,
      lat,
      lng,
      geo: { latitude: lat, longitude: lng, source: geoSource },
      ...(address && address.trim() ? { address: address.trim() } : {}),
    }, 60000);

    if (isError(res)) {
      return { error: true, message: res.message, data: null };
    }

    const data = normalizePhotoWow(res);
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
