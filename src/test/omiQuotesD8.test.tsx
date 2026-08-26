import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { OmiQuotesTable } from "@/components/report/OmiQuotesTable";
import { PublishableAccordionItem } from "@/components/report/ReportAccordion";
import { officialOmiFromCore } from "@/lib/officialOmiFromCore";
import {
  formatOmiRentRange,
  isMashedCivileEnvelope,
  pickCivileHeadline,
} from "@/lib/omiQuotes";
import { preferPoiData } from "@/lib/poiPrefer";
import { isOmiPublishable, isPoiPublishable } from "@/lib/reportSectionPublishable";
import type { OmiQuote, PoiEnrichmentData } from "@/types";

/** Official AdE omi_valori rows for Padova D8 / PD00002850 / 2025/1. Do not invent extras. */
export const PADOVA_D8_OFFICIAL_QUOTES: OmiQuote[] = [
  { tipologia: "Abitazioni civili", stato: "NORMALE", comprMin: 1400, comprMax: 1850, locMin: 6.5, locMax: 9, semestre: "2025/1" },
  { tipologia: "Abitazioni civili", stato: "OTTIMO", comprMin: 1800, comprMax: 2750, locMin: 7, locMax: 9.5, semestre: "2025/1" },
  { tipologia: "Abitazioni di tipo economico", stato: "NORMALE", comprMin: 1150, comprMax: 1400, locMin: 5.8, locMax: 7.2, semestre: "2025/1" },
  { tipologia: "Box", stato: "NORMALE", comprMin: 1200, comprMax: 1500, locMin: 6, locMax: 7.5, semestre: "2025/1" },
  { tipologia: "Negozi", stato: "OTTIMO", comprMin: 1700, comprMax: 2550, locMin: 9, locMax: 15.5, semestre: "2025/1" },
  { tipologia: "Uffici", stato: "NORMALE", comprMin: 1450, comprMax: 1950, locMin: 6.9, locMax: 9, semestre: "2025/1" },
  { tipologia: "Ville e Villini", stato: "NORMALE", comprMin: 1800, comprMax: 2300, locMin: 6.6, locMax: 8, semestre: "2025/1" },
];

const D8_CORE_MASHED_PLUS_QUOTES = {
  zona: "Est (OMI D8)",
  officialMicrozona: "D8",
  comuneLabel: "Padova",
  prezzoMqMin: 1400,
  prezzoMqMax: 2750,
  sourceType: "official",
  polygonMatch: true,
  semestre: "2025/1",
  link_zona: "PD00002850",
  quotes: PADOVA_D8_OFFICIAL_QUOTES,
};

