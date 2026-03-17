import { coreRequest, isError } from "./api";
import { normalizeMarketContext } from "@/lib/normalizeMarketContext";
import { normalizeInfrastrutture, normalizeSviluppoArea } from "@/lib/normalizeForecastContext";

export async function getTimeView(lat: number, lng: number, horizon: number) {
  const res = await coreRequest("/forecast/timeview", "POST", { lat, lng, horizon }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getOpportunityIndex(lat: number, lng: number) {
  const res = await coreRequest("/forecast/opportunity", "POST", { lat, lng }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getInfrastrutture(lat: number, lng: number) {
  const res = await coreRequest("/forecast/infrastrutture", "POST", { lat, lng }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: normalizeInfrastrutture(res) };
}

export async function getRischioZona(lat: number, lng: number) {
  const res = await coreRequest("/forecast/rischio-zona", "POST", { lat, lng }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getTrendDemografico(lat: number, lng: number) {
  const res = await coreRequest("/forecast/trend-demografico", "POST", { lat, lng }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getSviluppoArea(lat: number, lng: number) {
  const res = await coreRequest("/forecast/sviluppo-area", "POST", { lat, lng }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: normalizeSviluppoArea(res) };
}

export async function getConvergenzaTerritoriale(lat: number, lng: number, identityConfidence?: number, address?: string) {
  const payload: Record<string, unknown> = { lat, lng };
  if (identityConfidence != null) payload.identityConfidence = identityConfidence;
  if (address) payload.address = address;
  const res = await coreRequest("/forecast/convergenza-territoriale", "POST", payload, 30000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getMarketContext(lat: number, lng: number, address?: string) {
  const payload: Record<string, unknown> = { lat, lng };
  if (address) payload.address = address;
  const res = await coreRequest("/scan/market", "POST", payload, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: normalizeMarketContext(res) };
}
