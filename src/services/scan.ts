import { coreRequest, isError } from "./api";

export async function identifyBuilding(photo: string, lat: number, lng: number) {
  const res = await coreRequest("/casalens/scan/identify", "POST", { photo, lat, lng });
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getCadastral(address: string) {
  const res = await coreRequest("/casalens/scan/cadastral", "POST", { address });
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getPricing(address: string) {
  const res = await coreRequest("/casalens/scan/pricing", "POST", { address });
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getListings(address: string) {
  const res = await coreRequest("/casalens/scan/listings", "POST", { address });
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getEnergy(address: string) {
  const res = await coreRequest("/casalens/scan/energy", "POST", { address });
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}
