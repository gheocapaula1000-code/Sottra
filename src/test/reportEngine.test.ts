import { describe, it, expect } from "vitest";
import {
  isFieldAvailable, isSectionRenderable, countAvailableFields,
  unavailableField, sourceTypeLabels, availabilityLabels,
} from "@/types/report";
import type {
  ReportField, ScenarioTemporaleData, TrasparenzaFontiData,
} from "@/types/report";
import {
  buildProfiloRapido, buildImmobileFacciata, buildContestoVicinato,
  buildPosizionamentoCommerciale, buildProfiloArea,
  buildScenarioTemporale, buildSintesiFinale,
  mapScanToReportSections,
} from "@/lib/reportMapper";
import type { ScanResult, SectionState } from "@/types";

/* ── Helper to build a minimal ScanResult ────────────────── */

const idle: SectionState = { status: "idle", data: null, message: null };
const error: SectionState = { status: "error", data: null, message: "fail" };

function baseScanResult(overrides: Partial<Record<keyof ScanResult, SectionState>> = {}): ScanResult {
  const keys: (keyof ScanResult)[] = [
    "identify", "pricing", "marketContext", "timeView", "opportunity",
    "infrastrutture", "rischioZona", "trendDemografico",
    "sviluppoArea", "convergenzaTerritoriale",
    "poiEnrichment", "omiZone", "istatDemographic",
    "profiloRapido", "immobileFacciata", "contestoVicinato",
    "posizionamentoCommerciale", "profiloArea", "scenarioTemporale", "sintesiFinale",
  ];
  const result = {} as Record<string, SectionState>;
  for (const k of keys) result[k] = idle;
  return { ...result, ...overrides } as unknown as ScanResult;
}

/* ── ReportField helpers ─────────────────────────────────── */

describe("ReportField helpers", () => {
  it("isFieldAvailable returns true for available field", () => {
    const field: ReportField<string> = { value: "test", label: "Test", sourceType: "official_data", availabilityStatus: "available" };
    expect(isFieldAvailable(field)).toBe(true);
  });

  it("isFieldAvailable returns true for partial field", () => {
    const field: ReportField<string> = { value: "test", label: "Test", sourceType: "official_data", availabilityStatus: "partial" };
    expect(isFieldAvailable(field)).toBe(true);
  });

  it("isFieldAvailable returns false for unavailable field", () => {
    const field: ReportField<null> = { value: null, label: "Test", sourceType: "unavailable", availabilityStatus: "unavailable" };
    expect(isFieldAvailable(field)).toBe(false);
  });

  it("isFieldAvailable returns false for null", () => {
    expect(isFieldAvailable(null)).toBe(false);
    expect(isFieldAvailable(undefined)).toBe(false);
  });

  it("unavailableField creates correct structure", () => {
    const field = unavailableField("Prezzo");
    expect(field.value).toBeNull();
    expect(field.label).toBe("Prezzo");
    expect(field.sourceType).toBe("unavailable");
    expect(field.availabilityStatus).toBe("unavailable");
  });
});

/* ── Section renderability ───────────────────────────────── */

describe("isSectionRenderable", () => {
  it("returns false for null data", () => {
    expect(isSectionRenderable(null)).toBe(false);
    expect(isSectionRenderable(undefined)).toBe(false);
  });

  it("returns false when all fields are unavailable", () => {
    const data: Record<string, unknown> = {
      field1: { value: null, label: "A", sourceType: "unavailable", availabilityStatus: "unavailable" },
      field2: { value: null, label: "B", sourceType: "unavailable", availabilityStatus: "unavailable" },
    };
    expect(isSectionRenderable(data)).toBe(false);
  });

  it("returns true when at least one field is available", () => {
    const data: Record<string, unknown> = {
      field1: { value: null, label: "A", sourceType: "unavailable", availabilityStatus: "unavailable" },
      field2: { value: "test", label: "B", sourceType: "official_data", availabilityStatus: "available" },
    };
    expect(isSectionRenderable(data)).toBe(true);
  });

  it("returns true for partial fields", () => {
    const data: Record<string, unknown> = {
      field1: { value: "partial", label: "A", sourceType: "visual_estimate", availabilityStatus: "partial" },
    };
    expect(isSectionRenderable(data)).toBe(true);
  });
});

