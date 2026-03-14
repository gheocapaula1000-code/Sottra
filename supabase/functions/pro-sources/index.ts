import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, detail?: string) =>
  console.log(`[pro-sources] ${step}${detail ? ` — ${detail}` : ""}`);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ── POI Categories for Overpass ─────────────────────── */
const POI_CATEGORIES = [
  { key: "transport", label: "Trasporti", tags: ["railway=station", "amenity=bus_station", "station=subway"] },
  { key: "education", label: "Istruzione", tags: ["amenity=school", "amenity=university", "amenity=kindergarten"] },
  { key: "health", label: "Salute", tags: ["amenity=hospital", "amenity=pharmacy", "amenity=clinic"] },
  { key: "shopping", label: "Commercio", tags: ["shop=supermarket", "shop=mall", "amenity=marketplace"] },
  { key: "parks", label: "Aree verdi", tags: ["leisure=park", "leisure=garden"] },
  { key: "culture", label: "Cultura", tags: ["amenity=library", "tourism=museum", "amenity=theatre"] },
];

/* ── Overpass POI Query ──────────────────────────────── */
async function queryOverpassPoi(lat: number, lng: number, radius: number): Promise<unknown[]> {
  const allTags = POI_CATEGORIES.flatMap(c => c.tags);
  const nodeFilters = allTags.map(tag => {
    const [k, v] = tag.split("=");
    return `node["${k}"="${v}"](around:${radius},${lat},${lng});`;
  }).join("\n");
  const wayFilters = allTags.map(tag => {
    const [k, v] = tag.split("=");
    return `way["${k}"="${v}"](around:${radius},${lat},${lng});`;
  }).join("\n");

  const query = `[out:json][timeout:8];(\n${nodeFilters}\n${wayFilters}\n);out center tags 50;`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      log("overpass http error", `${res.status}: ${text.slice(0, 200)}`);
      return [];
    }

    const data = await res.json();
    return data.elements ?? [];
  } catch (e) {
    clearTimeout(timeoutId);
    log("overpass exception", String(e));
    return [];
  }
}

