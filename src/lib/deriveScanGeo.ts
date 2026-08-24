import { isValidGps } from "@/lib/imageUtils";
import type { IdentifyResult } from "@/types";

export type ScanGeoSource = "identify" | "geocode" | "device" | "none";

export interface DerivedScanGeo {
  address: string;
  confidence: number | undefined;
  comuneFromAddr: string | undefined;
  comuneFromIdentify: string | undefined;
  provinciaFromIdentify: string | undefined;
  addressFromIdentify: string;
  finalLat: number | null;
  finalLng: number | null;
  geoSource: ScanGeoSource;
}

function asFiniteCoord(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Resolved coords from identify / geoResolution — only when they are real GPS, not 0,0. */
export function readIdentifyResolvedCoords(
  identifyData: IdentifyResult | null,
): { lat: number; lng: number } | null {
  if (!identifyData) return null;
  const identifyAny = identifyData as IdentifyResult & Record<string, unknown>;
  const geoRes = identifyAny.geoResolution as Record<string, unknown> | undefined;
  const lat = asFiniteCoord(geoRes?.resolvedLat) ?? asFiniteCoord(identifyAny.resolvedLat);
  const lng = asFiniteCoord(geoRes?.resolvedLng) ?? asFiniteCoord(identifyAny.resolvedLng);
  if (lat == null || lng == null) return null;
  if (!isValidGps(lat, lng)) return null;
  return { lat, lng };
}

function validPair(
  lat: number | null | undefined,
  lng: number | null | undefined,
): { lat: number; lng: number } | null {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!isValidGps(lat, lng)) return null;
  return { lat, lng };
}

/**
 * Choose territorial coordinates for a scan.
 *
 * Manual address present: identify-resolved coords, then forward-geocode.
 * Never keep device GPS — indoor phones are never 0,0, so GPS would ignore Padova.
 * No address: device GPS; identify-resolved only if GPS is missing/0,0.
 * Fail-closed: null coords, no invented zone.
 */
export function deriveGeoFromIdentify(
  identifyData: IdentifyResult | null,
  manualAddrInput: string | undefined,
  lat: number,
  lng: number,
  geocoded?: { lat: number; lng: number } | null,
): DerivedScanGeo {
  const address = (manualAddrInput && manualAddrInput.trim()) || identifyData?.address || "";
  const hasManualAddress = !!(manualAddrInput && manualAddrInput.trim());
  const confidence = identifyData?.confidence ?? undefined;
  const addrParts = address.split(",").map((s) => s.trim()).filter(Boolean);
  const comuneFromAddr = addrParts.length >= 2 ? addrParts[addrParts.length - 2] : undefined;
  const provinciaFromAddr = addrParts.length >= 1 ? addrParts[addrParts.length - 1] : undefined;

  const identifyAny = (identifyData ?? {}) as unknown as Record<string, unknown>;
  const geoRes = identifyAny.geoResolution as Record<string, unknown> | undefined;
  const comuneFromIdentify = (geoRes?.resolvedComune as string | undefined)
    ?? (identifyAny.comune as string | undefined)
    ?? (typeof identifyData?.address === "string"
      ? identifyData.address.split(",").slice(-2, -1)[0]?.trim()
      : undefined)
    ?? comuneFromAddr;
  const provinciaFromIdentify = (geoRes?.resolvedProvincia as string | undefined)
    ?? provinciaFromAddr;
  const addressFromIdentify = (identifyAny.resolvedAddress as string | undefined)
    ?? (geoRes?.resolvedAddress as string | undefined)
    ?? identifyData?.address
    ?? address;

  const resolved = readIdentifyResolvedCoords(identifyData);
  const geocodedPair = geocoded ? validPair(geocoded.lat, geocoded.lng) : null;
  const devicePair = validPair(lat, lng);

  let finalLat: number | null;
  let finalLng: number | null;
  let geoSource: ScanGeoSource;

  if (hasManualAddress) {
    if (resolved) {
      finalLat = resolved.lat;
      finalLng = resolved.lng;
      geoSource = "identify";
    } else if (geocodedPair) {
      finalLat = geocodedPair.lat;
      finalLng = geocodedPair.lng;
      geoSource = "geocode";
    } else {
      finalLat = null;
      finalLng = null;
      geoSource = "none";
    }
  } else if (devicePair) {
    finalLat = devicePair.lat;
    finalLng = devicePair.lng;
    geoSource = "device";
  } else if (resolved) {
    finalLat = resolved.lat;
    finalLng = resolved.lng;
    geoSource = "identify";
  } else {
    // 0,0 is a sentinel ("no GPS yet"), never a lookup coordinate.
    finalLat = null;
    finalLng = null;
    geoSource = "none";
  }

  return {
    address,
    confidence,
    comuneFromAddr,
    comuneFromIdentify,
    provinciaFromIdentify,
    addressFromIdentify,
    finalLat,
    finalLng,
    geoSource,
  };
}
