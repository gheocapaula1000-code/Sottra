import { coreRequest, isError } from "./api";

export async function identifyBuilding(photo: string, lat: number, lng: number) {
  const res = await coreRequest("/scan/identify", "POST", { lat, lng, photo }, 15000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getPricing(address: string, photo?: string) {
  const res = await coreRequest("/scan/pricing", "POST", { address, photo }, 25000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}

export async function getOffmarket(lat: number, lng: number, comune?: string, provincia?: string) {
  const res = await coreRequest("/scan/offmarket", "POST", { lat, lng, comune, provincia }, 15000);
  if (isError(res)) return { error: true, message: res.message, data: null };
  return { error: false, message: null, data: res };
}
