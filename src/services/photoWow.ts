import { coreRequest, isError } from "./api";
import type { PhotoWowResponse } from "@/types/photoWow";

/**
 * Calls the Central Core `civiko-property-from-photo` orchestrator
 * via the secure core-proxy edge function. Replaces the legacy
 * parallel scan pipeline with a single round-trip.
 */
export async function getPhotoWow(
  photo: string,
  lat: number,
  lng: number,
): Promise<{ error: boolean; message: string | null; data: PhotoWowResponse | null }> {
  const res = await coreRequest<PhotoWowResponse>(
    "/civiko-property-from-photo",
    "POST",
    {
      photo,
      geo: { latitude: lat, longitude: lng, source: "device" },
      quickFacts: {},
    },
    60000,
  );
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}