describe("countAvailableFields", () => {
  it("returns 0 for null", () => {
    expect(countAvailableFields(null)).toBe(0);
  });

  it("counts correctly", () => {
    const data: Record<string, unknown> = {
      field1: { value: "a", label: "A", sourceType: "official_data", availabilityStatus: "available" },
      field2: { value: null, label: "B", sourceType: "unavailable", availabilityStatus: "unavailable" },
      field3: { value: "c", label: "C", sourceType: "market_data", availabilityStatus: "partial" },
      nonField: "just a string",
    };
    expect(countAvailableFields(data)).toBe(2);
  });
});

/* ── sourceType and availability labels completeness ──── */

describe("labels completeness", () => {
  it("sourceTypeLabels has all ReportSourceTypes", () => {
    const expected = ["image_detected", "visual_estimate", "territorial_verified", "official_data", "market_data", "forecast_scenario", "unavailable"];
    for (const key of expected) {
      expect(sourceTypeLabels[key as keyof typeof sourceTypeLabels]).toBeTruthy();
    }
  });

  it("availabilityLabels has all AvailabilityStatus values", () => {
    const expected = ["available", "partial", "unavailable", "not_determinable", "fallback"];
    for (const key of expected) {
      expect(availabilityLabels[key as keyof typeof availabilityLabels]).toBeTruthy();
    }
  });
});

/* ── Scenario temporal structure ─────────────────────────── */

describe("ScenarioTemporaleData structure", () => {
  it("should allow empty scenari array", () => {
    const data: ScenarioTemporaleData = { scenari: [] };
    expect(data.scenari).toHaveLength(0);
  });

  it("should structure 5/10/20 year scenarios correctly", () => {
    const data: ScenarioTemporaleData = {
      scenari: [
        { orizzonte: "5_anni", label: "5 anni", variazioneStimataPct: { value: 5, label: "Variazione", sourceType: "forecast_scenario", availabilityStatus: "available" } },
        { orizzonte: "10_anni", label: "10 anni", variazioneStimataPct: { value: 12, label: "Variazione", sourceType: "forecast_scenario", availabilityStatus: "available" } },
        { orizzonte: "20_anni", label: "20 anni", variazioneStimataPct: { value: null, label: "Variazione", sourceType: "unavailable", availabilityStatus: "unavailable" } },
      ],
      disclaimer: "Proiezione indicativa",
    };
    expect(data.scenari).toHaveLength(3);
    expect(data.scenari![0].orizzonte).toBe("5_anni");
    expect(data.scenari![2].variazioneStimataPct?.availabilityStatus).toBe("unavailable");
  });
});

/* ── TrasparenzaFonti structure ──────────────────────────── */

describe("TrasparenzaFontiData structure", () => {
  it("should accept valid fonti entries", () => {
    const data: TrasparenzaFontiData = {
      fonti: [
        { categoria: "immagine", categoriaLabel: "Analisi immagine", provider: "AI" },
        { categoria: "dato_ufficiale", categoriaLabel: "OMI", provider: "Agenzia delle Entrate", periodo: "2S 2024" },
        { categoria: "dato_mercato", categoriaLabel: "Prezzi", dettaglio: "Comparabili zona" },
      ],
    };
    expect(data.fonti).toHaveLength(3);
    expect(data.fonti[0].categoria).toBe("immagine");
    expect(data.fonti[1].periodo).toBe("2S 2024");
  });
});

/* ── Non-regression: OMI types unchanged ─────────────────── */

describe("OMI types non-regression", () => {
  it("OmiZoneData interface still has polygonMatch", () => {
    const omi: import("@/types").OmiZoneData = {
      zonaOmi: "B1",
      quotazioneMinResidenziale: 1300,
      quotazioneMaxResidenziale: 1650,
      polygonMatch: true,
    };
    expect(omi.polygonMatch).toBe(true);
    expect(omi.zonaOmi).toBe("B1");
  });
});

/* ── Phase 2: Report Mapper tests ────────────────────────── */

