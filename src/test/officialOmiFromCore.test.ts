import { describe, it, expect } from "vitest";
import {
  officialOmiFromCore,
  normalizePhotoWow,
  resolveOfficialOmiOverlay,
  formatZonaOmiLabel,
  unwrapCoreEnvelope,
  pickPreferredOmiHit,
  collectOmiHits,
  mergeOfficialOmiData,
  extractPoiEnrichment,
} from "@/lib/officialOmiFromCore";
import { readFileSync } from "node:fs";

const PADOVA_WRAPPED = {
  ok: true,
  data: {
    zona: {
      nomeComune: "Padova",
      provincia: "PD",
      nomeZonaOmi: "Centro (OMI B1)",
      valoreMinOmi: 2400,
      valoreMaxOmi: 3400,
    },
    scores: { vendibilita: null, opportunitaInvestimento: null, pressioneEreditaria: null },
    officialMicrozona: "B1",
    prezzoMqMin: 2400,
    prezzoMqMax: 3400,
    sourceType: "official",
    polygonMatch: true,
  },
};

const PADOVA_DUAL = {
  ok: true,
  data: {
    immobile: { tipologiaProbabile: "residenziale" },
    scores: null,
  },
  zona: "Centro (OMI B1)",
  officialMicrozona: "B1",
  prezzoMqMin: 2400,
  prezzoMqMax: 3400,
  sourceType: "official",
  polygonMatch: true,
  pricing: {
    prezzoMqMin: 2400,
    prezzoMqMax: 3400,
    sourceType: "official",
    polygonMatch: true,
  },
};

describe("formatZonaOmiLabel", () => {
  it("keeps Centro (OMI B1) as-is", () => {
    expect(formatZonaOmiLabel("Centro (OMI B1)", "B1")).toBe("Centro (OMI B1)");
  });

  it("composes Centro + B1", () => {
    expect(formatZonaOmiLabel("Centro", "B1")).toBe("Centro (OMI B1)");
  });
});

describe("unwrapCoreEnvelope", () => {
  it("merges top-level zona/pricing onto nested data", () => {
    const u = unwrapCoreEnvelope(PADOVA_DUAL);
    expect(u?.zona).toBe("Centro (OMI B1)");
    expect(u?.prezzoMqMin).toBe(2400);
    expect(u?.officialMicrozona).toBe("B1");
    expect((u?.immobile as { tipologiaProbabile?: string })?.tipologiaProbabile).toBe("residenziale");
  });

  it("returns null when ok is false", () => {
    expect(unwrapCoreEnvelope({ ok: false, data: { zona: "x" } })).toBeNull();
  });
});

