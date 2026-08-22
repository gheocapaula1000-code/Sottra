/**
 * Address Resolution Engine — Sottra Phase 5 + ANNCSU Integration
 *
 * Provides rigorous address/civic normalization and resolution.
 * When ANNCSU data is provided, uses it as official support source
 * WITHOUT promoting to building truth automatically.
 *
 * Distinction chain:
 * 1. official_street_support — street found in ANNCSU
 * 2. official_civic_support — civic found in ANNCSU
 * 3. precise_location_support — geo-consistent official match
 * 4. building_truth_support — ALWAYS FALSE (future policy)
 */

import type { CanonicalGeoLevel } from "@/lib/geoBackbone";
import { geoLevelLabel } from "@/lib/geoBackbone";
import type { FactSupportLevel } from "@/lib/buildingProfileEngine";

/* ═══════════════════════════════════════════════════════════
   ADDRESS STATUS TAXONOMY
   ═══════════════════════════════════════════════════════════ */

export type StreetMatchStatus =
  | "exact_match"
  | "exact_official_match"
  | "normalized_official_match"
  | "normalized_match"
  | "fuzzy_match"
  | "coordinate_assisted"
  | "contextual_only"
  | "not_found"
  | "not_determinable"
  | "unsupported_claim";

export type CivicMatchStatus =
  | "exact_match"
  | "official_exact_match"
  | "official_candidate_match"
  | "official_ambiguous"
  | "partial_match"
  | "ambiguous"
  | "not_found"
  | "not_determinable"
  | "not_introduced_from_source"
  | "unsupported_claim";

export type AddressResolutionStatus =
  | "resolved"
  | "partially_resolved"
  | "unresolved"
  | "degraded"
  | "not_determinable";

export type AmbiguityLevel = "none" | "low" | "medium" | "high" | "critical";

export type AnncsuMatchStatus =
  | "exact_official_street_match"
  | "normalized_official_street_match"
  | "official_street_only"
  | "official_civic_candidate_match"
  | "official_civic_ambiguous"
  | "no_official_match"
  | "not_determinable";

/* ═══════════════════════════════════════════════════════════
   ANNCSU CANDIDATE — passed in from query layer
   ═══════════════════════════════════════════════════════════ */

export interface AnncsuCandidate {
  street_name: string;
  street_type: string | null;
  civic_normalized: string | null;
  esponente: string | null;
  cod_strada: string | null;
  comune_istat_code: string;
  comune_label: string | null;
  ingest_readiness: string;
  ambiguity_flags: string[];
}

/* ═══════════════════════════════════════════════════════════
   ADDRESS IDENTITY
   ═══════════════════════════════════════════════════════════ */

export interface AddressIdentity {
  raw_input: string;
  normalized_address_string: string;
  normalized_street_name: string | null;
  normalized_street_type: string | null;
  normalized_locality: string | null;
  normalized_comune: string | null;
  normalized_province: string | null;
  normalized_region: string | null;
}

/* ═══════════════════════════════════════════════════════════
   ADDRESS NORMALIZATION
   ═══════════════════════════════════════════════════════════ */

export interface AddressNormalization {
  normalization_applied: string[];
  tokens_removed: string[];
  tokens_standardized: string[];
  house_number_raw: string | null;
  house_number_normalized: string | null;
  staircase_raw: string | null;
  internal_raw: string | null;
  unresolved_tokens: string[];
  ambiguity_flags: string[];
}

/* ═══════════════════════════════════════════════════════════
   ADDRESS RESOLUTION
   ═══════════════════════════════════════════════════════════ */

export interface AddressResolution {
  resolution_status: AddressResolutionStatus;
  matched_geo_scope: CanonicalGeoLevel;
  matched_street_status: StreetMatchStatus;
  matched_street_name: string | null;
  matched_street_confidence: number;
  matched_by: "exact" | "normalized" | "fuzzy" | "coordinate_assisted" | "contextual_only" | "official_exact" | "official_normalized" | "none";
  matched_by_source: string | null;
  candidate_count: number;
  ambiguity_level: AmbiguityLevel;
  geo_anchor: string | null;
  territorial_anchor: string | null;
  building_anchor: string | null;
  unresolved_reason: string | null;
  /** ANNCSU integration fields */
  anncsu_match_status: AnncsuMatchStatus;
  anncsu_candidate_count: number;
  anncsu_street_exactness: "exact" | "normalized" | "none";
  anncsu_civic_exactness: "exact" | "candidate" | "ambiguous" | "none";
  source_chain: string[];
  official_street_support: boolean;
  official_civic_support: boolean;
  precise_location_support: boolean;
  /** LOCKED FALSE — future policy required to change */
  building_truth_support: false;
}

/* ═══════════════════════════════════════════════════════════
   CIVIC RESOLUTION
   ═══════════════════════════════════════════════════════════ */

export interface CivicResolution {
  civic_status: CivicMatchStatus;
  civic_input_present: boolean;
  civic_normalized: string | null;
  civic_match_status: CivicMatchStatus;
  civic_confidence: number;
  civic_ambiguity: AmbiguityLevel;
  civic_supported_as_precise_location: boolean;
  civic_supported_as_building_truth: boolean;
  civic_reasoning_summary: string;
}

