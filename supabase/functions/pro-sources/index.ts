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

/* ── Fetch with timeout helper ───────────────────────── */

async function fetchT(url: string, timeout: number, headers?: Record<string, string>): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, { headers, signal: c.signal });
    clearTimeout(t);
    return r;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

/* ── Unavailable helpers ─────────────────────────────── */

function unavailableIstat(reason: string) {
  return { sourceType: "unavailable", sourceProvider: "istat", availabilityReason: reason, sourceLabel: "ISTAT" };
}

function unavailableOmi(reason: string) {
  return { sourceType: "unavailable", sourceProvider: "omi", availabilityReason: reason, sourceLabel: "OMI / Agenzia delle Entrate" };
}

/* ══════════════════════════════════════════════════════
   NOMINATIM — Reverse geocode to identify Italian municipality
   ══════════════════════════════════════════════════════ */

interface GeoIdentity {
  comuneLabel: string | null;
  provinciaLabel: string | null;
  istatCode: string | null;
  cadastralCode: string | null;
}

async function identifyMunicipality(lat: number, lng: number): Promise<GeoIdentity> {
  const empty: GeoIdentity = { comuneLabel: null, provinciaLabel: null, istatCode: null, cadastralCode: null };

  try {
    // Step 1: Reverse geocode to get comune name
    const revUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1&accept-language=it&zoom=10`;
    const revRes = await fetchT(revUrl, 5000, { "User-Agent": "Sottra/1.0 (real-estate-analysis)" });

    if (!revRes.ok) {
      const t = await revRes.text();
      log("nominatim reverse error", `${revRes.status}: ${t.slice(0, 100)}`);
      return empty;
    }

    const revData = await revRes.json();
    const addr = revData.address ?? {};
    const comuneName = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? null;
    const provinciaName = addr.county ?? addr.state_district ?? null;

    if (!comuneName) {
      log("nominatim", "no comune found in reverse geocode");
      return { comuneLabel: null, provinciaLabel: provinciaName, istatCode: null, cadastralCode: null };
    }

    log("nominatim reverse", `comune=${comuneName}, provincia=${provinciaName}`);

    // Rate limit: Nominatim requires max 1 req/sec
    await new Promise(r => setTimeout(r, 1100));

    // Step 2: Search for the municipality boundary to get ISTAT + catastale codes
    const searchQ = provinciaName
      ? `${comuneName}, ${provinciaName}, Italia`
      : `${comuneName}, Italia`;
    const searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQ)}&format=jsonv2&extratags=1&limit=3&countrycodes=it`;
    const searchRes = await fetchT(searchUrl, 5000, { "User-Agent": "Sottra/1.0 (real-estate-analysis)" });

    if (!searchRes.ok) {
      const t = await searchRes.text();
      log("nominatim search error", `${searchRes.status}: ${t.slice(0, 100)}`);
      return { comuneLabel: comuneName, provinciaLabel: provinciaName, istatCode: null, cadastralCode: null };
    }

    const searchData = await searchRes.json();
    if (!Array.isArray(searchData) || searchData.length === 0) {
      log("nominatim search", "no results");
      return { comuneLabel: comuneName, provinciaLabel: provinciaName, istatCode: null, cadastralCode: null };
    }

    // Find the best match — prefer administrative boundaries
    const best = searchData.find((r: Record<string, unknown>) =>
      r.type === "administrative" || r.type === "city" || r.type === "town" || r.type === "village"
    ) ?? searchData[0];

    const extratags = (best as Record<string, unknown>).extratags as Record<string, string> | undefined;
    const istatCode = extratags?.["ref:ISTAT"] ?? extratags?.["istat:code"] ?? null;
    const cadastralCode = extratags?.["ref:catasto"] ?? null;

    log("nominatim codes", `istat=${istatCode}, catastale=${cadastralCode}`);

    return { comuneLabel: comuneName, provinciaLabel: provinciaName, istatCode, cadastralCode };
  } catch (e) {
    log("nominatim exception", String(e));
    return empty;
  }
}

/* ══════════════════════════════════════════════════════
   ISTAT — Real SDMX REST API query for demographic data
   ══════════════════════════════════════════════════════

   Uses the ISTAT SDMX endpoint with CSV output for easy parsing.
   Primary dataflow: DCIS_POPRES1 (Popolazione residente al 1° gennaio)
   Fallback: 22_289 (Bilancio demografico)

   Rate limit: 5 queries/minute per IP. We use max 1 query per scan.
   ══════════════════════════════════════════════════════ */