describe("officialOmiFromCore — Padova centro Core 3.4.4 shapes", () => {
  it("reads nested zona.nomeZonaOmi / valoreMinOmi from {ok,data}", () => {
    const omi = officialOmiFromCore(PADOVA_WRAPPED);
    expect(omi).not.toBeNull();
    expect(omi!.zonaOmiLabel).toBe("Centro (OMI B1)");
    expect(omi!.zonaOmi).toBe("B1");
    expect(omi!.quotazioneMinResidenziale).toBe(2400);
    expect(omi!.quotazioneMaxResidenziale).toBe(3400);
    expect(omi!.comuneLabel).toBe("Padova");
    expect(omi!.sourceType).toBe("official");
    expect(omi!.polygonMatch).toBe(true);
  });

  it("reads dual-readable top-level zona string + prezzoMqMin/Max", () => {
    const omi = officialOmiFromCore(PADOVA_DUAL);
    expect(omi).not.toBeNull();
    expect(omi!.zonaOmiLabel).toBe("Centro (OMI B1)");
    expect(omi!.zonaOmi).toBe("B1");
    expect(omi!.quotazioneMinResidenziale).toBe(2400);
    expect(omi!.quotazioneMaxResidenziale).toBe(3400);
    expect(omi!.sourceType).toBe("official");
    expect(omi!.polygonMatch).toBe(true);
  });

  it("reads unwrapped /scan/pricing payload", () => {
    const omi = officialOmiFromCore({
      zona: "Centro (OMI B1)",
      officialMicrozona: "B1",
      prezzoMqMin: 2400,
      prezzoMqMax: 3400,
      sourceType: "official",
      polygonMatch: true,
    });
    expect(omi!.zonaOmiLabel).toBe("Centro (OMI B1)");
    expect(omi!.quotazioneMinResidenziale).toBe(2400);
    expect(omi!.quotazioneMaxResidenziale).toBe(3400);
  });

  it("returns null for unavailable sourceType", () => {
    expect(officialOmiFromCore({ sourceType: "unavailable", prezzoMqMin: 1 })).toBeNull();
  });

  it("does not invent quotes when Core sent none", () => {
    const omi = officialOmiFromCore({ zona: { nomeComune: "Padova" }, scores: null });
    expect(omi).toBeNull();
  });

  it("prefers official PD00000015 B1 over overlapping B2 from omi_zone_by_point", () => {
    const omi = officialOmiFromCore({
      ok: true,
      data: {
        hits: [
          { link_zona: "G224-B1", zona_omi: "B1", zona_descr: "Gold B1" },
          {
            link_zona: "PD00000015",
            zona_omi: "B1",
            zona_descr: "ZONA ENTRO RIVIERE-VIA XX SETTEMBRE",
            comune_label: "Padova",
            quotazione_min: 2400,
            quotazione_max: 3400,
            stato_conservazione: "NORMALE",
            tipologia: "Abitazioni civili",
          },
          {
            link_zona: "PD00000016",
            zona_omi: "B2",
            zona_descr: "ZONA B2 overlap",
            comune_label: "Padova",
            quotazione_min: 1800,
            quotazione_max: 2500,
            stato_conservazione: "NORMALE",
          },
        ],
        sourceType: "official",
      },
    });
    expect(omi).not.toBeNull();
    expect(omi!.zonaOmi).toBe("B1");
    expect(omi!.quotazioneMinResidenziale).toBe(2400);
    expect(omi!.quotazioneMaxResidenziale).toBe(3400);
    expect(omi!.comuneLabel).toBe("Padova");
    expect(omi!.sourceType).toBe("official");
    expect(isOmiLabelB1(omi!.zonaOmiLabel)).toBe(true);
  });

  it("accepts gold G224-B1 when it carries the official 2400–3400 range", () => {
    const omi = officialOmiFromCore({
      hits: [
        {
          link_zona: "G224-B1",
          zona_omi: "B1",
          nomeZonaOmi: "Centro (OMI B1)",
          comune_label: "Padova",
          valoreMinOmi: 2400,
          valoreMaxOmi: 3400,
          sourceType: "official",
        },
        { link_zona: "PD00000016", zona_omi: "B2", quotazione_min: 1800, quotazione_max: 2500 },
      ],
    });
    expect(omi!.zonaOmi).toBe("B1");
    expect(omi!.zonaOmiLabel).toBe("Centro (OMI B1)");
    expect(omi!.quotazioneMinResidenziale).toBe(2400);
    expect(omi!.quotazioneMaxResidenziale).toBe(3400);
  });

  it("maps Via San Francesco / 45.4064,11.8768 Core quotes into publishable Centro B1", () => {
    const omi = officialOmiFromCore({
      ok: true,
      zona: "Centro (OMI B1)",
      officialMicrozona: "B1",
      prezzoMqMin: 2400,
      prezzoMqMax: 3400,
      sourceType: "official",
      polygonMatch: true,
      omi_zone_by_point: [
        { link_zona: "G224-B1", zona_omi: "B1" },
        { link_zona: "PD00000015", zona_omi: "B1", zona_descr: "ZONA ENTRO RIVIERE-VIA XX SETTEMBRE" },
        { link_zona: "PD00000016", zona_omi: "B2" },
      ],
    });
    expect(omi!.zonaOmi).toBe("B1");
    expect(omi!.zonaOmiLabel).toBe("Centro (OMI B1)");
    expect(omi!.quotazioneMinResidenziale).toBe(2400);
    expect(omi!.quotazioneMaxResidenziale).toBe(3400);
  });

  it("does not invent a zone when omi_zone_by_point is empty", () => {
    expect(officialOmiFromCore({ hits: [], scores: null })).toBeNull();
    expect(officialOmiFromCore({ omi_zone_by_point: [] })).toBeNull();
  });
});

function isOmiLabelB1(label: string | null | undefined): boolean {
  return !!label && /B1/i.test(label);
}

describe("normalizePhotoWow", () => {
  it("unwraps {ok,data} and keeps official zona on the cinematic object", () => {
    const wow = normalizePhotoWow(PADOVA_WRAPPED);
    expect(wow).not.toBeNull();
    expect(wow!.zona.nomeComune).toBe("Padova");
    expect(wow!.zona.nomeZonaOmi).toBe("Centro (OMI B1)");
    expect(wow!.zona.valoreMinOmi).toBe(2400);
    expect(wow!.zona.valoreMaxOmi).toBe(3400);
  });

  it("does not coerce null scores to 0", () => {
    const wow = normalizePhotoWow(PADOVA_WRAPPED);
    expect(wow!.scores.vendibilita).toBeNull();
    expect(wow!.scores.opportunitaInvestimento).toBeNull();
    expect(wow!.scores.pressioneEreditaria).toBeNull();
  });

  it("maps dual-readable string zona onto nomeZonaOmi", () => {
    const wow = normalizePhotoWow(PADOVA_DUAL);
    expect(wow!.zona.nomeZonaOmi).toBe("Centro (OMI B1)");
    expect(wow!.zona.valoreMinOmi).toBe(2400);
    expect(wow!.scores.vendibilita).toBeNull();
  });
});

