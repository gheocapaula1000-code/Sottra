/**
 * Street-level reverse geocode helpers.
 * Uses Nominatim address parts already returned by pro-sources.
 * Does not invent a via, civico, or city.
 */

function asTrimmed(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    const s = asTrimmed(v);
    if (s) return s;
  }
  return null;
}

/** Build "Via San Francesco 2, Padova" from Nominatim addressdetails. */
export function formatNominatimStreetAddress(
  addr: Record<string, unknown> | null | undefined,
): string | null {
  if (!addr) return null;
  const road = firstString(addr.road, addr.pedestrian, addr.footway, addr.square, addr.residential);
  const house = firstString(addr.house_number);
  const comune = firstString(addr.city, addr.town, addr.village, addr.municipality);
  if (!road && !comune) return null;
  const street = road && house ? `${road} ${house}` : (road ?? "");
  if (street && comune) return `${street}, ${comune}`;
  return street || comune;
}

export function readReverseGeocodeAddress(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Record<string, unknown>;
  if (g.sourceType === "unavailable") return null;
  const address = asTrimmed(g.address);
  return address && address.length >= 3 ? address : null;
}
