import { coreRequest, isError } from "./api";
import { mockMoodScore, mockTimeView, mockOpportunity } from "./mockData";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

function delay(ms = 600) {
  return new Promise((r) => setTimeout(r, ms + Math.random() * 400));
}

export async function getMoodScore(lat: number, lng: number) {
  if (USE_MOCK) {
    await delay(900);
    return { error: false, message: null, data: mockMoodScore };
  }
  const res = await coreRequest("/forecast/moodscore", "POST", { lat, lng }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getTimeView(lat: number, lng: number, horizon: number) {
  if (USE_MOCK) {
    await delay(1100);
    return { error: false, message: null, data: mockTimeView };
  }
  const res = await coreRequest("/forecast/timeview", "POST", { lat, lng, horizon });
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getOpportunityIndex(lat: number, lng: number) {
  if (USE_MOCK) {
    await delay(1300);
    return { error: false, message: null, data: mockOpportunity };
  }
  const res = await coreRequest("/forecast/opportunity", "POST", { lat, lng });
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}