describe("resolveOfficialOmiOverlay", () => {
  it("populates the official strip from photoWow when omiZone failed", () => {
    const overlay = resolveOfficialOmiOverlay({
      omiZone: { status: "error", data: null },
      photoWow: { status: "success", data: PADOVA_DUAL },
      pricing: { status: "success", data: null },
    });
    expect(overlay.status).toBe("success");
    expect(overlay.data?.zonaOmiLabel).toBe("Centro (OMI B1)");
    expect(overlay.data?.quotazioneMinResidenziale).toBe(2400);
    expect(overlay.data?.quotazioneMaxResidenziale).toBe(3400);
  });

  it("populates from pricing when photoWow is cinematic-only", () => {
    const overlay = resolveOfficialOmiOverlay({
      omiZone: { status: "error", data: null },
      photoWow: { status: "success", data: { zona: { nomeComune: "Padova" }, scores: null } },
      pricing: {
        status: "success",
        data: {
          zona: "Centro (OMI B1)",
          officialMicrozona: "B1",
          prezzoMqMin: 2400,
          prezzoMqMax: 3400,
          sourceType: "official",
          polygonMatch: true,
        },
      },
    });
    expect(overlay.data?.zonaOmiLabel).toBe("Centro (OMI B1)");
    expect(overlay.data?.quotazioneMinResidenziale).toBe(2400);
  });

  it("keeps official strip from omiZone when photoWow failed (0,0 cinematic)", () => {
    const overlay = resolveOfficialOmiOverlay({
      omiZone: {
        status: "success",
        data: {
          zonaOmi: "B1",
          zonaOmiLabel: "Centro (OMI B1)",
          comuneLabel: "Padova",
          quotazioneMinResidenziale: 2400,
          quotazioneMaxResidenziale: 3400,
          sourceType: "official",
          polygonMatch: true,
        },
      },
      photoWow: { status: "error", data: null },
      pricing: { status: "success", data: null },
    });
    expect(overlay.status).toBe("success");
    expect(overlay.data?.comuneLabel).toBe("Padova");
    expect(overlay.data?.zonaOmiLabel).toBe("Centro (OMI B1)");
    expect(overlay.data?.quotazioneMinResidenziale).toBe(2400);
  });

  it("stays loading when sources are still in flight", () => {
    const overlay = resolveOfficialOmiOverlay({
      omiZone: { status: "loading", data: null },
      photoWow: { status: "loading", data: null },
      pricing: { status: "loading", data: null },
    });
    expect(overlay.status).toBe("loading");
    expect(overlay.data).toBeNull();
  });

  it("does not let a B2 overlap overwrite official Padova B1 2400–3400", () => {
    const overlay = resolveOfficialOmiOverlay({
      omiZone: {
        status: "success",
        data: {
          zonaOmi: "B2",
          zonaOmiLabel: "Semicentro",
          comuneLabel: "Padova",
          quotazioneMinResidenziale: 1800,
          quotazioneMaxResidenziale: 2500,
          sourceType: "official",
        },
      },
      photoWow: { status: "success", data: PADOVA_DUAL },
      pricing: { status: "success", data: null },
    });
    expect(overlay.data?.zonaOmi).toBe("B1");
    expect(overlay.data?.quotazioneMinResidenziale).toBe(2400);
    expect(overlay.data?.quotazioneMaxResidenziale).toBe(3400);
  });
});

