import { describe, it, expect } from "vitest";
import {
  officialOmiFromCore,
  normalizePhotoWow,
  resolveOfficialOmiOverlay,
  formatZonaOmiLabel,
  unwrapCoreEnvelope,
} from "@/lib/officialOmiFromCore";

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
});

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

  it("stays loading when sources are still in flight", () => {
    const overlay = resolveOfficialOmiOverlay({
      omiZone: { status: "loading", data: null },
      photoWow: { status: "loading", data: null },
      pricing: { status: "loading", data: null },
    });
    expect(overlay.status).toBe("loading");
    expect(overlay.data).toBeNull();
  });
});