describe("buildProfiloRapido", () => {
  it("returns null when identify fails", () => {
    const result = baseScanResult({ identify: error });
    expect(buildProfiloRapido(result, 45, 9)).toBeNull();
  });

  it("populates address as territorial_verified (not image_detected)", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
    });
    const rapido = buildProfiloRapido(result, 45.46, 9.19);
    expect(rapido).not.toBeNull();
    expect(rapido!.indirizzo?.value).toBe("Via Roma 1");
    expect(rapido!.indirizzo?.sourceType).toBe("territorial_verified");
    expect(rapido!.coordinate?.sourceType).toBe("territorial_verified");
  });

  it("includes OMI zone when available", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
      omiZone: { status: "success", data: { zonaOmi: "B1", zonaOmiLabel: "Centro", polygonMatch: true }, message: null },
    });
    const rapido = buildProfiloRapido(result, 45, 9);
    expect(rapido!.zonaOmiRiferimento?.value).toBe("Centro");
    expect(rapido!.zonaOmiRiferimento?.sourceType).toBe("official_data");
    expect(rapido!.zonaOmiRiferimento?.availabilityStatus).toBe("available");
  });

  it("marks OMI zone as partial when no polygon match", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
      omiZone: { status: "success", data: { zonaOmi: "B1", zonaOmiLabel: "Centro", polygonMatch: false }, message: null },
    });
    const rapido = buildProfiloRapido(result, 45, 9);
    expect(rapido!.zonaOmiRiferimento?.availabilityStatus).toBe("partial");
  });
});

describe("buildImmobileFacciata", () => {
  it("returns null without streetEvidence", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
    });
    expect(buildImmobileFacciata(result)).toBeNull();
  });

  it("populates partial section from streetEvidence/photoAnalysis (real core values)", () => {
    const result = baseScanResult({
      identify: {
        status: "success",
        data: {
          address: "Via Roma 1", buildingId: "X", confidence: 0.9,
          streetEvidence: {
            facadeConsistencyLevel: "good",
            photoAnalysis: { buildingType: "Condominio", visibleFloors: 5, photoReadability: "partial" },
          },
        },
        message: null,
      },
    });
    const facade = buildImmobileFacciata(result);
    expect(facade).not.toBeNull();
    expect(facade!.tipologiaFacciata?.value).toBe("Condominio");
    expect(facade!.tipologiaFacciata?.sourceType).toBe("image_detected");
    expect(facade!.statoConservazioneFacciata?.sourceType).toBe("visual_estimate");
    expect(facade!.statoConservazioneFacciata?.availabilityStatus).toBe("partial");
    expect(facade!.statoConservazioneFacciata?.value).toContain("buone condizioni");
    expect(facade!.noteVisive?.value).toContain("5 piani");
    expect(facade!.qualitaEsteticaGenerale?.availabilityStatus).toBe("partial");
  });

  it("does not invent fields not present in streetEvidence", () => {
    const result = baseScanResult({
      identify: {
        status: "success",
        data: {
          address: "Via Roma 1", buildingId: "X", confidence: 0.9,
          streetEvidence: { facadeConsistencyLevel: "strong" },
        },
        message: null,
      },
    });
    const facade = buildImmobileFacciata(result);
    expect(facade).not.toBeNull();
    expect(facade!.tipologiaFacciata).toBeUndefined();
    expect(facade!.materialePrevalente).toBeUndefined();
    expect(facade!.presenzaBalconi).toBeUndefined();
    expect(facade!.presenzaAscensore).toBeUndefined();
  });
});

describe("buildContestoVicinato", () => {
  it("returns null when no POI data", () => {
    const result = baseScanResult();
    expect(buildContestoVicinato(result)).toBeNull();
  });

  it("populates from POI categories with territorial naming", () => {
    const result = baseScanResult({
      poiEnrichment: {
        status: "success",
        data: {
          totalPois: 12,
          categories: [
            { category: "transport", categoryLabel: "Trasporti", count: 3 },
            { category: "shopping", categoryLabel: "Commercio", count: 5 },
            { category: "health", categoryLabel: "Sanità", count: 2 },
            { category: "education", categoryLabel: "Istruzione", count: 2 },
          ],
          pois: [],
          searchRadius: 800,
        },
        message: null,
      },
    });
    const ctx = buildContestoVicinato(result);
    expect(ctx).not.toBeNull();
    expect(ctx!.presenzaServiziRilevati?.value).toBe(true);
    expect(ctx!.presenzaServiziRilevati?.sourceType).toBe("territorial_verified");
    expect(ctx!.elencoServiziRilevati?.value).toHaveLength(4);
    expect(ctx!.livelloServiziArea?.value).toBe("Area ben servita");
    // No visual-sounding field names
    expect((ctx as any).presenzaServiziVisibili).toBeUndefined();
    expect((ctx as any).elencoServiziVisibili).toBeUndefined();
    expect((ctx as any).attrattivitaVisivaMicrocontesto).toBeUndefined();
    expect((ctx as any).qualitaVisivaContesto).toBeUndefined();
  });

  it("does not show livelloServiziArea without transport+shopping+primary", () => {
    const result = baseScanResult({
      poiEnrichment: {
        status: "success",
        data: {
          totalPois: 3,
          categories: [{ category: "parks", categoryLabel: "Parchi", count: 3 }],
          pois: [],
          searchRadius: 800,
        },
        message: null,
      },
    });
    const ctx = buildContestoVicinato(result);
    expect(ctx?.livelloServiziArea).toBeUndefined();
  });
});