describe("Padova D8 official OMI quotes", () => {
  it("maps all 7 official rows and prefers civile NORMALE 1400–1850 as headline", () => {
    const omi = officialOmiFromCore(D8_CORE_MASHED_PLUS_QUOTES);
    expect(omi).not.toBeNull();
    expect(omi!.zonaOmi).toBe("D8");
    expect(omi!.quotes).toHaveLength(7);
    expect(omi!.quotazioneMinResidenziale).toBe(1400);
    expect(omi!.quotazioneMaxResidenziale).toBe(1850);
    expect(omi!.tipologia).toMatch(/civili/i);
    expect(omi!.statoConservazione).toMatch(/normale/i);

    const tipologiche = omi!.quotes!.map((q) => `${q.tipologia}|${q.stato}`);
    expect(tipologiche).toContain("Abitazioni civili|NORMALE");
    expect(tipologiche).toContain("Abitazioni civili|OTTIMO");
    expect(tipologiche).toContain("Abitazioni di tipo economico|NORMALE");
    expect(tipologiche).toContain("Box|NORMALE");
    expect(tipologiche).toContain("Negozi|OTTIMO");
    expect(tipologiche).toContain("Uffici|NORMALE");
    expect(tipologiche).toContain("Ville e Villini|NORMALE");

    const headline = pickCivileHeadline(omi!.quotes!);
    expect(headline).toEqual({ min: 1400, max: 1850 });
    expect(isMashedCivileEnvelope(omi!.quotes!, 1400, 2750)).toBe(true);
    expect(omi!.quotazioneMaxResidenziale).not.toBe(2750);
  });

  it("renders the official 7-row table from a live mashed D8 payload (no quotes array)", () => {
    const omi = officialOmiFromCore({
      zona: "S. GREGORIO / TERRANEGRA / FORCELLINI EST (OMI D8)",
      officialMicrozona: "D8",
      prezzoMqMin: 1400,
      prezzoMqMax: 2750,
      sourceType: "official",
      polygonMatch: true,
    });
    expect(isOmiPublishable(omi)).toBe(true);
    render(
      <PublishableAccordionItem
        id="omi"
        title="Quotazioni OMI"
        defaultOpen
        loading={false}
        publishable={isOmiPublishable(omi)}
      >
        <OmiQuotesTable quotes={omi!.quotes ?? []} />
      </PublishableAccordionItem>,
    );
    expect(screen.getAllByTestId("omi-quote-row")).toHaveLength(7);
    expect(screen.getByText(/Vendita 1400 – 1850 €\/m²/)).toBeInTheDocument();
    expect(screen.getByText(/Affitto 6\.5 – 9 €\/m²\/mese/)).toBeInTheDocument();
    expect(screen.queryByText(/1400 – 2750 €\/m²/)).not.toBeInTheDocument();
  });

  it("renders every official row; mashed 1400–2750 is not the only number", () => {
    const omi = officialOmiFromCore(D8_CORE_MASHED_PLUS_QUOTES);
    expect(isOmiPublishable(omi)).toBe(true);
    render(
      <PublishableAccordionItem
        id="omi"
        title="Quotazioni OMI"
        defaultOpen
        loading={false}
        publishable={isOmiPublishable(omi)}
      >
        <OmiQuotesTable quotes={omi!.quotes ?? []} />
      </PublishableAccordionItem>,
    );

    expect(screen.getAllByTestId("omi-quote-row")).toHaveLength(7);
    expect(screen.getAllByText("Abitazioni civili").length).toBe(2);
    expect(screen.getByText(/Vendita 1400 – 1850 €\/m²/)).toBeInTheDocument();
    expect(screen.getByText("Riferimento")).toBeInTheDocument();
    expect(screen.getByText(/Vendita 1800 – 2750 €\/m²/)).toBeInTheDocument();
    expect(screen.getByText(/Vendita 1150 – 1400 €\/m²/)).toBeInTheDocument();
    expect(screen.getByText(/Vendita 1200 – 1500 €\/m²/)).toBeInTheDocument();
    expect(screen.getByText(/Vendita 1700 – 2550 €\/m²/)).toBeInTheDocument();
    expect(screen.getByText(/Vendita 1450 – 1950 €\/m²/)).toBeInTheDocument();
    expect(screen.getByText(/Vendita 1800 – 2300 €\/m²/)).toBeInTheDocument();
    expect(screen.getByText(/Affitto 6\.5 – 9 €\/m²\/mese/)).toBeInTheDocument();
    expect(screen.getAllByText("OTTIMO").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/1400 – 2750 €\/m²/)).not.toBeInTheDocument();
  });

  it("keeps missing loc_* blank and does not invent a rent figure", () => {
    const withoutRent: OmiQuote[] = [
      { tipologia: "Box", stato: "NORMALE", comprMin: 1200, comprMax: 1500, locMin: null, locMax: null },
    ];
    expect(formatOmiRentRange(withoutRent[0])).toBeNull();
    render(<OmiQuotesTable quotes={withoutRent} />);
    expect(screen.getByText(/Vendita 1200 – 1500 €\/m²/)).toBeInTheDocument();
    expect(screen.queryByText(/€\/m²\/mese/)).not.toBeInTheDocument();
    expect(screen.getByTestId("omi-quote-rent-blank")).toBeInTheDocument();
    expect(screen.getByTestId("omi-quote-rent-blank").textContent).toBe("");
  });

  it("attaches official D8 rows from link_zona PD00002850 without inventing extras", () => {
    const omi = officialOmiFromCore({
      officialMicrozona: "D8",
      comuneLabel: "Padova",
      prezzoMqMin: 1400,
      prezzoMqMax: 2750,
      sourceType: "official",
      polygonMatch: true,
      link_zona: "PD00002850",
    });
    expect(omi!.quotes).toHaveLength(7);
    expect(omi!.linkZona).toBe("PD00002850");
    expect(omi!.quotazioneMaxResidenziale).toBe(1850);
  });

  it("does not invent extra rows for an unmatched zone that only sent a mashed band", () => {
    const omi = officialOmiFromCore({
      zona: "Centro (OMI B1)",
      officialMicrozona: "B1",
      prezzoMqMin: 2400,
      prezzoMqMax: 3400,
      sourceType: "official",
      polygonMatch: true,
    });
    expect(omi!.quotazioneMinResidenziale).toBe(2400);
    expect(omi!.quotazioneMaxResidenziale).toBe(3400);
    expect(omi!.quotes ?? []).toHaveLength(0);
  });

  it("replaces the live D8 mashed 1400–2750 band with the official 7 omi_valori rows", () => {
    const omi = officialOmiFromCore({
      zona: "S. GREGORIO / TERRANEGRA / FORCELLINI EST (OMI D8)",
      officialMicrozona: "D8",
      comuneLabel: "Padova",
      prezzoMqMin: 1400,
      prezzoMqMax: 2750,
      sourceType: "official",
      polygonMatch: true,
      semestre: "1H 2025",
    });
    expect(omi!.quotes).toHaveLength(7);
    expect(omi!.quotazioneMinResidenziale).toBe(1400);
    expect(omi!.quotazioneMaxResidenziale).toBe(1850);
    expect(omi!.statoConservazione).toMatch(/normale/i);
    expect(omi!.quotes!.map((q) => `${q.tipologia}|${q.stato}`)).toContain("Negozi|OTTIMO");
  });
});

