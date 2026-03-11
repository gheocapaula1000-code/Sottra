import { coreRequest, isError } from "./api";
import { mockIdentify, mockPricing } from "./mockData";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true" && import.meta.env.MODE !== "production";

function delay(ms = 600) {
  return new Promise((r) => setTimeout(r, ms + Math.random() * 400));
}

export async function identifyBuilding(photo: string, lat: number, lng: number) {
  if (USE_MOCK) { await delay(800); return { error: false, message: null, data: mockIdentify }; }
  const res = await coreRequest("/scan/identify", "POST", { lat, lng, photo }, 15000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getPricing(address: string, photo?: string) {
  if (USE_MOCK) { await delay(); return { error: false, message: null, data: mockPricing }; }
  const res = await coreRequest("/scan/pricing", "POST", { address, photo }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}
