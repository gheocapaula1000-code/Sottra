import { coreRequest, isError } from "./api";
import {
  mockMoodScore, mockTimeView, mockOpportunity,
  mockInfrastrutture, mockRischioZona, mockTrendDemografico,
} from "./mockData";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true" && import.meta.env.MODE !== "production";

function delay(ms = 600) {
  return new Promise((r) => setTimeout(r, ms + Math.random() * 400));
}

export async function getMoodScore(lat: number, lng: number) {
  if (USE_MOCK) { await delay(900); return { error: false, message: null, data: mockMoodScore }; }
  const res = await coreRequest("/forecast/moodscore", "POST", { lat, lng }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getTimeView(lat: number, lng: number, horizon: number) {
  if (USE_MOCK) { await delay(1100); return { error: false, message: null, data: mockTimeView }; }
  const res = await coreRequest("/forecast/timeview", "POST", { lat, lng, horizon }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getOpportunityIndex(lat: number, lng: number) {
  if (USE_MOCK) { await delay(1300); return { error: false, message: null, data: mockOpportunity }; }
  const res = await coreRequest("/forecast/opportunity", "POST", { lat, lng }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getInfrastrutture(lat: number, lng: number) {
  if (USE_MOCK) { await delay(1000); return { error: false, message: null, data: mockInfrastrutture }; }
  const res = await coreRequest("/forecast/infrastrutture", "POST", { lat, lng }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getRischioZona(lat: number, lng: number) {
  if (USE_MOCK) { await delay(800); return { error: false, message: null, data: mockRischioZona }; }
  const res = await coreRequest("/forecast/rischio-zona", "POST", { lat, lng }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getTrendDemografico(lat: number, lng: number) {
  if (USE_MOCK) { await delay(700); return { error: false, message: null, data: mockTrendDemografico }; }
  const res = await coreRequest("/forecast/trend-demografico", "POST", { lat, lng }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getSviluppoArea(lat: number, lng: number) {
  if (USE_MOCK) { await delay(1200); return { error: false, message: null, data: null }; }
  const res = await coreRequest("/forecast/sviluppo-area", "POST", { lat, lng }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}