interface IstatResult {
  popolazione?: number | null;
  nucleiFamiliari?: number | null;
  densita?: number | null;
  indiceVecchiaia?: number | null;
  percentualeStranieri?: number | null;
  comuneLabel?: string | null;
  annoRilevazione?: string | null;
  sourceType: string;
  sourceProvider: string;
  sourceLabel: string;
  sourceFreshness?: string;
  sourceCoverageLevel?: string;
  availabilityReason?: string;
  licensingNote?: string;
}

async function queryIstatSdmx(istatCode: string, comuneLabel: string): Promise<IstatResult> {
  // DCIS_POPRES1 via dataflow 22_289
  // Dimensions: FREQ.REF_AREA.DATA_TYPE.SEX.AGE.MARITAL_STATUS
  // JAN = population on Jan 1st, 9 = total sex, TOTAL = all ages, 99 = all marital statuses
  const url = `https://esploradati.istat.it/SDMXWS/rest/data/22_289/A.${istatCode}.JAN.9.TOTAL.99?lastNObservations=1`;

  log("istat query", `url key=A.${istatCode}.JAN.9.TOTAL.99`);

  try {
    const res = await fetchT(url, 12000, {
      "Accept": "application/xml",
      "User-Agent": "Sottra/1.0 (real-estate-analysis)",
    });

    if (!res.ok) {
      const errText = await res.text();
      log("istat http error", `${res.status} — ${errText.slice(0, 200)}`);
      if (res.status === 404) return unavailableIstat("no_coverage") as IstatResult;
      return unavailableIstat("provider_unavailable") as IstatResult;
    }

    const xmlText = await res.text();

    // Parse OBS_VALUE and TIME_PERIOD from SDMX Generic XML
    // Pattern: <generic:obsdimension ... value="YEAR"> <generic:obsvalue value="NUMBER">
    const obsValueMatch = xmlText.match(/obsvalue\s+value="([^"]+)"/i);
    const timePeriodMatch = xmlText.match(/obsdimension[^>]*value="([^"]+)"/i);

    if (!obsValueMatch) {
      log("istat", "no obsvalue found in XML response");
      return unavailableIstat("no_coverage") as IstatResult;
    }

    const population = parseFloat(obsValueMatch[1]);
    const period = timePeriodMatch ? timePeriodMatch[1] : null;

    if (isNaN(population) || population <= 0) {
      log("istat", `invalid population value: ${obsValueMatch[1]}`);
      return unavailableIstat("no_coverage") as IstatResult;
    }

    log("istat result", `pop=${population}, period=${period}`);

    return {
      popolazione: Math.round(population),
      comuneLabel,
      annoRilevazione: period,
      sourceType: "official",
      sourceProvider: "istat",
      sourceLabel: "ISTAT — Popolazione residente al 1° gennaio",
      sourceFreshness: period ?? undefined,
      sourceCoverageLevel: "comune",
      licensingNote: "Dati ISTAT — Istituto Nazionale di Statistica — CC BY 3.0 IT",
    };
  } catch (e) {
    log("istat exception", String(e));
    return unavailableIstat("provider_unavailable") as IstatResult;
  }
}

/* ══════════════════════════════════════════════════════
   OMI — Real database lookup for official property valuations
   ══════════════════════════════════════════════════════

   Queries the omi_quotazioni table populated via the omi-ingest
   edge function with real Agenzia delle Entrate data.

   Lookup priority: catastale code > ISTAT code > comune name
   ══════════════════════════════════════════════════════ */

