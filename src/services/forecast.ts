import { coreRequest, isError } from "./api";

export async function getMoodScore(lat: number, lng: number) {
  const res = await coreRequest("/sottra/forecast/moodscore", "POST", { lat, lng });
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getTimeView(lat: number, lng: number, horizon: number) {
  const res = await coreRequest("/sottra/forecast/timeview", "POST", { lat, lng, horizon });
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getOpportunityIndex(lat: number, lng: number) {
  const res = await coreRequest("/sottra/forecast/opportunity", "POST", { lat, lng });
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}
