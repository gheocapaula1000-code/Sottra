import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders as getCorsHeaders, handleCors } from "../_shared/cors.ts";

let _currentReq: Request | undefined;

const log = (step: string, detail?: string) =>
  console.log(`[pro-sources] ${step}${detail ? ` — ${detail}` : ""}`);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(_currentReq), "Content-Type": "application/json" },
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

    await new Promise(r => setTimeout(r, 1100));

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
   NOMINATIM — Forward geocode a typed Italian address
   ══════════════════════════════════════════════════════ */

async function forwardGeocode(address: string): Promise<Record<string, unknown>> {
  try {
    const q = /italia/i.test(address) ? address : `${address}, Italia`;
    const searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1&countrycodes=it&addressdetails=1`;
    const searchRes = await fetchT(searchUrl, 8000, { "User-Agent": "Sottra/1.0 (real-estate-analysis)" });

    if (!searchRes.ok) {
      const t = await searchRes.text();
      log("nominatim forward error", `${searchRes.status}: ${t.slice(0, 100)}`);
      return { sourceType: "unavailable", availabilityReason: "provider_unavailable", sourceLabel: "OpenStreetMap Nominatim" };
    }

    const searchData = await searchRes.json();
    if (!Array.isArray(searchData) || searchData.length === 0) {
      log("nominatim forward", "no results");
      return { sourceType: "unavailable", availabilityReason: "no_match", sourceLabel: "OpenStreetMap Nominatim" };
    }

    const best = searchData[0] as Record<string, unknown>;
    const lat = Number(best.lat);
    const lng = Number(best.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      log("nominatim forward", "invalid coords");
      return { sourceType: "unavailable", availabilityReason: "no_match", sourceLabel: "OpenStreetMap Nominatim" };
    }

    log("nominatim forward", `lat=${lat}, lng=${lng}`);
    return {
      lat,
      lng,
      displayName: typeof best.display_name === "string" ? best.display_name : null,
      sourceType: "verified_geo",
      sourceProvider: "nominatim",
      sourceLabel: "OpenStreetMap Nominatim",
    };
  } catch (e) {
    log("nominatim forward exception", String(e));
    return { sourceType: "unavailable", availabilityReason: "provider_unavailable", sourceLabel: "OpenStreetMap Nominatim" };
  }
}

/* ══════════════════════════════════════════════════════
   ISTAT — Real SDMX REST API query for demographic data
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
  geoLevel?: string;
  geoLabel?: string;
  availabilityReason?: string;
  licensingNote?: string;
}

async function queryIstatSdmx(istatCode: string, comuneLabel: string): Promise<IstatResult> {
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
      geoLevel: "comune",
      geoLabel: comuneLabel ? `Comune di ${comuneLabel}` : undefined,
      licensingNote: "Dati ISTAT — Istituto Nazionale di Statistica — CC BY 3.0 IT",
    };
  } catch (e) {
    log("istat exception", String(e));
    return unavailableIstat("provider_unavailable") as IstatResult;
  }
}

/* ══════════════════════════════════════════════════════
   SUB-MUNICIPAL DEMOGRAPHICS — from demographic_zones table
   Checks for sub-municipal data first, falls back to ISTAT municipal
   ══════════════════════════════════════════════════════ */

async function querySubMunicipalDemographics(
  lat: number,
  lng: number,
  cadastralCode: string | null,
  zonaOmi: string | null,
  supabase: ReturnType<typeof createClient>,
): Promise<IstatResult | null> {
  if (!cadastralCode) return null;

  try {
    // Strategy 1: If we have a matched OMI zone, try direct join via zona_omi
    if (zonaOmi) {
      const { data: zoneData, error } = await supabase
        .from("demographic_zones")
        .select("*")
        .eq("codice_comune_catastale", cadastralCode)
        .eq("zona_omi", zonaOmi)
        .order("anno_rilevazione", { ascending: false })
        .order("is_official", { ascending: false })
        .limit(10);

      if (!error && zoneData && zoneData.length > 0) {
        const best = selectBestRecord(zoneData, "zona_omi");
        log("demographic_zones", `OMI join match: zone=${best.zona_label}, type=${best.zona_type}, matchMethod=zona_omi`);
        return mapDemographicZoneToResult(best, "zona_omi");
      }
    }

    // Strategy 2: Point-in-polygon on demographic zone polygons
    const { data: polyData, error: polyError } = await supabase
      .from("demographic_zones")
      .select("*")
      .eq("codice_comune_catastale", cadastralCode)
      .not("polygon_coords", "is", null)
      .order("anno_rilevazione", { ascending: false });

    if (!polyError && polyData && polyData.length > 0) {
      const matchingZones: Record<string, unknown>[] = [];
      for (const zone of polyData) {
        const coords = zone.polygon_coords as number[][][];
        if (coords && pointInMultiPolygon(lat, lng, coords)) {
          matchingZones.push(zone);
        }
      }
      if (matchingZones.length > 0) {
        const best = selectBestRecord(matchingZones, "point_in_polygon");
        log("demographic_zones", `polygon match: zone=${best.zona_label}, type=${best.zona_type}, matchMethod=point_in_polygon, candidates=${matchingZones.length}`);
        return mapDemographicZoneToResult(best, "point_in_polygon");
      }
      log("demographic_zones", `${polyData.length} zones checked, no polygon match`);
    }

    return null;
  } catch (e) {
    log("demographic_zones exception", String(e));
    return null;
  }
}

/** Coverage level precision rank (lower = more precise) */
const COVERAGE_RANK: Record<string, number> = {
  microzona: 0, sezione_censimento: 1, zona: 2, quartiere: 3,
  area_subcomunale: 4, comune: 5,
};

/** Select the best record among multiple candidates with explicit priority rules.
 *  Returns the record AND the selectionReason string. */
function selectBestRecord(candidates: Record<string, unknown>[], method: string): Record<string, unknown> & { _selectionReason?: string } {
  if (candidates.length === 1) {
    const r = candidates[0] as Record<string, unknown> & { _selectionReason?: string };
    r._selectionReason = "unico_candidato";
    return r;
  }

  const QUALITY_ORDER: Record<string, number> = { alto: 3, standard: 2, basso: 1 };

  const metricsCount = (r: Record<string, unknown>) => {
    let c = 0;
    for (const k of ["popolazione", "densita", "eta_media", "nuclei_familiari", "percentuale_stranieri", "percentuale_giovani", "percentuale_famiglie"]) {
      if (typeof r[k] === "number") c++;
    }
    return c;
  };

  // Sort with deterministic priority chain
  const sorted = [...candidates].sort((a, b) => {
    // 1. More precise coverage_level
    const covA = COVERAGE_RANK[String(a.coverage_level ?? "comune")] ?? 5;
    const covB = COVERAGE_RANK[String(b.coverage_level ?? "comune")] ?? 5;
    if (covA !== covB) return covA - covB;

    // 2. Most recent anno_rilevazione
    const annoA = String(a.anno_rilevazione ?? "0");
    const annoB = String(b.anno_rilevazione ?? "0");
    if (annoA !== annoB) return annoB.localeCompare(annoA);

    // 3. is_official = true wins
    const offA = a.is_official === true ? 1 : 0;
    const offB = b.is_official === true ? 1 : 0;
    if (offA !== offB) return offB - offA;

    // 4. Higher data_quality
    const qA = QUALITY_ORDER[String(a.data_quality ?? "standard")] ?? 2;
    const qB = QUALITY_ORDER[String(b.data_quality ?? "standard")] ?? 2;
    if (qA !== qB) return qB - qA;

    // 5. Prefer zona_omi match method over polygon
    const hasZonaOmiA = typeof a.zona_omi === "string" && a.zona_omi.length > 0 ? 1 : 0;
    const hasZonaOmiB = typeof b.zona_omi === "string" && b.zona_omi.length > 0 ? 1 : 0;
    if (hasZonaOmiA !== hasZonaOmiB) return hasZonaOmiB - hasZonaOmiA;

    // 6. More metrics available
    return metricsCount(b) - metricsCount(a);
  });

  // Determine WHY this record won
  const winner = sorted[0];
  const runnerUp = sorted[1];
  let reason = "migliore_per_";
  const covW = COVERAGE_RANK[String(winner.coverage_level ?? "comune")] ?? 5;
  const covR = COVERAGE_RANK[String(runnerUp.coverage_level ?? "comune")] ?? 5;
  if (covW < covR) reason += "copertura_più_precisa";
  else if (String(winner.anno_rilevazione ?? "0") > String(runnerUp.anno_rilevazione ?? "0")) reason += "anno_più_recente";
  else if ((winner.is_official === true) && !(runnerUp.is_official === true)) reason += "fonte_ufficiale";
  else if ((QUALITY_ORDER[String(winner.data_quality ?? "standard")] ?? 2) > (QUALITY_ORDER[String(runnerUp.data_quality ?? "standard")] ?? 2)) reason += "qualità_dato_superiore";
  else if (metricsCount(winner) > metricsCount(runnerUp)) reason += "più_metriche_disponibili";
  else reason += "ordine_deterministico";

  log("selectBestRecord", `${candidates.length} candidates, selected anno=${winner.anno_rilevazione}, official=${winner.is_official}, quality=${winner.data_quality}, method=${method}, reason=${reason}`);

  const result = winner as Record<string, unknown> & { _selectionReason?: string };
  result._selectionReason = reason;
  return result;
}

function mapDemographicZoneToResult(z: Record<string, unknown>, matchMethod: string): IstatResult {
  const zonaType = String(z.zona_type ?? "quartiere");
  const geoLevel = zonaType === "microzona_omi" ? "microzona"
    : zonaType === "sezione_censuaria" ? "microzona"
    : zonaType === "quartiere" ? "quartiere"
    : zonaType === "circoscrizione" ? "quartiere"
    : zonaType === "zona_statistica" ? "quartiere"
    : "zona";

  const coverageLevel = typeof z.coverage_level === "string" ? z.coverage_level : undefined;
  const isOfficial = typeof z.is_official === "boolean" ? z.is_official : true;
  const dataQuality = typeof z.data_quality === "string" ? z.data_quality : "standard";

  const confidence = matchMethod === "zona_omi"
    ? (dataQuality === "alto" ? 0.97 : dataQuality === "standard" ? 0.90 : 0.75)
    : (dataQuality === "alto" ? 0.92 : dataQuality === "standard" ? 0.85 : 0.70);

  const selectionReason = typeof (z as Record<string, unknown>)._selectionReason === "string"
    ? (z as Record<string, unknown>)._selectionReason as string
    : undefined;

  return {
    popolazione: typeof z.popolazione === "number" ? z.popolazione : null,
    nucleiFamiliari: typeof z.nuclei_familiari === "number" ? z.nuclei_familiari : null,
    densita: typeof z.densita === "number" ? z.densita : null,
    indiceVecchiaia: typeof z.indice_vecchiaia === "number" ? z.indice_vecchiaia : null,
    percentualeStranieri: typeof z.percentuale_stranieri === "number" ? z.percentuale_stranieri : null,
    comuneLabel: typeof z.comune_label === "string" ? z.comune_label : null,
    annoRilevazione: typeof z.anno_rilevazione === "string" ? z.anno_rilevazione : null,
    sourceType: isOfficial ? "official" : String(z.source_type ?? "elaborated"),
    sourceProvider: "istat",
    sourceLabel: typeof z.source_label === "string" ? z.source_label : "ISTAT Censimento",
    sourceFreshness: typeof z.anno_rilevazione === "string" ? z.anno_rilevazione : undefined,
    sourceCoverageLevel: zonaType === "microzona_omi" ? "zone_omi" : (coverageLevel ?? "quartiere"),
    geoLevel,
    geoLabel: typeof z.zona_label === "string" ? z.zona_label : undefined,
    licensingNote: "Dati ISTAT — Istituto Nazionale di Statistica — CC BY 3.0 IT",
    matchMethod,
    matchConfidence: confidence,
    selectionReason,
    isOfficial,
    dataQuality,
  } as IstatResult;
}

/* ══════════════════════════════════════════════════════
   POINT-IN-POLYGON — Ray casting algorithm
   ══════════════════════════════════════════════════════ */

function pointInPolygon(lat: number, lng: number, ring: number[][]): boolean {
  // ring is array of [lng, lat] pairs
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    // x = lng, y = lat in our coordinate system
    if (((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInMultiPolygon(lat: number, lng: number, polygons: number[][][]): boolean {
  for (const ring of polygons) {
    if (pointInPolygon(lat, lng, ring)) return true;
  }
  return false;
}

/** Official fascia (B1) from zona_omi or gold G224-B1. Does not invent a zone. */
function extractOmiFascia(zona: string | null | undefined): string | null {
  if (!zona) return null;
  const gold = zona.match(/^[A-Z]\d{3}-([A-E]\d{1,2})$/i);
  if (gold) return gold[1].toUpperCase();
  const fascia = zona.match(/\b([A-E]\d{1,2})\b/i);
  return fascia ? fascia[1].toUpperCase() : null;
}

/**
 * When several polygons contain the point (Padova centro B1 ∩ B2), prefer the
 * official PD* / B1 microzona over a conflicting B2. Gold G224-B1 is the same B1.
 * National polygons stay in the table — this only picks among hits.
 */
function preferPolygonMatch<T extends { zona_omi?: string | null }>(matches: T[]): T | null {
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  let best = matches[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const row of matches) {
    const zona = String(row.zona_omi ?? "");
    const fascia = extractOmiFascia(zona);
    const officialFascia = /^[A-E]\d{1,2}$/i.test(zona.trim());
    let score = 0;
    if (fascia === "B1") score += 50;
    if (officialFascia && fascia === "B1") score += 40;
    if (/^G224/i.test(zona) && fascia === "B1") score += 25;
    if (officialFascia) score += 10;
    if (fascia === "B2") score -= 40;
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return best;
}

/* ══════════════════════════════════════════════════════
   OMI — Real database lookup with polygon point-in-polygon
   ══════════════════════════════════════════════════════

   Two-tier lookup:
   1. Try polygon match (omi_polygons) for exact zone
   2. Fall back to municipal aggregate (omi_quotazioni)
   ══════════════════════════════════════════════════════ */

async function queryOmiWithPolygons(
  lat: number,
  lng: number,
  cadastralCode: string | null,
  istatCode: string | null,
  comuneLabel: string | null,
  supabase: ReturnType<typeof createClient>,
): Promise<unknown> {
  if (!cadastralCode && !istatCode && !comuneLabel) {
    return unavailableOmi("no_match");
  }

  try {
    // ── Step 1: Try polygon-based zone identification ──
    let matchedZone: string | null = null;
    let matchedComuneLabel: string | null = null;
    let matchedCodCatastale: string | null = cadastralCode;
    let polygonMatch = false;

    if (cadastralCode) {
      const { data: polyData, error: polyError } = await supabase
        .from("omi_polygons")
        .select("zona_omi, comune_label, polygon_coords")
        .eq("codice_comune_catastale", cadastralCode)
        .order("anno", { ascending: false })
        .order("semestre", { ascending: false });

      if (!polyError && polyData && polyData.length > 0) {
        log("omi polygons", `found ${polyData.length} zones for ${cadastralCode}`);

        const containing: typeof polyData = [];
        for (const row of polyData) {
          const coords = row.polygon_coords as number[][][];
          if (coords && pointInMultiPolygon(lat, lng, coords)) {
            containing.push(row);
          }
        }
        const preferred = preferPolygonMatch(containing);
        if (preferred) {
          const rawZone = preferred.zona_omi;
          matchedZone = extractOmiFascia(rawZone) ?? rawZone;
          matchedComuneLabel = preferred.comune_label || comuneLabel;
          polygonMatch = true;
          log("omi polygon match", `zone=${matchedZone} (raw=${rawZone}, candidates=${containing.map((r) => r.zona_omi).join(",")}) for ${cadastralCode}`);
        }

        if (!polygonMatch) {
          log("omi polygons", "point not inside any polygon for this comune");
        }
      } else {
        log("omi polygons", polyError ? `error: ${polyError.message}` : "no polygons for this comune");
      }
    }

    // ── Step 2: Query quotazioni ──
    let query = supabase
      .from("omi_quotazioni")
      .select("*")
      .eq("tipologia", "Abitazioni civili")
      .order("anno", { ascending: false })
      .order("semestre", { ascending: false })
      .limit(20);

    if (polygonMatch && matchedZone && matchedCodCatastale) {
      // Exact zone match from polygon
      query = query
        .eq("codice_comune_catastale", matchedCodCatastale)
        .eq("zona_omi", matchedZone);
    } else if (cadastralCode) {
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
      // If we had a polygon match but no quotazioni, still return zone info
      if (polygonMatch && matchedZone) {
        log("omi", `polygon match zone=${matchedZone} but no quotazioni data`);

        // Try to get zone description
        let zoneDescr = matchedZone;
        try {
          const { data: zd } = await supabase
            .from("omi_zone")
            .select("zona_descr")
            .eq("codice_comune_catastale", matchedCodCatastale!)
            .eq("zona_omi", matchedZone)
            .limit(1);
          if (zd?.[0]?.zona_descr) zoneDescr = zd[0].zona_descr;
        } catch { /* non-fatal */ }

        return {
          zonaOmi: matchedZone,
          zonaOmiLabel: zoneDescr,
          comuneLabel: matchedComuneLabel ?? comuneLabel,
          quotazioneMinResidenziale: null,
          quotazioneMaxResidenziale: null,
          sourceType: "official",
          sourceProvider: "omi",
          sourceLabel: "OMI / Agenzia delle Entrate",
          sourceCoverageLevel: "zone_omi",
          polygonMatch: true,
          omiGeoLevel: "microzona_omi",
          matchMethod: "polygon",
          matchConfidence: 0.95,
          availabilityReason: "zone_identified_no_quotazioni",
          licensingNote: "Dati OMI — Osservatorio del Mercato Immobiliare, Agenzia delle Entrate",
        };
      }

      log("omi", "no data in database for this location");
      return unavailableOmi("no_coverage");
    }

    // Get the most recent semester — prefer NORMALE civile when that band exists.
    const latest = data[0];
    const samePeriod = data.filter(
      (d: Record<string, unknown>) => d.anno === latest.anno && d.semestre === latest.semestre
    );
    const normale = samePeriod.filter((d: Record<string, unknown>) =>
      /normale/i.test(String(d.stato_conservazione ?? ""))
    );
    const quoteRows = normale.length > 0 ? normale : samePeriod;

    const allMin = Math.min(...quoteRows.map((d: Record<string, unknown>) => Number(d.quotazione_min)));
    const allMax = Math.max(...quoteRows.map((d: Record<string, unknown>) => Number(d.quotazione_max)));

    const zones = [...new Set(samePeriod.map((d: Record<string, unknown>) => String(d.zona_omi)))];

    log("omi result", `zones=${zones.join(",")}, range=${allMin}-${allMax}, period=${latest.semestre}S${latest.anno}, polygonMatch=${polygonMatch}`);

    // Get zone descriptions
    let zoneDescriptions: string[] = [];
    try {
      const { data: zoneData } = await supabase
        .from("omi_zone")
        .select("zona_omi, zona_descr, fascia")
        .eq("codice_comune_catastale", latest.codice_comune_catastale)
        .eq("anno", latest.anno)
        .eq("semestre", latest.semestre)
        .in("zona_omi", zones);

      if (zoneData && zoneData.length > 0) {
        zoneDescriptions = zoneData.map((z: Record<string, unknown>) => String(z.zona_descr)).filter(Boolean);
      }
    } catch { /* non-fatal */ }

    const zoneLabel = zones.length === 1
      ? (zoneDescriptions[0] || latest.zona_omi_label || zones[0])
      : `${zones.length} zone nel comune di ${latest.comune_label ?? comuneLabel}`;

    // Determine coverage level
    const coverageLevel = polygonMatch ? "zone_omi" : (zones.length === 1 ? "zone_omi" : "comune");

    // Determine omiGeoLevel based on match quality
    const omiGeoLevel = polygonMatch ? "microzona_omi"
      : (zones.length === 1 ? "zona_specifica" : "comune");

    return {
      zonaOmi: zones.length === 1 ? zones[0] : zones.join(", "),
      zonaOmiLabel: zoneLabel,
      comuneLabel: latest.comune_label ?? comuneLabel,
      quotazioneMinResidenziale: allMin,
      quotazioneMaxResidenziale: allMax,
      semestre: `${latest.semestre}° semestre ${latest.anno}`,
      tipologia: latest.tipologia,
      statoConservazione: (quoteRows[0] as Record<string, unknown> | undefined)?.stato_conservazione ?? latest.stato_conservazione,
      sourceType: "official",
      sourceProvider: "omi",
      sourceLabel: "OMI / Agenzia delle Entrate",
      sourceFreshness: `${latest.anno}-S${latest.semestre}`,
      sourcePeriod: `${latest.semestre}° semestre ${latest.anno}`,
      sourceCoverageLevel: coverageLevel,
      polygonMatch,
      omiGeoLevel,
      matchMethod: polygonMatch ? "polygon" : "catastale_fallback",
      matchConfidence: polygonMatch ? 0.95 : (zones.length === 1 ? 0.7 : 0.5),
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
  _currentReq = req;
  const preflight = handleCors(req);
  if (preflight) return preflight;

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
    const { lat, lng, modules, radius = 800, address } = body as {
      lat?: number; lng?: number; modules?: string[]; radius?: number; address?: string;
    };

    const requestedModules = modules ?? ["poi", "omi", "istat"];

    if (requestedModules.length === 1 && requestedModules[0] === "geocode") {
      const addr = typeof address === "string" ? address.trim() : "";
      log("request", `modules=geocode, address=${addr.slice(0, 80)}`);
      if (addr.length < 3) {
        return json({
          ok: true,
          data: { geocode: { sourceType: "unavailable", availabilityReason: "no_match", sourceLabel: "OpenStreetMap Nominatim" } },
        });
      }
      const geocode = await forwardGeocode(addr);
      return json({ ok: true, data: { geocode } });
    }

    if (lat == null || lng == null) {
      return json({ error: "lat/lng required" }, 200);
    }

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
            // Step 1: Try sub-municipal demographics from demographic_zones table
            // We need OMI results for zona_omi join, so OMI runs in parallel
            // but we check results after all promises settle
            if (!geoId?.istatCode && !geoId?.cadastralCode) {
              log("istat", "no ISTAT/cadastral code available — skipping");
              results.istat = unavailableIstat(geoId?.comuneLabel ? "no_match" : "no_coverage");
              return;
            }

            // Try sub-municipal first
            const subMunicipal = await querySubMunicipalDemographics(
              lat, lng,
              geoId?.cadastralCode ?? null,
              null, // zona_omi not yet known at this point
              supabaseAdmin,
            );

            if (subMunicipal) {
              log("istat", `sub-municipal data found: geoLevel=${subMunicipal.geoLevel}, label=${subMunicipal.geoLabel}`);
              results.istat = subMunicipal;
              return;
            }

            // Fallback to municipal ISTAT
            if (!geoId?.istatCode) {
              log("istat", "no ISTAT code for municipal fallback");
              results.istat = unavailableIstat("no_coverage");
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
            results.omi = await queryOmiWithPolygons(
              lat,
              lng,
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

    // Post-processing: If ISTAT is still municipal and OMI found a zone, retry sub-municipal with zona_omi
    const istatResult = results.istat as IstatResult | undefined;
    const omiResult = results.omi as Record<string, unknown> | undefined;
    if (
      istatResult?.geoLevel === "comune" &&
      omiResult?.zonaOmi &&
      typeof omiResult.zonaOmi === "string" &&
      geoId?.cadastralCode
    ) {
      const subWithOmi = await querySubMunicipalDemographics(
        lat, lng, geoId.cadastralCode, omiResult.zonaOmi as string, supabaseAdmin,
      );
      if (subWithOmi) {
        log("istat post-process", `upgraded to sub-municipal via OMI zone: ${subWithOmi.geoLabel}`);
        results.istat = subWithOmi;
      }
    }

    // ── Sub-Municipal ASC layer (non-invasive enrichment) ──
    // Safe: if table is empty or query fails, subMunicipalMatch is null
    let subMunicipalMatch: Record<string, unknown> | null = null;
    try {
      const { data: ascData, error: ascError } = await supabaseAdmin
        .from("sub_municipal_areas_2021")
        .select("asc_level, area_code, area_name, area_type, comune_catastale_code, comune_istat_code, comune_name, source_dataset, polygon_coords, popolazione, densita, eta_media, superficie_kmq")
        .not("polygon_coords", "is", null)
        .gte("centroid_lat", lat - 0.5)
        .lte("centroid_lat", lat + 0.5)
        .gte("centroid_lng", lng - 0.5)
        .lte("centroid_lng", lng + 0.5)
        .limit(200);

      if (!ascError && ascData && ascData.length > 0) {
        for (const row of ascData) {
          const geom = row.polygon_coords as { type?: string; coordinates?: unknown } | null;
          if (!geom?.type || !geom?.coordinates) continue;

          let matched = false;
          if (geom.type === "Polygon") {
            const rings = geom.coordinates as number[][][];
            if (rings[0]) matched = pointInPolygon(lat, lng, rings[0]);
          } else if (geom.type === "MultiPolygon") {
            const polys = geom.coordinates as number[][][][];
            matched = polys.some((rings) => rings[0] && pointInPolygon(lat, lng, rings[0]));
          }

          if (matched) {
            subMunicipalMatch = {
              available: true,
              matched: true,
              level: row.asc_level,
              code: row.area_code,
              name: row.area_name,
              type: row.area_type,
              comune_code: row.comune_catastale_code,
              comune_name: row.comune_name,
              source_dataset: row.source_dataset,
              source_type: "official_data",
              match_method: "polygon",
              match_confidence: "polygon",
              coverage_status: "available",
              popolazione: row.popolazione,
              densita: row.densita,
              eta_media: row.eta_media,
              superficie_kmq: row.superficie_kmq,
              note: `Area sub-comunale ISTAT 2021 — livello ${row.asc_level ?? "n/a"}`,
            };
            log("asc match", `area=${row.area_name}, code=${row.area_code}, level=${row.asc_level}`);

            // ── R03 Lombardia Pilot: enrich with aggregated census data ──
            try {
              let comuneIstatForR03: string | null = (row as any).comune_istat_code ?? null;
              if (!comuneIstatForR03 && row.comune_catastale_code) {
                const { data: omiRef } = await supabaseAdmin
                  .from("omi_zone")
                  .select("codice_comune_istat")
                  .eq("codice_comune_catastale", row.comune_catastale_code)
                  .not("codice_comune_istat", "is", null)
                  .limit(1)
                  .maybeSingle();
                comuneIstatForR03 = omiRef?.codice_comune_istat ?? null;
              }
              if (!comuneIstatForR03 && geoId?.istatCode) {
                comuneIstatForR03 = geoId.istatCode;
              }

              let aggQuery = supabaseAdmin
                .from("r03_asc_aggregates_2021")
                .select("population_2021, families_2021, dwellings_2021, occupied_dwellings_2021, buildings_2021, residential_buildings_2021, density_pop_per_kmq, coverage_status, sections_count, sections_with_data, asc_name, superficie_kmq, comune_istat_code")
                .eq("asc_code", row.area_code)
                .eq("asc_level", row.asc_level ?? 0);

              if (comuneIstatForR03) {
                aggQuery = aggQuery.eq("comune_istat_code", comuneIstatForR03);
              }

              const { data: aggData, error: aggErr } = await aggQuery.maybeSingle();

              if (!aggErr && aggData) {
                subMunicipalMatch.r03_enriched = true;
                subMunicipalMatch.r03_coverage = aggData.coverage_status;
                subMunicipalMatch.r03_population = aggData.population_2021;
                subMunicipalMatch.r03_families = aggData.families_2021;
                subMunicipalMatch.r03_dwellings = aggData.dwellings_2021;
                subMunicipalMatch.r03_buildings = aggData.buildings_2021;
                subMunicipalMatch.r03_density = aggData.density_pop_per_kmq;
                subMunicipalMatch.r03_sections_count = aggData.sections_count;
                subMunicipalMatch.r03_sections_with_data = aggData.sections_with_data;
                if (aggData.asc_name && !subMunicipalMatch.name) subMunicipalMatch.name = aggData.asc_name;
                if (aggData.superficie_kmq) subMunicipalMatch.superficie_kmq = aggData.superficie_kmq;
                if (aggData.density_pop_per_kmq) subMunicipalMatch.densita = aggData.density_pop_per_kmq;
                if (aggData.population_2021) subMunicipalMatch.popolazione = aggData.population_2021;
                subMunicipalMatch.note = `Pilota Lombardia R03 — ${aggData.sections_count} sezioni censuarie aggregate`;
                log("r03 enrich", `asc=${row.area_code} pop=${aggData.population_2021} cov=${aggData.coverage_status}`);
              }
            } catch (r03Err) {
              log("r03 enrich error (non-fatal)", String(r03Err));
            }

            break;
          }
        }
        if (!subMunicipalMatch) {
          subMunicipalMatch = {
            available: true, matched: false,
            coverage_status: "partial",
            note: `${ascData.length} aree ASC verificate, punto non ricade in nessun poligono`,
          };
          log("asc", `${ascData.length} areas checked, no polygon match`);
        }
      } else {
        subMunicipalMatch = {
          available: false, matched: false,
          coverage_status: "unavailable",
          note: ascError ? `Errore query ASC: ${ascError.message}` : "Nessun dato ASC disponibile in quest'area",
        };
        log("asc", ascError ? `error: ${ascError.message}` : "no ASC data in range");
      }
    } catch (ascErr) {
      log("asc exception (non-fatal)", String(ascErr));
      subMunicipalMatch = { available: false, matched: false, coverage_status: "unavailable", note: "Errore interno ASC" };
    }

    // ── Località enrichment from territorial_registry ──
    // If we have a comune istat code, try to find matching località
    if (geoId?.istatCode && subMunicipalMatch) {
      try {
        const { data: locData, error: locErr } = await supabaseAdmin
          .from("territorial_registry")
          .select("localita_code, localita_name, localita_type, centroid_lat, centroid_lng")
          .eq("comune_istat_code", geoId.istatCode)
          .eq("geographic_level", "localita")
          .not("localita_code", "eq", "")
          .limit(200);

        if (!locErr && locData && locData.length > 0) {
          // If we have centroids, find the nearest località
          let bestLoc: typeof locData[0] | null = null;
          let bestDist = Infinity;
          for (const loc of locData) {
            if (loc.centroid_lat != null && loc.centroid_lng != null) {
              const d = haversine(lat, lng, Number(loc.centroid_lat), Number(loc.centroid_lng));
              if (d < bestDist) { bestDist = d; bestLoc = loc; }
            }
          }
          // Only assign if within 3km (reasonable for a località)
          if (bestLoc && bestDist < 3000) {
            subMunicipalMatch.localita_name = bestLoc.localita_name;
            subMunicipalMatch.localita_type = bestLoc.localita_type;
            subMunicipalMatch.localita_code = bestLoc.localita_code;
            log("localita match", `name=${bestLoc.localita_name}, dist=${Math.round(bestDist)}m`);
          } else if (locData.length > 0 && !bestLoc) {
            // No centroids available, just note that località exist but can't match
            log("localita", `${locData.length} località found for comune but no centroids for matching`);
          }
        }
      } catch (locErr) {
        log("localita lookup error (non-fatal)", String(locErr));
      }
    }

    return json({
      ok: true,
      data: results,
      subMunicipalMatch,
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