async function queryOmiReal(
  cadastralCode: string | null,
  istatCode: string | null,
  comuneLabel: string | null,
  supabase: ReturnType<typeof createClient>,
): Promise<unknown> {
  if (!cadastralCode && !istatCode && !comuneLabel) {
    return unavailableOmi("no_match");
  }

  try {
    // Build query — priority: catastale > istat > nome comune
    let query = supabase
      .from("omi_quotazioni")
      .select("*")
      .eq("tipologia", "Abitazioni civili")
      .order("anno", { ascending: false })
      .order("semestre", { ascending: false })
      .limit(20);

    if (cadastralCode) {
      query = query.eq("codice_comune_catastale", cadastralCode);
    } else if (istatCode) {
      query = query.eq("codice_comune_istat", istatCode);
    } else if (comuneLabel) {
      query = query.ilike("comune_label", comuneLabel);
    }

    const { data, error } = await query;

    if (error) {
      log("omi db error", error.message);
      return unavailableOmi("provider_unavailable");
    }

    if (!data || data.length === 0) {
      log("omi", "no data in database for this location");
      return unavailableOmi("no_coverage");
    }

    // Get the most recent semester
    const latest = data[0];
    const samePeriod = data.filter(
      (d: Record<string, unknown>) => d.anno === latest.anno && d.semestre === latest.semestre
    );

    // Calculate overall min/max across all zones for the same period
    const allMin = Math.min(...samePeriod.map((d: Record<string, unknown>) => Number(d.quotazione_min)));
    const allMax = Math.max(...samePeriod.map((d: Record<string, unknown>) => Number(d.quotazione_max)));

    // Identify zones
    const zones = [...new Set(samePeriod.map((d: Record<string, unknown>) => String(d.zona_omi)))];
    const zoneLabels = [...new Set(samePeriod.map((d: Record<string, unknown>) => d.zona_omi_label).filter(Boolean))];

    log("omi result", `zones=${zones.join(",")}, range=${allMin}-${allMax}, period=${latest.semestre}S${latest.anno}`);

    return {
      zonaOmi: zones.length === 1 ? zones[0] : zones.join(", "),
      zonaOmiLabel: zones.length === 1
        ? (latest.zona_omi_label ?? zones[0])
        : `${zones.length} zone nel comune di ${latest.comune_label ?? comuneLabel}`,
      comuneLabel: latest.comune_label ?? comuneLabel,
      quotazioneMinResidenziale: allMin,
      quotazioneMaxResidenziale: allMax,
      semestre: `${latest.semestre}° semestre ${latest.anno}`,
      tipologia: latest.tipologia,
      statoConservazione: latest.stato_conservazione,
      sourceType: "official",
      sourceProvider: "omi",
      sourceLabel: "OMI / Agenzia delle Entrate",
      sourceFreshness: `${latest.anno}-S${latest.semestre}`,
      sourcePeriod: `${latest.semestre}° semestre ${latest.anno}`,
      sourceCoverageLevel: zones.length === 1 ? "zone_omi" : "comune",
      licensingNote: "Dati OMI — Osservatorio del Mercato Immobiliare, Agenzia delle Entrate",
    };
  } catch (e) {
    log("omi exception", String(e));
    return unavailableOmi("provider_unavailable");
  }
}

/* ══════════════════════════════════════════════════════
   OVERPASS — POI query (unchanged, always available)
   ══════════════════════════════════════════════════════ */

const POI_CATEGORIES = [
  { key: "transport", label: "Trasporti", tags: ["railway=station", "amenity=bus_station", "station=subway"] },
  { key: "education", label: "Istruzione", tags: ["amenity=school", "amenity=university", "amenity=kindergarten"] },
  { key: "health", label: "Salute", tags: ["amenity=hospital", "amenity=pharmacy", "amenity=clinic"] },
  { key: "shopping", label: "Commercio", tags: ["shop=supermarket", "shop=mall", "amenity=marketplace"] },
  { key: "parks", label: "Aree verdi", tags: ["leisure=park", "leisure=garden"] },
  { key: "culture", label: "Cultura", tags: ["amenity=library", "tourism=museum", "amenity=theatre"] },
];

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

  try {
    const res = await fetchT("https://overpass-api.de/api/interpreter", 9000);
    // Use POST for Overpass
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 9000);
    const postRes = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    clearTimeout(tid);

    if (!postRes.ok) {
      const text = await postRes.text();
      log("overpass http error", `${postRes.status}: ${text.slice(0, 200)}`);
      return [];
    }

    const data = await postRes.json();
    return data.elements ?? [];
  } catch (e) {
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
    name: string; category: string; categoryLabel: string;
    distance: number; lat: number; lng: number; provider: string;
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

    pois.push({ name, category: cat.category, categoryLabel: cat.categoryLabel, distance, lat: elLat, lng: elLng, provider: "overpass" });
  }

  pois.sort((a, b) => a.distance - b.distance);
  const seen = new Set<string>();
  const unique = pois.filter(p => {
    const key = `${p.category}:${p.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const catMap = new Map<string, typeof unique>();
  for (const p of unique) {
    if (!catMap.has(p.category)) catMap.set(p.category, []);
    catMap.get(p.category)!.push(p);
  }

  const categories = Array.from(catMap.entries()).map(([category, items]) => ({
    category, categoryLabel: items[0].categoryLabel, count: items.length, nearest: items[0],
  }));

  return {
    totalPois: unique.length,
    categories,
    pois: unique.slice(0, 30),
    searchRadius: radius,
    sourceType: "verified_geo",
    sourceProvider: "overpass",
    sourceLabel: "OpenStreetMap / Overpass API",
    sourceFreshness: new Date().toISOString().slice(0, 10),
    licensingNote: "© OpenStreetMap contributors — ODbL",
    attributionNote: "Dati cartografici © OpenStreetMap contributors",
  };
}

/* ── Google Places POI Enrichment (unchanged, optional) ── */

async function queryGooglePlaces(lat: number, lng: number, radius: number, apiKey: string): Promise<unknown> {
  const types = ["school", "hospital", "pharmacy", "supermarket", "park", "transit_station", "library", "museum"];
  const allResults: unknown[] = [];

  for (const type of types.slice(0, 4)) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}&language=it`;
      const res = await fetchT(url, 4000);
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
      category: "general", categoryLabel: "Servizio",
      distance: loc ? Math.round(haversine(lat, lng, loc.lat, loc.lng)) : 0,
      lat: loc?.lat ?? lat, lng: loc?.lng ?? lng,
      provider: "google_places",
    };
  });

  return {
    pois: pois.slice(0, 20), totalPois: pois.length,
    sourceType: "premium", sourceProvider: "google_places",
    sourceLabel: "Google Places API", licensingNote: "Powered by Google",
  };
}

