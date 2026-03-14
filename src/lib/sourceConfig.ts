/**
 * Pro Sources Configuration
 *
 * Defines provider ordering, capabilities, and runtime feature flags.
 * No provider premium is mandatory for base scanning to work.
 */

import type { SourceProvider } from "@/types";

/** Provider capability descriptor */
export interface ProviderConfig {
  id: SourceProvider;
  label: string;
  requiresKey: boolean;
  keyName?: string;
  defaultTimeout: number;
  enabled: boolean;
}

/** Provider registry — all known providers */
export const PROVIDERS: Record<string, ProviderConfig> = {
  istat: { id: "istat", label: "ISTAT", requiresKey: false, defaultTimeout: 8000, enabled: true },
  omi: { id: "omi", label: "OMI / Agenzia Entrate", requiresKey: false, defaultTimeout: 8000, enabled: true },
  overpass: { id: "overpass", label: "OpenStreetMap / Overpass", requiresKey: false, defaultTimeout: 10000, enabled: true },
  here: { id: "here", label: "HERE Geocoding", requiresKey: true, keyName: "HERE_API_KEY", defaultTimeout: 5000, enabled: false },
  google_places: { id: "google_places", label: "Google Places", requiresKey: true, keyName: "GOOGLE_MAPS_API_KEY", defaultTimeout: 5000, enabled: false },
  geoapify: { id: "geoapify", label: "Geoapify", requiresKey: true, keyName: "GEOAPIFY_API_KEY", defaultTimeout: 5000, enabled: false },
  mapillary: { id: "mapillary", label: "Mapillary", requiresKey: true, keyName: "MAPILLARY_API_KEY", defaultTimeout: 8000, enabled: false },
};

/** Provider ordering for POI enrichment */
export const POI_PROVIDER_ORDER: SourceProvider[] = [
  "overpass",       // Free, always available
  "google_places",  // Premium enrichment
  "geoapify",       // Premium alternative
];

/** Provider ordering for geocoding */
export const GEOCODE_PROVIDER_ORDER: SourceProvider[] = [
  "here",
  "overpass",
  "geoapify",
];

/** POI categories relevant for real estate analysis */
export const POI_CATEGORIES = [
  { key: "transport", label: "Trasporti", overpassTags: ["railway=station", "amenity=bus_station", "station=subway"], radius: 1000 },
  { key: "education", label: "Istruzione", overpassTags: ["amenity=school", "amenity=university", "amenity=kindergarten"], radius: 800 },
  { key: "health", label: "Salute", overpassTags: ["amenity=hospital", "amenity=pharmacy", "amenity=clinic"], radius: 1000 },
  { key: "shopping", label: "Commercio", overpassTags: ["shop=supermarket", "shop=mall", "amenity=marketplace"], radius: 500 },
  { key: "parks", label: "Aree verdi", overpassTags: ["leisure=park", "leisure=garden"], radius: 500 },
  { key: "culture", label: "Cultura", overpassTags: ["amenity=library", "tourism=museum", "amenity=theatre"], radius: 1000 },
] as const;

/** Source type display mapping with full tier info */
export function getSourceDisplayInfo(sourceType?: string): {
  tier: string;
  label: string;
  color: string;
} {
  switch (sourceType) {
    case "official": return { tier: "ufficiale", label: "Dato ufficiale", color: "green" };
    case "verified_geo": return { tier: "geo_verificato", label: "Dato geospaziale verificato", color: "cyan" };
    case "premium": return { tier: "premium", label: "Dato premium", color: "violet" };
    case "commercial_verified": return { tier: "mercato_verificato", label: "Fonte di mercato verificata", color: "teal" };
    case "commercial_partial": return { tier: "mercato_parziale", label: "Copertura di mercato parziale", color: "sky" };
    case "elaborated": return { tier: "elaborato", label: "Elaborazione da fonti verificate", color: "blue" };
    case "derived": return { tier: "elaborato", label: "Dato derivato", color: "blue" };
    case "estimate": return { tier: "stima", label: "Stima indicativa", color: "amber" };
    case "unavailable": return { tier: "non_disponibile", label: "Non disponibile", color: "stone" };
    default: return { tier: "elaborato", label: "Elaborazione da fonti verificate", color: "blue" };
  }
}