describe("buildPosizionamentoCommerciale", () => {
  it("returns null without pricing or market data", () => {
    const result = baseScanResult();
    expect(buildPosizionamentoCommerciale(result)).toBeNull();
  });

  it("populates with pricing and OMI comparison", () => {
    const result = baseScanResult({
      pricing: {
        status: "success",
        data: { prezzoMq: 4000, prezzoMqMin: 3500, prezzoMqMax: 4500, mediaZona: null, trend5Anni: null },
        message: null,
      },
      omiZone: {
        status: "success",
        data: { quotazioneMinResidenziale: 3000, quotazioneMaxResidenziale: 3800, zonaOmi: "B1" },
        message: null,
      },
      marketContext: {
        status: "success",
        data: { marketCoverageLevel: "buona", comparablesSummary: { count: 10, marketDepth: "profondo" } },
        message: null,
      },
    });
    const pos = buildPosizionamentoCommerciale(result);
    expect(pos).not.toBeNull();
    expect(pos!.prezzoRichiestoRilevato?.sourceType).toBe("market_data");
    expect(pos!.noteCommercialiSintetiche?.value).toContain("OMI");
    expect(pos!.statoCommercialeRilevato?.value).toBe("Mercato attivo");
  });

  it("uses correct sourceType for all fields", () => {
    const result = baseScanResult({
      pricing: {
        status: "success",
        data: { prezzoMq: 2000, prezzoMqMin: 1800, prezzoMqMax: 2200, mediaZona: null, trend5Anni: null },
        message: null,
      },
    });
    const pos = buildPosizionamentoCommerciale(result);
    if (pos?.prezzoRichiestoRilevato) {
      expect(pos.prezzoRichiestoRilevato.sourceType).toBe("market_data");
    }
  });
});

describe("buildProfiloArea", () => {
  it("returns null with no data", () => {
    const result = baseScanResult();
    expect(buildProfiloArea(result)).toBeNull();
  });

  it("populates from POI, rischio, and ISTAT", () => {
    const result = baseScanResult({
      poiEnrichment: {
        status: "success",
        data: {
          totalPois: 8,
          categories: [
            { category: "transport", categoryLabel: "Trasporti", count: 3, nearest: { name: "Metro", category: "transport", categoryLabel: "Trasporti", distance: 200, lat: 45, lng: 9, provider: "overpass" } },
            { category: "health", categoryLabel: "Sanità", count: 2 },
            { category: "education", categoryLabel: "Istruzione", count: 3 },
          ],
          pois: [],
          searchRadius: 800,
        },
        message: null,
      },
      rischioZona: {
        status: "success",
        data: { scoreRischio: 25, idrogeologico: "basso", sismico: "zona3", inquinamento: "basso", alluvionale: false },
        message: null,
      },
      istatDemographic: {
        status: "success",
        data: { popolazione: 50000, densita: 4500, comuneLabel: "Milano" },
        message: null,
      },
    });
    const area = buildProfiloArea(result);
    expect(area).not.toBeNull();
    expect(area!.accessibilitaTrasporti?.sourceType).toBe("territorial_verified");
    expect(area!.qualitaAmbientale?.value).toContain("Basso");
    expect(area!.livelloUrbanizzazione?.sourceType).toBe("official_data");
    expect(area!.livelloUrbanizzazione?.value).toContain("Alta");
  });
});

describe("buildScenarioTemporale", () => {
  it("returns null without timeView data", () => {
    const result = baseScanResult();
    expect(buildScenarioTemporale(result)).toBeNull();
  });

  it("maps timeView to forecast_scenario sourceType", () => {
    const result = baseScanResult({
      timeView: {
        status: "success",
        data: {
          previsione5Anni: 10, previsione10Anni: 22, previsione20Anni: 40,
          scenarioDrivers: ["Metro nuova"], scenarioRisks: ["Tasso interessi"],
          narrativeObservation: "Zona in crescita",
        },
        message: null,
      },
    });
    const scenario = buildScenarioTemporale(result);
    expect(scenario).not.toBeNull();
    expect(scenario!.scenari).toHaveLength(3);
    expect(scenario!.scenari![0].variazioneStimataPct?.sourceType).toBe("forecast_scenario");
    expect(scenario!.scenari![0].driverPrincipali?.value).toContain("Metro nuova");
  });
});