/* ═══════════════════════════════════════════════════════════
   ADDRESS QUALITY
   ═══════════════════════════════════════════════════════════ */

export interface AddressQuality {
  overall_address_quality: "strong" | "moderate" | "weak" | "none";
  street_match_strength: "strong" | "moderate" | "weak" | "none";
  civic_match_strength: "strong" | "moderate" | "weak" | "none";
  source_chain_clarity: "high" | "medium" | "low";
  geocoding_dependency_level: "none" | "low" | "medium" | "high";
  overprecision_risk: "low" | "medium" | "high";
  false_specificity_risk: "low" | "medium" | "high";
  key_warnings: string[];
}

/* ═══════════════════════════════════════════════════════════
   ADDRESS LIMITATIONS
   ═══════════════════════════════════════════════════════════ */

export interface AddressLimitations {
  missing_official_address_registry: boolean;
  missing_civic_registry: boolean;
  ambiguous_street_name: boolean;
  duplicate_candidates: boolean;
  geocoding_only: boolean;
  text_only: boolean;
  no_precise_building_link: boolean;
  blocking_gaps: string[];
  transparency_notes: string[];
}

/* ═══════════════════════════════════════════════════════════
   ADDRESS SUMMARY
   ═══════════════════════════════════════════════════════════ */

export interface AddressSummary {
  executive_summary: string;
  analytical_summary: string;
  safe_user_summary: string;
  next_best_step: string;
}

/* ═══════════════════════════════════════════════════════════
   ADDRESS REPORTABILITY
   ═══════════════════════════════════════════════════════════ */

export type AddressReportSectionKey =
  | "address_precision"
  | "street_match"
  | "civic_match"
  | "address_limitations"
  | "false_precision_risk";

export interface AddressSectionReportability {
  can_render: boolean;
  render_mode: "full" | "partial" | "hidden";
  reason: string;
  source_basis: string | null;
}

export interface AddressReportability {
  sections: Record<AddressReportSectionKey, AddressSectionReportability>;
}

/* ═══════════════════════════════════════════════════════════
   FULL ADDRESS RESOLUTION RESULT
   ═══════════════════════════════════════════════════════════ */

export interface AddressResolutionResult {
  address_identity: AddressIdentity;
  address_normalization: AddressNormalization;
  address_resolution: AddressResolution;
  civic_resolution: CivicResolution;
  address_quality: AddressQuality;
  address_limitations: AddressLimitations;
  address_summary: AddressSummary;
  address_reportability: AddressReportability;
}

/* ═══════════════════════════════════════════════════════════
   ENGINE INPUT
   ═══════════════════════════════════════════════════════════ */

export interface AddressResolutionInput {
  raw_address: string;
  comune?: string | null;
  provincia?: string | null;
  regione?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Already-resolved geo level from backbone */
  resolved_geo_level?: CanonicalGeoLevel | null;
  /** ANNCSU candidates pre-fetched from query layer */
  anncsu_street_candidates?: AnncsuCandidate[];
  /** ANNCSU civic candidates pre-fetched from query layer */
  anncsu_civic_candidates?: AnncsuCandidate[];
}

/* ═══════════════════════════════════════════════════════════
   ITALIAN STREET TYPE NORMALIZATION
   ═══════════════════════════════════════════════════════════ */

const STREET_TYPE_MAP: Record<string, string> = {
  "v.": "Via", "v": "Via", "via": "Via",
  "vle": "Viale", "viale": "Viale", "v.le": "Viale",
  "c.so": "Corso", "corso": "Corso",
  "p.za": "Piazza", "p.zza": "Piazza", "piazza": "Piazza", "pza": "Piazza",
  "l.go": "Largo", "largo": "Largo",
  "vic.": "Vicolo", "vicolo": "Vicolo",
  "str.": "Strada", "strada": "Strada",
  "c.le": "Cortile", "cortile": "Cortile",
  "p.le": "Piazzale", "piazzale": "Piazzale",
  "s.da": "Strada",
  "trav.": "Traversa", "traversa": "Traversa",
  "borgata": "Borgata",
  "contrada": "Contrada", "c.da": "Contrada",
  "loc.": "Località", "località": "Località", "localita": "Località",
  "fraz.": "Frazione", "frazione": "Frazione",
};

const NOISE_TOKENS = new Set([
  "italia", "italy", "it", "snc", "s.n.c.", "s.n.c",
  "int.", "interno", "sc.", "scala", "piano", "p.",
]);

/* ═══════════════════════════════════════════════════════════
   NORMALIZATION LOGIC
   ═══════════════════════════════════════════════════════════ */

interface ParsedAddress {
  streetType: string | null;
  streetName: string | null;
  houseNumber: string | null;
  staircaseRaw: string | null;
  internalRaw: string | null;
  locality: string | null;
  normalized: string;
  applied: string[];
  removed: string[];
  standardized: string[];
  unresolved: string[];
  ambiguityFlags: string[];
}