function categorizeOverpassElement(el: Record<string, unknown>): { category: string; categoryLabel: string } | null {
  const tags = (el.tags ?? {}) as Record<string, string>;
  for (const cat of POI_CATEGORIES) {
    for (const tagStr of cat.tags) {
      const [k, v] = tagStr.split("=");
      if (tags[k] === v) return { category: cat.key, categoryLabel: cat.label };
    }
  }
  return null;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildPoiResult(elements: unknown[], lat: number, lng: number, radius: number) {
  const pois: {
    name: string;
    category: string;
    categoryLabel: string;
    distance: number;
    lat: number;
    lng: number;
    provider: string;
  }[] = [];

  for (const raw of elements) {
    const el = raw as Record<string, unknown>;
    const tags = (el.tags ?? {}) as Record<string, string>;
    const cat = categorizeOverpassElement(el);
    if (!cat) continue;

    const elLat = (el.lat ?? (el.center as Record<string, number> | undefined)?.lat) as number | undefined;
    const elLng = (el.lon ?? (el.center as Record<string, number> | undefined)?.lon) as number | undefined;
    if (elLat == null || elLng == null) continue;

    const name = tags.name || tags["name:it"] || cat.categoryLabel;
    const distance = Math.round(haversine(lat, lng, elLat, elLng));

    pois.push({
      name,
      category: cat.category,
      categoryLabel: cat.categoryLabel,
      distance,
      lat: elLat,
      lng: elLng,
      provider: "overpass",
    });
  }

  // Sort by distance, deduplicate by name+category
  pois.sort((a, b) => a.distance - b.distance);
  const seen = new Set<string>();
  const unique = pois.filter(p => {
    const key = `${p.category}:${p.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Build category summaries
  const catMap = new Map<string, typeof unique>();
  for (const p of unique) {
    if (!catMap.has(p.category)) catMap.set(p.category, []);
    catMap.get(p.category)!.push(p);
  }

  const categories = Array.from(catMap.entries()).map(([category, items]) => ({
    category,
    categoryLabel: items[0].categoryLabel,
    count: items.length,
    nearest: items[0],
  }));

  return {
    totalPois: unique.length,
    categories,
    pois: unique.slice(0, 30), // Limit to 30 POIs
    searchRadius: radius,
    sourceType: "verified_geo",
    sourceProvider: "overpass",
    sourceLabel: "OpenStreetMap / Overpass API",
    sourceFreshness: new Date().toISOString().slice(0, 10),
    licensingNote: "© OpenStreetMap contributors — ODbL",
    attributionNote: "Dati cartografici © OpenStreetMap contributors",
  };
}

/* ── Google Places POI Enrichment ───────────────────── */
async function queryGooglePlaces(lat: number, lng: number, radius: number, apiKey: string): Promise<unknown> {
  const types = ["school", "hospital", "pharmacy", "supermarket", "park", "transit_station", "library", "museum"];
  const allResults: unknown[] = [];

  for (const type of types.slice(0, 4)) { // Limit API calls
    try {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}&language=it`;
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(tid);

      if (res.ok) {
        const data = await res.json();
        if (data.results) allResults.push(...data.results);
      }
    } catch (e) {
      log("google places error for type " + type, String(e));
    }
  }

  if (allResults.length === 0) return null;

  const pois = allResults.map((r: unknown) => {
    const place = r as Record<string, unknown>;
    const loc = (place.geometry as Record<string, unknown>)?.location as Record<string, number> | undefined;
    return {
      name: String(place.name ?? ""),
      category: "general",
      categoryLabel: "Servizio",
      distance: loc ? Math.round(haversine(lat, lng, loc.lat, loc.lng)) : 0,
      lat: loc?.lat ?? lat,
      lng: loc?.lng ?? lng,
      provider: "google_places",
    };
  });

  return {
    pois: pois.slice(0, 20),
    totalPois: pois.length,
    sourceType: "premium",
    sourceProvider: "google_places",
    sourceLabel: "Google Places API",
    licensingNote: "Powered by Google",
  };
}

/* ── ISTAT Query (structured stub, ready for real API) ── */
async function queryIstat(lat: number, lng: number): Promise<unknown> {
  // ISTAT SDMX API requires specific dataset codes and geographic identifiers.
  // This function is structured to connect to I.Stat when endpoint is configured.
  // For now, return unavailable with proper reason.
  const istatEnabled = Deno.env.get("ISTAT_ENABLED") === "true";
  if (!istatEnabled) {
    return {
      sourceType: "unavailable",
      sourceProvider: "istat",
      availabilityReason: "provider_unavailable",
      sourceLabel: "ISTAT",
    };
  }

  // TODO: Implement actual ISTAT SDMX query
  // Example endpoint: https://esploradati.istat.it/SDMXWS/rest/data/...
  log("istat query", `lat=${lat}, lng=${lng}`);
  return {
    sourceType: "unavailable",
    sourceProvider: "istat",
    availabilityReason: "no_coverage",
    sourceLabel: "ISTAT — I.Stat SDMX",
  };
}

/* ── OMI Query (structured stub, ready for data) ──── */
async function queryOmi(lat: number, lng: number): Promise<unknown> {
  const omiEnabled = Deno.env.get("OMI_ENABLED") === "true";
  if (!omiEnabled) {
    return {
      sourceType: "unavailable",
      sourceProvider: "omi",
      availabilityReason: "provider_unavailable",
      sourceLabel: "OMI / Agenzia delle Entrate",
    };
  }

  // TODO: Implement OMI data lookup
  // OMI publishes CSV data per semester. Integration requires:
  // 1. Pre-processed OMI zone shapefile/geojson in storage
  // 2. Point-in-polygon lookup for zone identification
  // 3. Price lookup from OMI quotation tables
  log("omi query", `lat=${lat}, lng=${lng}`);
  return {
    sourceType: "unavailable",
    sourceProvider: "omi",
    availabilityReason: "no_coverage",
    sourceLabel: "OMI / Agenzia delle Entrate",
  };
}

/* ── Main Handler ────────────────────────────────────── */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing authorization" }, 200);
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Auth verification failed" }, 200);
    }

    // Parse request
    const body = await req.json();
    const { lat, lng, modules, radius = 800 } = body as {
      lat: number;
      lng: number;
      modules?: string[];
      radius?: number;
    };

    if (lat == null || lng == null) {
      return json({ error: "lat/lng required" }, 200);
    }

    const requestedModules = modules ?? ["poi", "omi", "istat"];
    log("request", `modules=${requestedModules.join(",")}, lat=${lat}, lng=${lng}`);

    const results: Record<string, unknown> = {};

    // Execute requested modules in parallel with individual error handling
    const promises: Promise<void>[] = [];

    if (requestedModules.includes("poi")) {
      promises.push(
        (async () => {
          try {
            // Level 1: Overpass (free, always available)
            const elements = await queryOverpassPoi(lat, lng, radius);
            const poiResult = buildPoiResult(elements, lat, lng, radius);

            // Level 2: Google Places enrichment (if key available)
            const googleKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
            if (googleKey && Deno.env.get("GOOGLE_PLACES_ENABLED") === "true") {
              try {
                const googleResult = await queryGooglePlaces(lat, lng, radius, googleKey);
                if (googleResult) {
                  (poiResult as Record<string, unknown>).premiumEnrichment = googleResult;
                }
              } catch (e) {
                log("google places enrichment failed (non-fatal)", String(e));
              }
            }

            results.poi = poiResult;
            log("poi done", `${poiResult.totalPois} POIs found`);
          } catch (e) {
            log("poi module failed", String(e));
            results.poi = {
              sourceType: "unavailable",
              sourceProvider: "overpass",
              availabilityReason: "provider_unavailable",
              totalPois: 0,
              categories: [],
              pois: [],
            };
          }
        })()
      );
    }

    if (requestedModules.includes("omi")) {
      promises.push(
        (async () => {
          try {
            results.omi = await queryOmi(lat, lng);
          } catch (e) {
            log("omi module failed", String(e));
            results.omi = { sourceType: "unavailable", sourceProvider: "omi", availabilityReason: "provider_unavailable" };
          }
        })()
      );
    }

    if (requestedModules.includes("istat")) {
      promises.push(
        (async () => {
          try {
            results.istat = await queryIstat(lat, lng);
          } catch (e) {
            log("istat module failed", String(e));
            results.istat = { sourceType: "unavailable", sourceProvider: "istat", availabilityReason: "provider_unavailable" };
          }
        })()
      );
    }

    await Promise.allSettled(promises);

    return json({
      ok: true,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (topErr) {
    log("FATAL", String(topErr));
    return json({ ok: false, error: "Internal error", data: {} }, 200);
  }
});