describe("buildSintesiFinale", () => {
  it("returns null without opportunity and convergenza", () => {
    const result = baseScanResult();
    expect(buildSintesiFinale(result)).toBeNull();
  });

  it("builds from opportunity and convergenza", () => {
    const result = baseScanResult({
      opportunity: {
        status: "success",
        data: { score: 75, band: "forte", drivers: ["Driver1", "Driver2"], risks: ["Risk1"], observation: "Buon potenziale" },
        message: null,
      },
      convergenzaTerritoriale: {
        status: "success",
        data: { score: 80, band: "molto_forte", convergenceLevel: "alta", coverageLevel: "buona", positiveFamilies: ["Infra"], negativeFamilies: ["Rischio"] },
        message: null,
      },
    });
    const sintesi = buildSintesiFinale(result);
    expect(sintesi).not.toBeNull();
    expect(sintesi!.giudizioSintetico?.value).toContain("molto forte");
    expect(sintesi!.giudizioSintetico?.sourceType).toBe("market_data");
    expect(sintesi!.puntiDiForza?.value).toContain("Driver1");
    expect(sintesi!.raccomandazione?.value).toBe("Buon potenziale");
  });
});

describe("mapScanToReportSections", () => {
  it("returns all null when no data", () => {
    const result = baseScanResult();
    const mapped = mapScanToReportSections(result, null, null);
    expect(mapped.profiloRapido).toBeNull();
    expect(mapped.immobileFacciata).toBeNull();
    expect(mapped.contestoVicinato).toBeNull();
    expect(mapped.posizionamentoCommerciale).toBeNull();
    expect(mapped.profiloArea).toBeNull();
    expect(mapped.scenarioTemporale).toBeNull();
    expect(mapped.sintesiFinale).toBeNull();
  });

  it("never produces invented/mock data", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
    });
    const mapped = mapScanToReportSections(result, 45, 9);
    // Only profiloRapido should be non-null (from identify), rest null
    expect(mapped.profiloRapido).not.toBeNull();
    expect(mapped.immobileFacciata).toBeNull();
    expect(mapped.contestoVicinato).toBeNull();
    expect(mapped.posizionamentoCommerciale).toBeNull();
    // No mock values in profilo rapido
    expect(mapped.profiloRapido!.tipologiaEdificio).toBeUndefined();
    expect(mapped.profiloRapido!.annoCostruzioneStimato).toBeUndefined();
  });
});

/* ── No fallback invented values test ────────────────────── */

describe("No invented data policy", () => {
  it("immobileFacciata returns null without streetEvidence", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Roma 1", buildingId: "X", confidence: 0.9 }, message: null },
      poiEnrichment: { status: "success", data: { totalPois: 20, categories: [], pois: [], searchRadius: 800 }, message: null },
    });
    expect(buildImmobileFacciata(result)).toBeNull();
  });

  it("contestoVicinato uses territorial naming, no visual-sounding fields", () => {
    const result = baseScanResult({
      poiEnrichment: {
        status: "success",
        data: { totalPois: 5, categories: [{ category: "parks", categoryLabel: "Parchi", count: 5 }], pois: [], searchRadius: 800 },
        message: null,
      },
    });
    const ctx = buildContestoVicinato(result);
    // Should NOT have prevalenzaContesto (requires image analysis)
    expect(ctx?.prevalenzaContesto).toBeUndefined();
    // Should NOT have tessutoUrbano (requires image analysis)
    expect(ctx?.tessutoUrbano).toBeUndefined();
    // Should NOT have densitaEdiliziaPercepita (requires image analysis)
    expect(ctx?.densitaEdiliziaPercepita).toBeUndefined();
    // Renamed fields should not exist under old names
    expect((ctx as any).densitaEdiliziaVisiva).toBeUndefined();
    expect((ctx as any).qualitaVisivaContesto).toBeUndefined();
    expect((ctx as any).attrattivitaVisivaMicrocontesto).toBeUndefined();
  });
});

/* ── Phase 2.1: Semantic corrections tests ───────────────── */