function parseAndNormalize(raw: string, comune?: string | null): ParsedAddress {
  const applied: string[] = [];
  const removed: string[] = [];
  const standardized: string[] = [];
  const unresolved: string[] = [];
  const ambiguityFlags: string[] = [];

  if (!raw || !raw.trim()) {
    return {
      streetType: null, streetName: null, houseNumber: null,
      staircaseRaw: null, internalRaw: null, locality: null,
      normalized: "", applied: [], removed: [], standardized: [],
      unresolved: ["input_vuoto"], ambiguityFlags: ["no_input"],
    };
  }

  // 1. Basic cleanup
  let text = raw.trim();
  text = text.replace(/\s+/g, " ");
  text = text.replace(/[""]/g, '"');
  applied.push("whitespace_normalization");

  // 2. Remove trailing country/region noise
  const lowerFull = text.toLowerCase();
  for (const noise of NOISE_TOKENS) {
    if (lowerFull.endsWith(` ${noise}`) || lowerFull === noise) {
      text = text.slice(0, text.length - noise.length).trim().replace(/,\s*$/, "");
      removed.push(noise);
    }
  }

  // 3. Split by comma for multi-part addresses
  const parts = text.split(",").map(p => p.trim()).filter(Boolean);
  let mainPart = parts[0] || "";
  const extraParts = parts.slice(1);

  // 4. Extract staircase / internal from extra parts
  let staircaseRaw: string | null = null;
  let internalRaw: string | null = null;
  for (const ep of extraParts) {
    const lower = ep.toLowerCase();
    if (/^(sc\.?|scala)\s/i.test(lower)) {
      staircaseRaw = ep;
    } else if (/^(int\.?|interno)\s/i.test(lower)) {
      internalRaw = ep;
    }
  }

  // 5. Extract house number (last token if numeric-like)
  let houseNumber: string | null = null;
  const mainTokens = mainPart.split(/\s+/);
  if (mainTokens.length >= 2) {
    const last = mainTokens[mainTokens.length - 1];
    if (/^\d+[a-zA-Z/]*$/.test(last) || /^\d+\s*bis$/i.test(last)) {
      houseNumber = last;
      mainTokens.pop();
      mainPart = mainTokens.join(" ");
    }
  }

  // 6. Extract and normalize street type
  let streetType: string | null = null;
  if (mainTokens.length >= 1) {
    const firstLower = mainTokens[0].toLowerCase().replace(/\.$/, "").replace(/\.$/, "");
    const firstWithDot = mainTokens[0].toLowerCase();
    const mapped = STREET_TYPE_MAP[firstLower] || STREET_TYPE_MAP[firstWithDot];
    if (mapped) {
      streetType = mapped;
      mainTokens.shift();
      standardized.push(`${firstLower} → ${mapped}`);
      applied.push("street_type_normalization");
    }
  }

  // 7. Remaining tokens = street name
  const streetName = mainTokens.join(" ").trim() || null;

  // 8. Build normalized string
  const normalizedParts: string[] = [];
  if (streetType) normalizedParts.push(streetType);
  if (streetName) normalizedParts.push(streetName);
  if (houseNumber) normalizedParts.push(houseNumber);
  const normalized = normalizedParts.join(" ");

  // 9. Detect ambiguity
  if (!streetType && streetName) {
    ambiguityFlags.push("tipo_strada_mancante");
  }
  if (streetName && streetName.length <= 2) {
    ambiguityFlags.push("nome_strada_troppo_corto");
  }
  if (!houseNumber) {
    ambiguityFlags.push("civico_assente");
  }
  if (extraParts.length > 2) {
    ambiguityFlags.push("indirizzo_complesso");
  }

  // 10. Locality from extra parts (non staircase/internal)
  let locality: string | null = null;
  for (const ep of extraParts) {
    const lower = ep.toLowerCase();
    if (!/^(sc\.?|scala|int\.?|interno)\s/i.test(lower) && ep !== staircaseRaw && ep !== internalRaw) {
      if (!comune || lower !== comune.toLowerCase()) {
        locality = ep;
      }
    }
  }

  return {
    streetType, streetName, houseNumber,
    staircaseRaw, internalRaw, locality,
    normalized, applied, removed, standardized,
    unresolved, ambiguityFlags,
  };
}

/* ═══════════════════════════════════════════════════════════
   ANNCSU MATCHING LOGIC
   ═══════════════════════════════════════════════════════════ */

interface AnncsuMatchResult {
  match_status: AnncsuMatchStatus;
  street_exactness: "exact" | "normalized" | "none";
  civic_exactness: "exact" | "candidate" | "ambiguous" | "none";
  candidate_count: number;
  official_street_support: boolean;
  official_civic_support: boolean;
  precise_location_support: boolean;
  best_street_name: string | null;
  confidence_boost: number;
  source_chain: string[];
}

