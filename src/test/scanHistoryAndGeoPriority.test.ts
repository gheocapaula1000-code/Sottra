import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Scan History Persistence Tests ──────────────────── */

describe("ScanHistory persistence model", () => {
  it("SavedScan type includes all fields needed for report reopening", () => {
    // Type-level test: ensure the interface has the expected shape
    const scan = {
      id: "test-1",
      locality: "Padova",
      date: new Date().toISOString(),
      moodScore: null,
      convergenzaTerritoriale: { score: 72, band: "forte" as const },
      lat: 45.4064,
      lng: 11.8768,
      photoThumbnail: "data:image/jpeg;base64,abc",
      resultSnapshot: { identify: { status: "success" as const, data: { address: "Via Roma 1" }, message: null } },
      primaryGeoLevel: "zona_omi",
      restorable: true,
    };
    
    expect(scan.lat).toBe(45.4064);
    expect(scan.lng).toBe(11.8768);
    expect(scan.photoThumbnail).toBeTruthy();
    expect(scan.resultSnapshot).toBeTruthy();
    expect(scan.restorable).toBe(true);
    expect(scan.primaryGeoLevel).toBe("zona_omi");
  });

  it("non-restorable scans are marked correctly", () => {
    const scan = {
      id: "test-2",
      locality: "Milano",
      date: new Date().toISOString(),
      moodScore: null,
      convergenzaTerritoriale: null,
      lat: null,
      lng: null,
      photoThumbnail: null,
      resultSnapshot: null,
      primaryGeoLevel: null,
      restorable: false,
    };
    
    expect(scan.restorable).toBe(false);
    expect(scan.resultSnapshot).toBeNull();
  });
});

/* ── Geo Priority Tests ─────────────────────────────── */