describe("pickPreferredOmiHit — Padova overlap", () => {
  it("ranks PD00000015 B1 above G224-B1 and PD00000016 B2", () => {
    const hits = collectOmiHits({
      hits: [
        { link_zona: "G224-B1", zona_omi: "B1" },
        { link_zona: "PD00000015", zona_omi: "B1", quotazione_min: 2400, quotazione_max: 3400 },
        { link_zona: "PD00000016", zona_omi: "B2", quotazione_min: 1800, quotazione_max: 2500 },
      ],
    });
    const preferred = pickPreferredOmiHit(hits);
    expect(preferred?.linkZona).toBe("PD00000015");
    expect(preferred?.fascia).toBe("B1");
    expect(preferred?.min).toBe(2400);
  });

  it("does not force Via Tiziano Aspetti 245 D7 onto B1", () => {
    const omi = officialOmiFromCore({
      hits: [
        {
          link_zona: "PD00002830",
          zona_omi: "D7",
          zona_descr: "Arcella Nord / Mortise",
          comune_label: "Padova",
          quotazione_min: 950,
          quotazione_max: 1200,
          stato_conservazione: "NORMALE",
          tipologia: "Abitazioni civili",
        },
        {
          link_zona: "G224-B1",
          zona_omi: "B1",
          zona_descr: "Centro",
          comune_label: "Padova",
          quotazione_min: 2400,
          quotazione_max: 3400,
        },
      ],
    });
    expect(omi!.zonaOmi).toBe("D7");
    expect(omi!.quotazioneMinResidenziale).toBe(950);
    expect(omi!.quotazioneMaxResidenziale).toBe(1200);
    expect(omi!.zonaOmiLabel).not.toMatch(/B1/i);
  });

  it("keeps official B1 quotes when merging a later B2 pro-sources row", () => {
    const merged = mergeOfficialOmiData(
      {
        zonaOmi: "B1",
        zonaOmiLabel: "Centro (OMI B1)",
        comuneLabel: "Padova",
        quotazioneMinResidenziale: 2400,
        quotazioneMaxResidenziale: 3400,
        sourceType: "official",
      },
      {
        zonaOmi: "B2",
        zonaOmiLabel: "Semicentro",
        comuneLabel: "Padova",
        quotazioneMinResidenziale: 1800,
        quotazioneMaxResidenziale: 2500,
        sourceType: "official",
      },
    );
    expect(merged.zonaOmi).toBe("B1");
    expect(merged.quotazioneMinResidenziale).toBe(2400);
    expect(merged.quotazioneMaxResidenziale).toBe(3400);
  });

  it("does not let cinematic B1 overwrite official D7 950–1200", () => {
    const merged = mergeOfficialOmiData(
      {
        zonaOmi: "D7",
        zonaOmiLabel: "Arcella Nord / Mortise (OMI D7)",
        comuneLabel: "Padova",
        quotazioneMinResidenziale: 950,
        quotazioneMaxResidenziale: 1200,
        sourceType: "official",
        polygonMatch: true,
      },
      {
        zonaOmi: "B1",
        zonaOmiLabel: "Centro (OMI B1)",
        comuneLabel: "Padova",
        quotazioneMinResidenziale: 2400,
        quotazioneMaxResidenziale: 3400,
        sourceType: "official",
      },
    );
    expect(merged.zonaOmi).toBe("D7");
    expect(merged.quotazioneMinResidenziale).toBe(950);
    expect(merged.quotazioneMaxResidenziale).toBe(1200);
  });
});

describe("honesty: no invented microzona, no fake official APE", () => {
  it("does not keep sourceType official on ai_estimate without polygon or quotes", () => {
    const omi = officialOmiFromCore({
      zona: "Zona stimata",
      comuneLabel: "Milano",
      prezzoMqMin: 4000,
      prezzoMqMax: 6000,
      matchMethod: "ai_estimate",
      polygonMatch: false,
      sourceType: "official",
    });
    expect(omi?.sourceType).toBe("estimate");
    expect(omi?.quotes ?? []).toHaveLength(0);
    expect(JSON.stringify(omi?.quotes ?? [])).not.toMatch(/1400/);
  });

  it("Padova D8 mashed payload is still official NORMALE 1400–1850", () => {
    const omi = officialOmiFromCore({
      zona: "S. GREGORIO / TERRANEGRA / FORCELLINI EST (OMI D8)",
      officialMicrozona: "D8",
      comuneLabel: "Padova",
      prezzoMqMin: 1400,
      prezzoMqMax: 2750,
      sourceType: "official",
      polygonMatch: true,
      link_zona: "PD00002850",
    });
    expect(omi?.sourceType).toBe("official");
    expect(omi?.quotazioneMinResidenziale).toBe(1400);
    expect(omi?.quotazioneMaxResidenziale).toBe(1850);
  });

  it("extractPoiEnrichment is fail-closed and passes through Core POI", () => {
    expect(extractPoiEnrichment({})).toBeNull();
    expect(extractPoiEnrichment({ poiEnrichment: { totalPois: 0, categories: [], pois: [] } })).toBeNull();
    const poi = extractPoiEnrichment({
      poiEnrichment: {
        totalPois: 3,
        searchRadius: 800,
        sourceType: "verified_geo",
        categories: [{ category: "leisure", categoryLabel: "Parchi / verde", count: 2 }],
        pois: [],
      },
    });
    expect(poi?.totalPois).toBe(3);
    expect(poi?.categories[0].category).toBe("leisure");
  });

  it("energy section is stripped from the sidewalk Result path; no APE claims remain", () => {
    const result = readFileSync("src/pages/Result.tsx", "utf8");
    expect(result).not.toContain("EnergySection");
    expect(result).not.toMatch(/Classe stimata/);
    expect(result).not.toMatch(/Dato ufficiale OMI/);
  });
});