function normalizeForComparison(s: string): string {
  return s.toLowerCase().replace(/[''`]/g, "'").replace(/\s+/g, " ").trim();
}

function matchAnncsu(
  parsed: ParsedAddress,
  streetCandidates: AnncsuCandidate[],
  civicCandidates: AnncsuCandidate[],
  hasCoords: boolean,
): AnncsuMatchResult {
  const noMatch: AnncsuMatchResult = {
    match_status: "no_official_match",
    street_exactness: "none",
    civic_exactness: "none",
    candidate_count: 0,
    official_street_support: false,
    official_civic_support: false,
    precise_location_support: false,
    best_street_name: null,
    confidence_boost: 0,
    source_chain: ["text_normalization"],
  };

  if (!parsed.streetName || streetCandidates.length === 0) {
    return { ...noMatch, match_status: streetCandidates.length === 0 ? "no_official_match" : "not_determinable" };
  }

  // Filter only ready candidates
  const readyCandidates = streetCandidates.filter(c =>
    c.ingest_readiness === "ready" || c.ingest_readiness === "ready_with_warnings"
  );
  if (readyCandidates.length === 0) {
    return { ...noMatch, match_status: "no_official_match" };
  }

  // Try exact street name match
  const normalizedInput = normalizeForComparison(parsed.streetName);
  const exactStreetMatches = readyCandidates.filter(c =>
    normalizeForComparison(c.street_name) === normalizedInput
  );

  // Try with type if available
  let streetExactness: "exact" | "normalized" | "none" = "none";
  let bestMatches = exactStreetMatches;

  if (exactStreetMatches.length > 0) {
    // Check if type also matches for true exact
    if (parsed.streetType) {
      const typeMatches = exactStreetMatches.filter(c =>
        c.street_type && normalizeForComparison(c.street_type) === normalizeForComparison(parsed.streetType!)
      );
      if (typeMatches.length > 0) {
        streetExactness = "exact";
        bestMatches = typeMatches;
      } else {
        streetExactness = "normalized";
      }
    } else {
      streetExactness = "normalized";
    }
  }

  if (bestMatches.length === 0) {
    // Try normalized comparison (case-insensitive, accent-insensitive)
    const normalizedMatches = readyCandidates.filter(c => {
      const cName = normalizeForComparison(c.street_name);
      return cName.includes(normalizedInput) || normalizedInput.includes(cName);
    });
    if (normalizedMatches.length > 0) {
      streetExactness = "normalized";
      bestMatches = normalizedMatches;
    }
  }

  if (bestMatches.length === 0) {
    return noMatch;
  }

  // Street is officially supported
  const officialStreetSupport = true;
  const bestStreetName = bestMatches[0].street_type
    ? `${bestMatches[0].street_type} ${bestMatches[0].street_name}`
    : bestMatches[0].street_name;

  // Now check civic
  let civicExactness: "exact" | "candidate" | "ambiguous" | "none" = "none";
  let officialCivicSupport = false;
  let matchStatus: AnncsuMatchStatus = streetExactness === "exact"
    ? "exact_official_street_match" : "normalized_official_street_match";

  if (parsed.houseNumber && civicCandidates.length > 0) {
    const normalizedCivic = parsed.houseNumber.toUpperCase().trim();
    const readyCivics = civicCandidates.filter(c =>
      (c.ingest_readiness === "ready" || c.ingest_readiness === "ready_with_warnings") &&
      c.civic_normalized != null
    );

    const exactCivicMatches = readyCivics.filter(c =>
      c.civic_normalized!.toUpperCase().trim() === normalizedCivic
    );

    if (exactCivicMatches.length === 1) {
      civicExactness = "exact";
      officialCivicSupport = true;
      matchStatus = "official_civic_candidate_match";
    } else if (exactCivicMatches.length > 1) {
      // Multiple matches (e.g. esponenti) → ambiguous
      civicExactness = "ambiguous";
      officialCivicSupport = false;
      matchStatus = "official_civic_ambiguous";
    } else {
      // No exact match, check if any candidates exist for the street
      if (readyCivics.length > 0) {
        civicExactness = "candidate";
        matchStatus = "official_street_only";
      }
    }
  } else if (!parsed.houseNumber) {
    matchStatus = streetExactness === "exact"
      ? "exact_official_street_match" : "normalized_official_street_match";
  } else {
    matchStatus = "official_street_only";
  }

  // Precise location: only when exact street + unambiguous civic + coords assist
  const preciseLocationSupport = officialCivicSupport && civicExactness === "exact" && hasCoords;

  // Confidence boost from ANNCSU
  let confidenceBoost = 0;
  if (streetExactness === "exact") confidenceBoost += 0.3;
  else if (streetExactness === "normalized") confidenceBoost += 0.2;
  if (civicExactness === "exact") confidenceBoost += 0.15;
  else if (civicExactness === "candidate") confidenceBoost += 0.05;

  // Multiple street candidates reduce confidence
  if (bestMatches.length > 3) confidenceBoost *= 0.7;

  const sourceChain = ["text_normalization", "anncsu_official"];
  if (hasCoords) sourceChain.push("coordinate_assisted");

  return {
    match_status: matchStatus,
    street_exactness: streetExactness,
    civic_exactness: civicExactness,
    candidate_count: bestMatches.length,
    official_street_support: officialStreetSupport,
    official_civic_support: officialCivicSupport,
    precise_location_support: preciseLocationSupport,
    best_street_name: bestStreetName,
    confidence_boost: confidenceBoost,
    source_chain: sourceChain,
  };
}

/* ═══════════════════════════════════════════════════════════
   STREET MATCH LOGIC
   ═══════════════════════════════════════════════════════════ */

function resolveStreetMatch(
  parsed: ParsedAddress,
  hasCoords: boolean,
  anncsu: AnncsuMatchResult | null,
): { status: StreetMatchStatus; confidence: number; matchedBy: AddressResolution["matched_by"]; matchedName: string | null } {
  if (!parsed.streetName) {
    return { status: "not_found", confidence: 0, matchedBy: "none", matchedName: null };
  }

  const baseMatchedName = parsed.streetType && parsed.streetName
    ? `${parsed.streetType} ${parsed.streetName}` : parsed.streetName;

  // With ANNCSU support
  if (anncsu && anncsu.official_street_support) {
    if (anncsu.street_exactness === "exact") {
      const conf = Math.min(0.85, 0.7 + anncsu.confidence_boost);
      return {
        status: "exact_official_match",
        confidence: conf,
        matchedBy: "official_exact",
        matchedName: anncsu.best_street_name || baseMatchedName,
      };
    }
    if (anncsu.street_exactness === "normalized") {
      const conf = Math.min(0.75, 0.55 + anncsu.confidence_boost);
      return {
        status: "normalized_official_match",
        confidence: conf,
        matchedBy: "official_normalized",
        matchedName: anncsu.best_street_name || baseMatchedName,
      };
    }
  }

  // Fallback: text-only resolution (legacy behavior)
  if (!parsed.streetType) {
    if (hasCoords) {
      return { status: "coordinate_assisted", confidence: 0.3, matchedBy: "coordinate_assisted", matchedName: baseMatchedName };
    }
    return { status: "contextual_only", confidence: 0.2, matchedBy: "contextual_only", matchedName: baseMatchedName };
  }

  if (hasCoords) {
    return { status: "coordinate_assisted", confidence: 0.5, matchedBy: "coordinate_assisted", matchedName: baseMatchedName };
  }

  return { status: "normalized_match", confidence: 0.4, matchedBy: "normalized", matchedName: baseMatchedName };
}

/* ═══════════════════════════════════════════════════════════
   CIVIC MATCH LOGIC
   ═══════════════════════════════════════════════════════════ */

function resolveCivicMatch(
  parsed: ParsedAddress,
  streetConfidence: number,
  anncsu: AnncsuMatchResult | null,
): CivicResolution {
  const civicPresent = !!parsed.houseNumber;

  if (!civicPresent) {
    return {
      civic_status: "not_found",
      civic_input_present: false,
      civic_normalized: null,
      civic_match_status: "not_found",
      civic_confidence: 0,
      civic_ambiguity: "none",
      civic_supported_as_precise_location: false,
      civic_supported_as_building_truth: false,
      civic_reasoning_summary: "Nessun numero civico presente nell'input.",
    };
  }

  const civicNormalized = parsed.houseNumber!.toUpperCase();

  // With ANNCSU civic support
  if (anncsu && anncsu.official_civic_support && anncsu.civic_exactness === "exact") {
    const confidence = Math.min(0.7, streetConfidence * 0.85);
    return {
      civic_status: "official_exact_match",
      civic_input_present: true,
      civic_normalized: civicNormalized,
      civic_match_status: "official_exact_match",
      civic_confidence: Math.round(confidence * 100) / 100,
      civic_ambiguity: "low",
      civic_supported_as_precise_location: anncsu.precise_location_support,
      // CRITICAL: NEVER promote to building truth — ANNCSU alone is NOT enough
      civic_supported_as_building_truth: false,
      civic_reasoning_summary:
        `Civico "${civicNormalized}" trovato nel registro ufficiale ANNCSU. Il match ufficiale migliora la classificazione ma non viene promosso a verità sullo stabile. ANNCSU da solo non è sufficiente per determinare l'identità dell'edificio.`,
    };
  }

  // ANNCSU ambiguous civic
  if (anncsu && anncsu.civic_exactness === "ambiguous") {
    const confidence = Math.min(0.35, streetConfidence * 0.5);
    return {
      civic_status: "official_ambiguous",
      civic_input_present: true,
      civic_normalized: civicNormalized,
      civic_match_status: "official_ambiguous",
      civic_confidence: Math.round(confidence * 100) / 100,
      civic_ambiguity: "medium",
      civic_supported_as_precise_location: false,
      civic_supported_as_building_truth: false,
      civic_reasoning_summary:
        `Civico "${civicNormalized}" ha più corrispondenze nel registro ANNCSU (es. esponenti diversi). Match ambiguo, non promosso a verità sullo stabile.`,
    };
  }

  // ANNCSU street matched but civic is candidate only (exists in street but different number)
  if (anncsu && anncsu.official_street_support && anncsu.civic_exactness === "candidate") {
    const confidence = Math.min(0.4, streetConfidence * 0.6);
    return {
      civic_status: "official_candidate_match",
      civic_input_present: true,
      civic_normalized: civicNormalized,
      civic_match_status: "official_candidate_match",
      civic_confidence: Math.round(confidence * 100) / 100,
      civic_ambiguity: "medium",
      civic_supported_as_precise_location: false,
      civic_supported_as_building_truth: false,
      civic_reasoning_summary:
        `Civico "${civicNormalized}" non trovato esattamente nel registro ANNCSU, ma la strada è supportata ufficialmente. Il civico resta classificato come candidato, non viene promosso a verità sullo stabile.`,
    };
  }

  // Legacy: no ANNCSU support
  const confidence = Math.min(streetConfidence * 0.8, 0.4);
  const ambiguity: AmbiguityLevel = confidence >= 0.3 ? "medium" : "high";

  return {
    civic_status: "partial_match",
    civic_input_present: true,
    civic_normalized: civicNormalized,
    civic_match_status: "partial_match",
    civic_confidence: Math.round(confidence * 100) / 100,
    civic_ambiguity: ambiguity,
    civic_supported_as_precise_location: false,
    // NEVER promote to building truth without official registry
    civic_supported_as_building_truth: false,
    civic_reasoning_summary:
      `Civico "${civicNormalized}" estratto dal testo. Senza registro civici ufficiale, il match resta parziale e non viene promosso a verità sullo stabile.`,
  };
}

/* ═══════════════════════════════════════════════════════════
   MAIN ENGINE
   ═══════════════════════════════════════════════════════════ */

export function resolveAddress(input: AddressResolutionInput): AddressResolutionResult {
  const hasCoords = input.lat != null && input.lng != null;
  const parsed = parseAndNormalize(input.raw_address, input.comune);

  // --- Identity ---
  const address_identity: AddressIdentity = {
    raw_input: input.raw_address,
    normalized_address_string: parsed.normalized,
    normalized_street_name: parsed.streetName,
    normalized_street_type: parsed.streetType,
    normalized_locality: parsed.locality || input.comune || null,
    normalized_comune: input.comune || null,
    normalized_province: input.provincia || null,
    normalized_region: input.regione || null,
  };

  // --- Normalization ---
  const address_normalization: AddressNormalization = {
    normalization_applied: parsed.applied,
    tokens_removed: parsed.removed,
    tokens_standardized: parsed.standardized,
    house_number_raw: parsed.houseNumber,
    house_number_normalized: parsed.houseNumber?.toUpperCase() || null,
    staircase_raw: parsed.staircaseRaw,
    internal_raw: parsed.internalRaw,
    unresolved_tokens: parsed.unresolved,
    ambiguity_flags: parsed.ambiguityFlags,
  };

  // --- ANNCSU matching ---
  const anncsuResult = (input.anncsu_street_candidates && input.anncsu_street_candidates.length > 0)
    ? matchAnncsu(parsed, input.anncsu_street_candidates, input.anncsu_civic_candidates || [], hasCoords)
    : null;

  // --- Street resolution ---
  const streetMatch = resolveStreetMatch(parsed, hasCoords, anncsuResult);

  // --- Civic resolution ---
  const civic_resolution = resolveCivicMatch(parsed, streetMatch.confidence, anncsuResult);

  // --- Resolution status ---
  let resolutionStatus: AddressResolutionStatus = "not_determinable";
  if (streetMatch.status === "not_found" && !civic_resolution.civic_input_present) {
    resolutionStatus = "unresolved";
  } else if (streetMatch.confidence >= 0.6) {
    resolutionStatus = civic_resolution.civic_confidence >= 0.3 ? "resolved" : "partially_resolved";
  } else if (streetMatch.confidence >= 0.5) {
    resolutionStatus = civic_resolution.civic_confidence >= 0.3 ? "resolved" : "partially_resolved";
  } else if (streetMatch.confidence > 0) {
    resolutionStatus = "partially_resolved";
  } else {
    resolutionStatus = "degraded";
  }

  const ambiguityLevel: AmbiguityLevel =
    parsed.ambiguityFlags.length === 0 ? "none"
    : parsed.ambiguityFlags.length <= 1 ? "low"
    : parsed.ambiguityFlags.length <= 2 ? "medium"
    : "high";

  const hasAnncsu = anncsuResult != null && anncsuResult.official_street_support;

  const address_resolution: AddressResolution = {
    resolution_status: resolutionStatus,
    matched_geo_scope: input.resolved_geo_level || "comune",
    matched_street_status: streetMatch.status,
    matched_street_name: streetMatch.matchedName,
    matched_street_confidence: streetMatch.confidence,
    matched_by: streetMatch.matchedBy,
    matched_by_source: hasAnncsu ? "anncsu_official" : "text_parsing",
    candidate_count: anncsuResult ? anncsuResult.candidate_count : (streetMatch.status !== "not_found" ? 1 : 0),
    ambiguity_level: ambiguityLevel,
    geo_anchor: hasCoords ? `${input.lat!.toFixed(4)},${input.lng!.toFixed(4)}` : null,
    territorial_anchor: input.comune || null,
    building_anchor: null, // Never assumed without evidence
    unresolved_reason: streetMatch.status === "not_found"
      ? "Nessun nome strada identificato nell'input" : null,
    // ANNCSU fields
    anncsu_match_status: anncsuResult?.match_status ?? "not_determinable",
    anncsu_candidate_count: anncsuResult?.candidate_count ?? 0,
    anncsu_street_exactness: anncsuResult?.street_exactness ?? "none",
    anncsu_civic_exactness: anncsuResult?.civic_exactness ?? "none",
    source_chain: anncsuResult?.source_chain ?? ["text_normalization"],
    official_street_support: anncsuResult?.official_street_support ?? false,
    official_civic_support: anncsuResult?.official_civic_support ?? false,
    precise_location_support: anncsuResult?.precise_location_support ?? false,
    building_truth_support: false, // LOCKED
  };

  // --- Quality ---
  const streetStrength: AddressQuality["street_match_strength"] =
    hasAnncsu && streetMatch.confidence >= 0.7 ? "strong"
    : streetMatch.confidence >= 0.5 ? "moderate"
    : streetMatch.confidence > 0 ? "weak"
    : "none";

  const civicStrength: AddressQuality["civic_match_strength"] =
    anncsuResult?.official_civic_support ? "moderate"
    : civic_resolution.civic_confidence >= 0.3 ? "weak"
    : civic_resolution.civic_input_present ? "weak"
    : "none";

  const overallQuality: AddressQuality["overall_address_quality"] =
    streetStrength === "strong" && civicStrength !== "none" ? "strong"
    : streetStrength === "strong" || (streetStrength === "moderate" && civicStrength !== "none") ? "moderate"
    : streetStrength === "moderate" || streetStrength === "weak" ? "weak"
    : "none";

  const warnings: string[] = [];
  if (!parsed.streetType) warnings.push("Tipo strada non identificato");
  if (!parsed.houseNumber) warnings.push("Numero civico assente");
  if (parsed.ambiguityFlags.length > 0) {
    warnings.push(`Ambiguità rilevate: ${parsed.ambiguityFlags.join(", ")}`);
  }
  if (!hasAnncsu) {
    warnings.push("Nessun registro stradario/civici ufficiale disponibile per questo comune");
  }
  if (hasAnncsu && !anncsuResult?.official_civic_support) {
    warnings.push("Civico non trovato nel registro ufficiale ANNCSU");
  }

  const address_quality: AddressQuality = {
    overall_address_quality: overallQuality,
    street_match_strength: streetStrength,
    civic_match_strength: civicStrength,
    source_chain_clarity: hasAnncsu ? "high" : "low",
    geocoding_dependency_level: hasCoords ? "medium" : "none",
    overprecision_risk: hasAnncsu && anncsuResult?.official_civic_support ? "low" : (civic_resolution.civic_supported_as_building_truth ? "low" : "high"),
    false_specificity_risk: overallQuality === "none" ? "high" : hasAnncsu ? "low" : "medium",
    key_warnings: warnings,
  };

  // --- Limitations ---
  const hasOfficialRegistry = hasAnncsu;
  const address_limitations: AddressLimitations = {
    missing_official_address_registry: !hasOfficialRegistry,
    missing_civic_registry: !anncsuResult?.official_civic_support,
    ambiguous_street_name: parsed.ambiguityFlags.includes("tipo_strada_mancante"),
    duplicate_candidates: (anncsuResult?.candidate_count ?? 0) > 3,
    geocoding_only: hasCoords && !parsed.streetName,
    text_only: !hasCoords && !!parsed.streetName && !hasAnncsu,
    no_precise_building_link: true, // Always true — ANNCSU alone is NOT building truth
    blocking_gaps: hasOfficialRegistry
      ? ["Registro edifici non ancora attivo — ANNCSU supporta solo indirizzo/strada"]
      : [
        "Registro stradario ufficiale non disponibile per questo comune",
        "Registro civici ufficiale non disponibile",
      ],
    transparency_notes: [
      hasAnncsu
        ? "Indirizzo verificato contro il registro ufficiale ANNCSU del comune."
        : "L'indirizzo è stato normalizzato da testo, non verificato contro un registro ufficiale.",
      civic_resolution.civic_input_present
        ? (anncsuResult?.official_civic_support
          ? "Il civico è supportato ufficialmente da ANNCSU ma NON equivale a verità sullo stabile."
          : "Il civico è stato estratto dal testo ma non è supportato come verità sullo stabile.")
        : "Nessun civico presente nell'input.",
      hasCoords
        ? "Le coordinate assistono la localizzazione ma non validano l'indirizzo."
        : "Nessuna coordinata disponibile per assistere il match.",
    ],
  };

  // --- Summary ---
  const streetDesc = streetMatch.matchedName || parsed.streetName || "non identificata";
  const civicDesc = parsed.houseNumber || "assente";
  const officialNote = hasAnncsu ? " (supportato da ANNCSU)" : "";

  const executive_summary = resolutionStatus === "resolved" || resolutionStatus === "partially_resolved"
    ? `Indirizzo interpretato: ${streetDesc} ${civicDesc}${input.comune ? `, ${input.comune}` : ""}${officialNote}. Match ${resolutionStatus === "resolved" ? "con civico" : "solo strada"}.`
    : `Indirizzo non risolvibile in modo affidabile dall'input fornito.`;

  const analytical_summary = [
    `Input: "${input.raw_address}"`,
    `Strada: ${streetMatch.status} (confidence ${Math.round(streetMatch.confidence * 100)}%)`,
    `Civico: ${civic_resolution.civic_match_status}`,
    `ANNCSU: ${anncsuResult?.match_status ?? "non disponibile"}`,
    `Ambiguità: ${ambiguityLevel}`,
    `Registro ufficiale: ${hasAnncsu ? "ANNCSU disponibile" : "non disponibile"}`,
  ].join(". ") + ".";

  const safe_user_summary = resolutionStatus === "unresolved"
    ? "L'indirizzo fornito non è stato identificato in modo sufficiente."
    : hasAnncsu
      ? `L'indirizzo "${parsed.normalized || input.raw_address}" è supportato dal registro ufficiale. Questo conferma la strada${anncsuResult?.official_civic_support ? " e il civico" : ""} ma non equivale a una verifica completa sull'edificio.`
      : `L'indirizzo "${parsed.normalized || input.raw_address}" è stato interpretato dal testo. Questa interpretazione non equivale a una verifica ufficiale dell'indirizzo.`;

  const address_summary: AddressSummary = {
    executive_summary,
    analytical_summary,
    safe_user_summary,
    next_best_step: hasAnncsu
      ? "Il supporto ANNCSU migliora il match strada/civico. Per raggiungere verità piena sullo stabile servono ulteriori registri (catasto, registro edifici)."
      : "L'introduzione del registro stradario ufficiale ANNCSU migliorerebbe significativamente la precisione del match indirizzo.",
  };

  // --- Reportability ---
  const hasStreet = streetMatch.status !== "not_found";
  const hasCivic = civic_resolution.civic_input_present;

  const sr = (can: boolean, mode: "full" | "partial" | "hidden", reason: string, source: string | null): AddressSectionReportability =>
    ({ can_render: can, render_mode: mode, reason, source_basis: source });

  const address_reportability: AddressReportability = {
    sections: {
      address_precision: sr(
        hasStreet,
        hasStreet && hasAnncsu ? (streetStrength === "strong" ? "full" : "partial")
          : hasStreet && streetMatch.confidence >= 0.4 ? "partial"
          : hasStreet ? "partial" : "hidden",
        hasStreet
          ? (hasAnncsu ? "Strada verificata da ANNCSU" : "Strada identificata dal testo")
          : "Nessuna strada identificata",
        hasAnncsu ? "anncsu_official" : "text_parsing",
      ),
      street_match: sr(
        hasStreet,
        hasAnncsu && streetMatch.confidence >= 0.6 ? "full"
          : streetMatch.confidence >= 0.5 ? "partial"
          : hasStreet ? "partial" : "hidden",
        hasStreet ? `Match: ${streetMatch.status}` : "Nessun match",
        hasAnncsu ? "anncsu_official" : "text_normalization",
      ),
      civic_match: sr(
        hasCivic,
        anncsuResult?.official_civic_support ? "full"
          : hasCivic ? "partial" : "hidden",
        hasCivic
          ? (anncsuResult?.official_civic_support ? "Civico supportato da ANNCSU" : "Civico presente ma non verificato")
          : "Civico assente",
        anncsuResult?.official_civic_support ? "anncsu_official" : "text_parsing",
      ),
      address_limitations: sr(
        true, "full",
        "Limitazioni sempre rilevanti per layer indirizzo",
        null,
      ),
      false_precision_risk: sr(
        true,
        address_quality.overprecision_risk === "high" ? "full" : "partial",
        `Rischio sovraprecisione: ${address_quality.overprecision_risk}`,
        null,
      ),
    },
  };

  return {
    address_identity,
    address_normalization,
    address_resolution,
    civic_resolution,
    address_quality,
    address_limitations,
    address_summary,
    address_reportability,
  };
}

/* ═══════════════════════════════════════════════════════════
   HELPERS for Building Profile integration
   ═══════════════════════════════════════════════════════════ */

export function addressFactSupportLevel(res: AddressResolutionResult): FactSupportLevel {
  const q = res.address_quality.overall_address_quality;
  if (q === "strong") return "direct";
  if (q === "moderate") return "contextual";
  if (q === "weak") return "derived";
  return "unavailable";
}

export function addressQualityLabel(q: AddressQuality["overall_address_quality"]): string {
  switch (q) {
    case "strong": return "Forte";
    case "moderate": return "Moderata";
    case "weak": return "Debole";
    case "none": return "Non disponibile";
  }
}

export function streetMatchLabel(s: StreetMatchStatus): string {
  switch (s) {
    case "exact_match": return "Match esatto";
    case "exact_official_match": return "Match ufficiale esatto";
    case "normalized_official_match": return "Match ufficiale normalizzato";
    case "normalized_match": return "Match normalizzato";
    case "fuzzy_match": return "Match approssimativo";
    case "coordinate_assisted": return "Assistito da coordinate";
    case "contextual_only": return "Solo contestuale";
    case "not_found": return "Non trovato";
    case "not_determinable": return "Non determinabile";
    case "unsupported_claim": return "Affermazione non supportata";
  }
}

export function civicMatchLabel(s: CivicMatchStatus): string {
  switch (s) {
    case "exact_match": return "Match esatto";
    case "official_exact_match": return "Match ufficiale esatto";
    case "official_candidate_match": return "Candidato ufficiale";
    case "official_ambiguous": return "Ufficiale ambiguo";
    case "partial_match": return "Match parziale";
    case "ambiguous": return "Ambiguo";
    case "not_found": return "Non trovato";
    case "not_determinable": return "Non determinabile";
    case "not_introduced_from_source": return "Non da fonte ufficiale";
    case "unsupported_claim": return "Affermazione non supportata";
  }
}

export function anncsuMatchLabel(s: AnncsuMatchStatus): string {
  switch (s) {
    case "exact_official_street_match": return "Strada ufficiale esatta";
    case "normalized_official_street_match": return "Strada ufficiale normalizzata";
    case "official_street_only": return "Solo strada ufficiale";
    case "official_civic_candidate_match": return "Civico candidato ufficiale";
    case "official_civic_ambiguous": return "Civico ufficiale ambiguo";
    case "no_official_match": return "Nessun match ufficiale";
    case "not_determinable": return "Non determinabile";
  }
}