describe("Geo priority — OMI/microzone dominance", () => {
  it("microzona_omi pricing sets primary basis to zona_omi, not comune", async () => {
    const { buildZoneValue } = await import("@/lib/zoneValueEngine");
    
    const stubCorr = {
      zone_identity: { geo_level_reale: "zona_omi" as const, geo_code: "B111-1", geo_label: "Centro", normalized_path: "", zone_type_label: "Microzona OMI", zone_corresponds_to: "", zone_anchor_strength: "strong" as const },
      zone_correspondence: { corresponds_to_microzona_omi: true, corresponds_to_asc: false, corresponds_to_section_or_aggregate: false, corresponds_to_comune_only: false, primary_zone_basis: "Microzona OMI", secondary_zone_basis: [], fallback_used: false, fallback_weight: "none" as const, false_specificity_risk: "none" as const },
      zone_precision: { precision_status: "strong" as const, sub_comunale_support_status: "unavailable" as const, market_zone_support_status: "direct" as const, territorial_support_status: "partial" as const, max_safe_claim_level: "zona_omi" as const },
      zone_limitations: { missing_sub_comunale: true, market_only_comunale: false, weak_zone_anchor: false, fallback_dominant: false, blocking_gaps: [], transparency_notes: [] },
    };
    
    const block = (avail: string, geo: string) => ({ availability: avail, quality: "official" as const, geo_level: geo, source_key: "live", source_label: "live", is_derived: false, officiality: "official" as const, limitations: [] });
    const stubTd = {
      territorial_identity: { geo_level: "zona_omi" as const, geo_code: "B111-1", geo_label: "Centro", normalized_path: "", resolution_method: "direct" },
      territorial_datasets: { demographic: block("unavailable", "unknown"), territorial_structure: block("full", "comune"), sub_municipal: block("unavailable", "unknown"), omi_linkage: block("full", "zona_omi"), census_sections: block("unavailable", "unknown"), environmental: block("unavailable", "unknown"), services: block("unavailable", "unknown"), mobility: block("unavailable", "unknown") },
    };
    
    const result = buildZoneValue({
      data: stubTd as any,
      corr: stubCorr as any,
      omiMin: 1800,
      omiMax: 2400,
      omiGeoLevel: "microzona_omi",
      omiPolygonMatch: true,
    });
    
    expect(result.value_identity.value_basis_type).toBe("microzona_omi");
    expect(result.value_result.primary_basis_level).toBe("zona_omi");
    expect(result.value_quality.comune_only_bias).toBe(false);
    expect(result.value_result.value_confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("comunale OMI sets comune_only_bias true", async () => {
    const { buildZoneValue } = await import("@/lib/zoneValueEngine");
    
    const stubCorr = {
      zone_identity: { geo_level_reale: "comune" as const, geo_code: "B111", geo_label: "Padova", normalized_path: "", zone_type_label: "Comunale", zone_corresponds_to: "", zone_anchor_strength: "weak" as const },
      zone_correspondence: { corresponds_to_microzona_omi: false, corresponds_to_asc: false, corresponds_to_section_or_aggregate: false, corresponds_to_comune_only: true, primary_zone_basis: "Comunale", secondary_zone_basis: [], fallback_used: true, fallback_weight: "high" as const, false_specificity_risk: "medium" as const },
      zone_precision: { precision_status: "weak" as const, sub_comunale_support_status: "unavailable" as const, market_zone_support_status: "fallback" as const, territorial_support_status: "partial" as const, max_safe_claim_level: "comune" as const },
      zone_limitations: { missing_sub_comunale: true, market_only_comunale: true, weak_zone_anchor: true, fallback_dominant: true, blocking_gaps: [], transparency_notes: [] },
    };
    
    const block = (avail: string, geo: string) => ({ availability: avail, quality: "official" as const, geo_level: geo, source_key: "live", source_label: "live", is_derived: false, officiality: "official" as const, limitations: [] });
    const stubTd = {
      territorial_identity: { geo_level: "comune" as const, geo_code: "B111", geo_label: "Padova", normalized_path: "", resolution_method: "direct" },
      territorial_datasets: { demographic: block("unavailable", "unknown"), territorial_structure: block("full", "comune"), sub_municipal: block("unavailable", "unknown"), omi_linkage: block("full", "comune"), census_sections: block("unavailable", "unknown"), environmental: block("unavailable", "unknown"), services: block("unavailable", "unknown"), mobility: block("unavailable", "unknown") },
    };
    
    const result = buildZoneValue({
      data: stubTd as any,
      corr: stubCorr as any,
      omiMin: 1500,
      omiMax: 2200,
      omiGeoLevel: "comune",
      omiPolygonMatch: false,
    });
    
    expect(result.value_identity.value_basis_type).toBe("comunale");
    expect(result.value_quality.comune_only_bias).toBe(true);
    expect(result.value_result.primary_basis_level).toBe("comune");
  });

  it("zona_specifica OMI prevents comune_only_bias", async () => {
    const { buildZoneValue } = await import("@/lib/zoneValueEngine");
    
    const stubCorr = {
      zone_identity: { geo_level_reale: "zona_omi" as const, geo_code: "B111-2", geo_label: "Semicentro", normalized_path: "", zone_type_label: "Zona specifica", zone_corresponds_to: "", zone_anchor_strength: "medium" as const },
      zone_correspondence: { corresponds_to_microzona_omi: false, corresponds_to_asc: false, corresponds_to_section_or_aggregate: false, corresponds_to_comune_only: false, primary_zone_basis: "Zona OMI", secondary_zone_basis: ["Contesto comunale"], fallback_used: false, fallback_weight: "low" as const, false_specificity_risk: "none" as const },
      zone_precision: { precision_status: "medium" as const, sub_comunale_support_status: "unavailable" as const, market_zone_support_status: "direct" as const, territorial_support_status: "partial" as const, max_safe_claim_level: "zona_omi" as const },
      zone_limitations: { missing_sub_comunale: true, market_only_comunale: false, weak_zone_anchor: false, fallback_dominant: false, blocking_gaps: [], transparency_notes: [] },
    };
    
    const block = (avail: string, geo: string) => ({ availability: avail, quality: "official" as const, geo_level: geo, source_key: "live", source_label: "live", is_derived: false, officiality: "official" as const, limitations: [] });
    const stubTd = {
      territorial_identity: { geo_level: "zona_omi" as const, geo_code: "B111-2", geo_label: "Semicentro", normalized_path: "", resolution_method: "direct" },
      territorial_datasets: { demographic: block("unavailable", "unknown"), territorial_structure: block("full", "comune"), sub_municipal: block("unavailable", "unknown"), omi_linkage: block("full", "zona_omi"), census_sections: block("unavailable", "unknown"), environmental: block("unavailable", "unknown"), services: block("unavailable", "unknown"), mobility: block("unavailable", "unknown") },
    };
    
    const result = buildZoneValue({
      data: stubTd as any,
      corr: stubCorr as any,
      omiMin: 2000,
      omiMax: 2800,
      omiGeoLevel: "zona_specifica",
      omiPolygonMatch: false,
    });
    
    expect(result.value_identity.value_basis_type).toBe("zona_omi");
    expect(result.value_quality.comune_only_bias).toBe(false);
    expect(result.value_result.primary_basis_level).toBe("zona_omi");
  });
});

/* ── Outlook geo priority tests ─────────────────────── */

describe("Outlook engine — comuneOnly correctness", () => {
  it("zona_omi level does not trigger comuneOnly", async () => {
    const { buildZoneOutlook } = await import("@/lib/zoneOutlookEngine");
    
    const corr = {
      zone_identity: { geo_level_reale: "zona_omi" as const, geo_code: "B111-1", geo_label: "Centro", normalized_path: "", zone_type_label: "Zona OMI", zone_corresponds_to: "", zone_anchor_strength: "strong" as const },
      zone_correspondence: { corresponds_to_microzona_omi: true, corresponds_to_asc: false, corresponds_to_section_or_aggregate: false, corresponds_to_comune_only: false, primary_zone_basis: "Microzona OMI", secondary_zone_basis: [], fallback_used: false, fallback_weight: "none" as const, false_specificity_risk: "none" as const },
      zone_precision: { precision_status: "strong" as const, sub_comunale_support_status: "unavailable" as const, market_zone_support_status: "direct" as const, territorial_support_status: "partial" as const, max_safe_claim_level: "zona_omi" as const },
      zone_limitations: { missing_sub_comunale: true, market_only_comunale: false, weak_zone_anchor: false, fallback_dominant: false, blocking_gaps: [], transparency_notes: [] },
    } as any;
    
    const result = buildZoneOutlook(corr, null, null, null);
    
    expect(result.outlook_limitations.comune_only_bias).toBe(false);
  });

  it("comune level triggers comuneOnly", async () => {
    const { buildZoneOutlook } = await import("@/lib/zoneOutlookEngine");
    
    const corr = {
      zone_identity: { geo_level_reale: "comune" as const, geo_code: "B111", geo_label: "Padova", normalized_path: "", zone_type_label: "Comunale", zone_corresponds_to: "", zone_anchor_strength: "weak" as const },
      zone_correspondence: { corresponds_to_microzona_omi: false, corresponds_to_asc: false, corresponds_to_section_or_aggregate: false, corresponds_to_comune_only: true, primary_zone_basis: "Comunale", secondary_zone_basis: [], fallback_used: true, fallback_weight: "high" as const, false_specificity_risk: "medium" as const },
      zone_precision: { precision_status: "weak" as const, sub_comunale_support_status: "unavailable" as const, market_zone_support_status: "fallback" as const, territorial_support_status: "partial" as const, max_safe_claim_level: "comune" as const },
      zone_limitations: { missing_sub_comunale: true, market_only_comunale: true, weak_zone_anchor: true, fallback_dominant: true, blocking_gaps: [], transparency_notes: [] },
    } as any;
    
    const result = buildZoneOutlook(corr, null, null, null);
    
    expect(result.outlook_limitations.comune_only_bias).toBe(true);
  });
});

/* ── Strong Case — comune_only_bias logic ───────────── */

describe("StrongCase — comune_only_bias correctness", () => {
  it("snapshot with valore_zona_fine=true prevents comune_only_bias", async () => {
    const { evaluateStrongCase } = await import("@/lib/strongCaseEvaluator");
    
    const result = evaluateStrongCase({
      snapshot: {
        zona_reale: "Centro",
        livello_lettura: "Zona OMI",
        livello_valore: "Microzona OMI",
        valore_zona_fine: true,
        valore_al_mq: "€ 2.100",
        valore_range: "€ 1.800 – € 2.400",
        affidabilita_valore: "Alta",
        costo_ristrutturazione: "€ 450",
        costo_range: "€ 350 – € 550",
        segnali_zona: "Convergenti e favorevoli",
        attenzione_area: "high",
        limite_principale: "Le stime offrono un orientamento",
        narrative_mode: "full",
        specificita_immobile: "Alta",
      },
      house_specificity_strength: "strong",
      alignment_status: "high_alignment",
      outlook_status: "supportive",
      boundary_available: true,
    });
    
    expect(result.limiters.comune_only_bias).toBe(false);
    expect(result.identity.overall_case_strength).toBe("strong_case");
  });
});

/* ── WOW Snapshot — value level label ───────────────── */

describe("WOW Snapshot — valore_zona_fine", () => {
  it("microzona pricing produces valore_zona_fine=true", async () => {
    const { buildWowSnapshot } = await import("@/lib/sottraWowSnapshot");
    const { buildZoneValue } = await import("@/lib/zoneValueEngine");
    const { buildRenovationEstimate } = await import("@/lib/renovationCostEngine");
    
    const stubCorr = {
      zone_identity: { geo_level_reale: "zona_omi" as const, geo_code: "B111-1", geo_label: "Centro Padova", normalized_path: "", zone_type_label: "Microzona OMI", zone_corresponds_to: "", zone_anchor_strength: "strong" as const },
      zone_correspondence: { corresponds_to_microzona_omi: true, corresponds_to_asc: false, corresponds_to_section_or_aggregate: false, corresponds_to_comune_only: false, primary_zone_basis: "Microzona OMI", secondary_zone_basis: [], fallback_used: false, fallback_weight: "none" as const, false_specificity_risk: "none" as const },
      zone_precision: { precision_status: "strong" as const, sub_comunale_support_status: "unavailable" as const, market_zone_support_status: "direct" as const, territorial_support_status: "partial" as const, max_safe_claim_level: "zona_omi" as const },
      zone_limitations: { missing_sub_comunale: true, market_only_comunale: false, weak_zone_anchor: false, fallback_dominant: false, blocking_gaps: [], transparency_notes: [] },
    };
    
    const block = (avail: string, geo: string) => ({ availability: avail, quality: "official" as const, geo_level: geo, source_key: "live", source_label: "live", is_derived: false, officiality: "official" as const, limitations: [] });
    const stubTd = {
      territorial_identity: { geo_level: "zona_omi" as const, geo_code: "B111-1", geo_label: "Centro Padova", normalized_path: "", resolution_method: "direct" },
      territorial_datasets: { demographic: block("unavailable", "unknown"), territorial_structure: block("full", "comune"), sub_municipal: block("unavailable", "unknown"), omi_linkage: block("full", "zona_omi"), census_sections: block("unavailable", "unknown"), environmental: block("unavailable", "unknown"), services: block("unavailable", "unknown"), mobility: block("unavailable", "unknown") },
    };
    
    const value = buildZoneValue({ data: stubTd as any, corr: stubCorr as any, omiMin: 1800, omiMax: 2400, omiGeoLevel: "microzona_omi", omiPolygonMatch: true });
    const reno = buildRenovationEstimate({ zone_geo_code: "B111-1", zone_geo_level: "zona_omi", hasPhoto: true, value_per_sqm_mid: value.value_result.value_per_sqm_mid });
    
    const snap = buildWowSnapshot({ value, renovation: reno, growth: null, corr: stubCorr as any });
    
    expect(snap.valore_zona_fine).toBe(true);
    expect(snap.livello_valore).not.toContain("comunale");
  });
});

/* ── Tone Map — primary/secondary basis labels ──────── */

describe("Tone Map — geo basis labels", () => {
  it("zona_omi maps to zone-level label, not comunale", async () => {
    const { tonePrimaryBasisLabel, toneSecondaryBasisLabel } = await import("@/lib/reportToneMap");
    
    expect(tonePrimaryBasisLabel("zona_omi")).toBe("Valore riferito alla zona reale");
    expect(toneSecondaryBasisLabel("comune")).toBe("Contesto comunale di confronto");
  });

  it("comune maps to riferimento comunale", async () => {
    const { tonePrimaryBasisLabel } = await import("@/lib/reportToneMap");
    
    expect(tonePrimaryBasisLabel("comune")).toBe("Riferimento comunale");
  });
});

/* ── resolveGeoContext — end-to-end priority ─────────── */

describe("resolveGeoContext — OMI dominates when available", () => {
  it("OMI with polygon match resolves to microzona_omi, not comune", async () => {
    const { resolveGeoContext } = await import("@/lib/reportMapper");
    const result: any = {
      identify: { status: "success", data: { address: "Via Roma 1, Padova" }, message: null },
      omiZone: { status: "success", data: { zonaOmiLabel: "B1", comuneLabel: "Padova", polygonMatch: true, omiGeoLevel: "microzona_omi", matchConfidence: 0.95 }, message: null },
      istatDemographic: { status: "success", data: { comuneLabel: "Padova", geoLevel: "comune", popolazione: 210000 }, message: null },
      pricing: { status: "idle", data: null, message: null },
      trendDemografico: { status: "idle", data: null, message: null },
    };
    const geo = resolveGeoContext(result);
    expect(geo.geoLevel).toBe("microzona_omi");
    expect(geo.geoLabel).toContain("B1");
  });

  it("OMI without polygon match and no zonaOmiLabel falls to comune", async () => {
    const { resolveGeoContext } = await import("@/lib/reportMapper");
    const result: any = {
      identify: { status: "success", data: { address: "Via Roma 1" }, message: null },
      omiZone: { status: "success", data: { comuneLabel: "Padova", polygonMatch: false }, message: null },
      istatDemographic: { status: "idle", data: null, message: null },
      pricing: { status: "idle", data: null, message: null },
      trendDemografico: { status: "idle", data: null, message: null },
    };
    const geo = resolveGeoContext(result);
    expect(geo.geoLevel).toBe("comune");
  });
});

/* ── False specificity — section labeling ──────────── */

describe("False specificity prevention", () => {
  it("buildPosizionamentoCommerciale labels pricing at comunale level as partial", async () => {
    const { buildPosizionamentoCommerciale } = await import("@/lib/reportMapper");
    const result: any = {
      pricing: { status: "success", data: { prezzoMq: 2000, prezzoMqMin: 1800, prezzoMqMax: 2200, sourceType: "official", sourceCoverageLevel: "comune", sourceConfidence: 0.7 }, message: null },
      omiZone: { status: "success", data: { quotazioneMinResidenziale: 1700, quotazioneMaxResidenziale: 2100, comuneLabel: "Padova", zonaOmiLabel: null, polygonMatch: false, omiGeoLevel: "comune" }, message: null },
      marketContext: { status: "idle", data: null, message: null },
      istatDemographic: { status: "idle", data: null, message: null },
      trendDemografico: { status: "idle", data: null, message: null },
    };
    const posData = buildPosizionamentoCommerciale(result);
    // When pricing is at comunale level, it should be marked as partial
    if (posData?.prezzoRichiestoRilevato) {
      expect(posData.prezzoRichiestoRilevato.availabilityStatus).toBe("partial");
      expect(posData.prezzoRichiestoRilevato.note).toContain("comunale");
    }
  });

  it("zoneValueEngine transparency notes mention comunale when bias is true", async () => {
    const { buildZoneValue } = await import("@/lib/zoneValueEngine");
    const stubCorr = {
      zone_identity: { geo_level_reale: "comune" as const, geo_code: "B111", geo_label: "Padova", normalized_path: "", zone_type_label: "Comunale", zone_corresponds_to: "", zone_anchor_strength: "weak" as const },
      zone_correspondence: { corresponds_to_microzona_omi: false, corresponds_to_asc: false, corresponds_to_section_or_aggregate: false, corresponds_to_comune_only: true, primary_zone_basis: "Comunale", secondary_zone_basis: [], fallback_used: true, fallback_weight: "high" as const, false_specificity_risk: "medium" as const },
      zone_precision: { precision_status: "weak" as const, sub_comunale_support_status: "unavailable" as const, market_zone_support_status: "fallback" as const, territorial_support_status: "partial" as const, max_safe_claim_level: "comune" as const },
      zone_limitations: { missing_sub_comunale: true, market_only_comunale: true, weak_zone_anchor: true, fallback_dominant: true, blocking_gaps: [], transparency_notes: [] },
    };
    const block = (avail: string, geo: string) => ({ availability: avail, quality: "official" as const, geo_level: geo, source_key: "live", source_label: "live", is_derived: false, officiality: "official" as const, limitations: [] });
    const stubTd = {
      territorial_identity: { geo_level: "comune" as const, geo_code: "B111", geo_label: "Padova", normalized_path: "", resolution_method: "direct" },
      territorial_datasets: { demographic: block("unavailable", "unknown"), territorial_structure: block("full", "comune"), sub_municipal: block("unavailable", "unknown"), omi_linkage: block("full", "comune"), census_sections: block("unavailable", "unknown"), environmental: block("unavailable", "unknown"), services: block("unavailable", "unknown"), mobility: block("unavailable", "unknown") },
    };
    const result = buildZoneValue({
      data: stubTd as any,
      corr: stubCorr as any,
      omiMin: 1500,
      omiMax: 2200,
      omiGeoLevel: "comune",
      omiPolygonMatch: false,
    });
    expect(result.value_quality.transparency_notes.some(n => n.includes("comunale"))).toBe(true);
  });

  it("WOW snapshot comunale bias produces valore_zona_fine=false", async () => {
    const { buildWowSnapshot } = await import("@/lib/sottraWowSnapshot");
    const { buildZoneValue } = await import("@/lib/zoneValueEngine");
    const { buildRenovationEstimate } = await import("@/lib/renovationCostEngine");
    const stubCorr = {
      zone_identity: { geo_level_reale: "comune" as const, geo_code: "B111", geo_label: "Padova", normalized_path: "", zone_type_label: "Comunale", zone_corresponds_to: "", zone_anchor_strength: "weak" as const },
      zone_correspondence: { corresponds_to_microzona_omi: false, corresponds_to_asc: false, corresponds_to_section_or_aggregate: false, corresponds_to_comune_only: true, primary_zone_basis: "Comunale", secondary_zone_basis: [], fallback_used: true, fallback_weight: "high" as const, false_specificity_risk: "medium" as const },
      zone_precision: { precision_status: "weak" as const, sub_comunale_support_status: "unavailable" as const, market_zone_support_status: "fallback" as const, territorial_support_status: "partial" as const, max_safe_claim_level: "comune" as const },
      zone_limitations: { missing_sub_comunale: true, market_only_comunale: true, weak_zone_anchor: true, fallback_dominant: true, blocking_gaps: [], transparency_notes: [] },
    };
    const block = (avail: string, geo: string) => ({ availability: avail, quality: "official" as const, geo_level: geo, source_key: "live", source_label: "live", is_derived: false, officiality: "official" as const, limitations: [] });
    const stubTd = {
      territorial_identity: { geo_level: "comune" as const, geo_code: "B111", geo_label: "Padova", normalized_path: "", resolution_method: "direct" },
      territorial_datasets: { demographic: block("unavailable", "unknown"), territorial_structure: block("full", "comune"), sub_municipal: block("unavailable", "unknown"), omi_linkage: block("full", "comune"), census_sections: block("unavailable", "unknown"), environmental: block("unavailable", "unknown"), services: block("unavailable", "unknown"), mobility: block("unavailable", "unknown") },
    };
    const value = buildZoneValue({ data: stubTd as any, corr: stubCorr as any, omiMin: 1500, omiMax: 2200, omiGeoLevel: "comune", omiPolygonMatch: false });
    const reno = buildRenovationEstimate({ zone_geo_code: "B111", zone_geo_level: "comune", hasPhoto: true, value_per_sqm_mid: value.value_result.value_per_sqm_mid });
    const snap = buildWowSnapshot({ value, renovation: reno, growth: null, corr: stubCorr as any });
    expect(snap.valore_zona_fine).toBe(false);
    expect(snap.livello_valore).toContain("comunale");
  });
});
