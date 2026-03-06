import { coreRequest, isError } from "./api";
import {
  mockIdentify, mockCadastral, mockPricing, mockListings, mockEnergy,
  mockCondominio, mockStoricoTransazioni,
} from "./mockData";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

function delay(ms = 600) {
  return new Promise((r) => setTimeout(r, ms + Math.random() * 400));
}

export async function identifyBuilding(photo: string, lat: number, lng: number) {
  if (USE_MOCK) { await delay(800); return { error: false, message: null, data: mockIdentify }; }
  const res = await coreRequest("/scan/identify", "POST", { lat, lng }, 15000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getCadastral(address: string) {
  if (USE_MOCK) { await delay(); return { error: false, message: null, data: mockCadastral }; }
  const res = await coreRequest("/scan/cadastral", "POST", { address }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getPricing(address: string) {
  if (USE_MOCK) { await delay(); return { error: false, message: null, data: mockPricing }; }
  const res = await coreRequest("/scan/pricing", "POST", { address }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getListings(address: string) {
  if (USE_MOCK) { await delay(1000); return { error: false, message: null, data: mockListings }; }
  const res = await coreRequest("/scan/listings", "POST", { address }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getEnergy(address: string) {
  if (USE_MOCK) { await delay(700); return { error: false, message: null, data: mockEnergy }; }
  const res = await coreRequest("/scan/energy", "POST", { address }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getCondominio(address: string) {
  if (USE_MOCK) { await delay(600); return { error: false, message: null, data: mockCondominio }; }
  const res = await coreRequest("/scan/condominio", "POST", { address }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getStoricoTransazioni(address: string) {
  if (USE_MOCK) { await delay(900); return { error: false, message: null, data: mockStoricoTransazioni }; }
  const res = await coreRequest("/scan/storico-transazioni", "POST", { address }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}
