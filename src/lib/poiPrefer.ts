import type { PoiEnrichmentData } from "@/types";

function poiCount(data: PoiEnrichmentData | null | undefined): number {
  if (!data || data.sourceType === "unavailable") return 0;
  const total = typeof data.totalPois === "number" && Number.isFinite(data.totalPois)
    ? data.totalPois
    : 0;
  const listed = Array.isArray(data.pois) ? data.pois.length : 0;
  return Math.max(total, listed);
}

/**
 * Keep the Overpass/Core result that actually has POIs.
 * An empty later response must not hide a prior non-empty tendina.
 */
export function preferPoiData(
  current: PoiEnrichmentData | null | undefined,
  incoming: PoiEnrichmentData | null | undefined,
): PoiEnrichmentData | null {
  const currentCount = poiCount(current);
  const incomingCount = poiCount(incoming);
  if (incomingCount > 0 && incomingCount >= currentCount) return incoming ?? null;
  if (currentCount > 0) return current ?? null;
  if (incoming && incoming.sourceType !== "unavailable") return incoming;
  return current ?? incoming ?? null;
}