describe("POI hide-empty", () => {
  const emptyPoi: PoiEnrichmentData = {
    totalPois: 0, categories: [], pois: [], searchRadius: 800, sourceType: "verified_geo",
  };
  const livePoi: PoiEnrichmentData = {
    totalPois: 4, categories: [], pois: [], searchRadius: 800, sourceType: "verified_geo",
  };

  it("still hides the tendina when Overpass returned nothing", () => {
    expect(isPoiPublishable(emptyPoi)).toBe(false);
    render(
      <PublishableAccordionItem id="poi" title="Servizi e POI" loading={false} publishable={isPoiPublishable(emptyPoi)}>
        <p>invented poi</p>
      </PublishableAccordionItem>,
    );
    expect(screen.queryByText("Servizi e POI")).not.toBeInTheDocument();
  });

  it("does not let an empty later fetch hide a live Overpass result", () => {
    expect(preferPoiData(livePoi, emptyPoi)?.totalPois).toBe(4);
    expect(preferPoiData(emptyPoi, livePoi)?.totalPois).toBe(4);
    expect(isPoiPublishable(preferPoiData(livePoi, emptyPoi))).toBe(true);
  });
});

describe("field UX: POI visible in the 20s story", () => {
  it("Result mounts a POI strip after WowPanel, not only a closed accordion", () => {
    const result = readFileSync("src/pages/Result.tsx", "utf8");
    const wow = result.indexOf("<WowPanel");
    const strip = result.indexOf("<PoiWowStrip");
    const accordion = result.indexOf('id="poi"');
    expect(wow).toBeGreaterThan(0);
    expect(strip).toBeGreaterThan(wow);
    expect(accordion).toBeGreaterThan(strip);
    expect(result).toContain('data-testid="poi-wow-strip"');
  });
});