/* ══════════════════════════════════════════════════════
   MAIN HANDLER
   ══════════════════════════════════════════════════════ */

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // Use service role client for OMI reads (bypasses RLS for internal data)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "Auth verification failed" }, 200);
    }

    // Parse request
    const body = await req.json();
    const { lat, lng, modules, radius = 800 } = body as {
      lat: number; lng: number; modules?: string[]; radius?: number;
    };

    if (lat == null || lng == null) {
      return json({ error: "lat/lng required" }, 200);
    }

    const requestedModules = modules ?? ["poi", "omi", "istat"];
    log("request", `modules=${requestedModules.join(",")}, lat=${lat}, lng=${lng}`);

    const results: Record<string, unknown> = {};

    // Step 1: Identify municipality (needed for ISTAT + OMI)
    let geoId: GeoIdentity | null = null;

    if (requestedModules.includes("omi") || requestedModules.includes("istat")) {
      geoId = await identifyMunicipality(lat, lng);
      log("geo identity", `comune=${geoId.comuneLabel}, istat=${geoId.istatCode}, catastale=${geoId.cadastralCode}`);
    }

    // Step 2: Execute all modules in parallel
    const promises: Promise<void>[] = [];

    if (requestedModules.includes("poi")) {
      promises.push(
        (async () => {
          try {
            const elements = await queryOverpassPoi(lat, lng, radius);
            const poiResult = buildPoiResult(elements, lat, lng, radius);

            // Optional Google Places enrichment
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
              sourceType: "unavailable", sourceProvider: "overpass",
              availabilityReason: "provider_unavailable",
              totalPois: 0, categories: [], pois: [],
            };
          }
        })()
      );
    }

    if (requestedModules.includes("istat")) {
      promises.push(
        (async () => {
          try {
            if (!geoId?.istatCode) {
              log("istat", "no ISTAT code available — skipping");
              results.istat = unavailableIstat(geoId?.comuneLabel ? "no_match" : "no_coverage");
              return;
            }
            results.istat = await queryIstatSdmx(geoId.istatCode, geoId.comuneLabel ?? "");
          } catch (e) {
            log("istat module failed", String(e));
            results.istat = unavailableIstat("provider_unavailable");
          }
        })()
      );
    }

    if (requestedModules.includes("omi")) {
      promises.push(
        (async () => {
          try {
            results.omi = await queryOmiReal(
              geoId?.cadastralCode ?? null,
              geoId?.istatCode ?? null,
              geoId?.comuneLabel ?? null,
              supabaseAdmin,
            );
          } catch (e) {
            log("omi module failed", String(e));
            results.omi = unavailableOmi("provider_unavailable");
          }
        })()
      );
    }

    await Promise.allSettled(promises);

    return json({
      ok: true,
      data: results,
      geoIdentity: geoId ? {
        comuneLabel: geoId.comuneLabel,
        provinciaLabel: geoId.provinciaLabel,
        istatCode: geoId.istatCode ? "resolved" : null,
        cadastralCode: geoId.cadastralCode ? "resolved" : null,
      } : null,
      timestamp: new Date().toISOString(),
    });
  } catch (topErr) {
    log("FATAL", String(topErr));
    return json({ ok: false, error: "Internal error", data: {} }, 200);
  }
});