describe("Phase 2.1 semantic corrections", () => {
  it("indirizzo is territorial_verified, never image_detected", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Corso Buenos Aires 10", buildingId: "X", confidence: 0.95 }, message: null },
    });
    const rapido = buildProfiloRapido(result, 45, 9);
    expect(rapido!.indirizzo?.sourceType).toBe("territorial_verified");
    expect(rapido!.indirizzo?.sourceType).not.toBe("image_detected");
  });

  it("pricing from official source gets official_data sourceType in commercial section", () => {
    const result = baseScanResult({
      pricing: {
        status: "success",
        data: { prezzoMq: 3000, prezzoMqMin: 2800, prezzoMqMax: 3200, mediaZona: null, trend5Anni: null, sourceType: "official" },
        message: null,
      },
    });
    const pos = buildPosizionamentoCommerciale(result);
    expect(pos!.prezzoRichiestoRilevato?.sourceType).toBe("official_data");
  });

  it("pricing from market source gets market_data sourceType", () => {
    const result = baseScanResult({
      pricing: {
        status: "success",
        data: { prezzoMq: 3000, prezzoMqMin: 2800, prezzoMqMax: 3200, mediaZona: null, trend5Anni: null, sourceType: "elaborated" },
        message: null,
      },
    });
    const pos = buildPosizionamentoCommerciale(result);
    expect(pos!.prezzoRichiestoRilevato?.sourceType).toBe("market_data");
  });

  it("immobileFacciata partial with streetEvidence populates correct sourceTypes", () => {
    const result = baseScanResult({
      identify: {
        status: "success",
        data: {
          address: "Via Roma 1", buildingId: "X", confidence: 0.9,
          streetEvidence: {
            facadeConsistencyLevel: "alta",
            photoAnalysis: { buildingType: "Palazzina", visibleFloors: 3, photoReadability: "alta" },
          },
        },
        message: null,
      },
    });
    const facade = buildImmobileFacciata(result);
    expect(facade).not.toBeNull();
    expect(facade!.tipologiaFacciata?.sourceType).toBe("image_detected");
    expect(facade!.statoConservazioneFacciata?.sourceType).toBe("visual_estimate");
    // photoReadability "alta" should NOT produce qualitaEsteticaGenerale note
    expect(facade!.qualitaEsteticaGenerale).toBeUndefined();
  });

  it("MAP_REPORT populates profiloRapido, profiloArea, scenarioTemporale, sintesiFinale", () => {
    const result = baseScanResult({
      identify: { status: "success", data: { address: "Via Test", buildingId: "X", confidence: 0.9 }, message: null },
      timeView: { status: "success", data: { previsione5Anni: 8, previsione10Anni: 18, previsione20Anni: 30 }, message: null },
      opportunity: { status: "success", data: { score: 70, band: "forte", drivers: ["D1"], risks: ["R1"], observation: "Ok" }, message: null },
      convergenzaTerritoriale: { status: "success", data: { score: 75, band: "forte", convergenceLevel: "media", coverageLevel: "buona", positiveFamilies: ["P1"], negativeFamilies: ["N1"] }, message: null },
      poiEnrichment: {
        status: "success",
        data: { totalPois: 10, categories: [{ category: "transport", categoryLabel: "T", count: 5 }], pois: [], searchRadius: 800 },
        message: null,
      },
    });
    const mapped = mapScanToReportSections(result, 45.46, 9.19);
    expect(mapped.profiloRapido).not.toBeNull();
    expect(mapped.profiloArea).not.toBeNull();
    expect(mapped.scenarioTemporale).not.toBeNull();
    expect(mapped.scenarioTemporale!.scenari).toHaveLength(3);
    expect(mapped.sintesiFinale).not.toBeNull();
    expect(mapped.sintesiFinale!.giudizioSintetico).toBeDefined();
  });

  it("no mock data — all sections null with empty scan result", () => {
    const result = baseScanResult();
    const mapped = mapScanToReportSections(result, null, null);
    expect(mapped.profiloRapido).toBeNull();
    expect(mapped.immobileFacciata).toBeNull();
    expect(mapped.contestoVicinato).toBeNull();
    expect(mapped.posizionamentoCommerciale).toBeNull();
    expect(mapped.scenarioTemporale).toBeNull();
    expect(mapped.sintesiFinale).toBeNull();
  });
});

/* ── OMI non-regression (frozen) ─────────────────────────── */

describe("OMI invariance check", () => {
  it("OmiZoneData interface remains unchanged", () => {
    const omi: import("@/types").OmiZoneData = {
      zonaOmi: "C2",
      quotazioneMinResidenziale: 1200,
      quotazioneMaxResidenziale: 1500,
      polygonMatch: true,
      comuneLabel: "Roma",
    };
    expect(omi.polygonMatch).toBe(true);
    expect(omi.zonaOmi).toBe("C2");
  });
});
