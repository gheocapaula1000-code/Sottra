import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function src(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

const STRIPPED_GETTERS = [
  "getOffmarket",
  "getZoneIntelligence",
  "getListings",
  "getCondominio",
  "getStoricoTransazioni",
  "getMoodScore",
  "getEnergy",
  "getMarketContext",
  "getTimeView",
  "getOpportunityIndex",
  "getSviluppoArea",
  "getConvergenzaTerritoriale",
  "getNeighborhood",
];

describe("Sidewalk Result path stays official and fail-closed", () => {
  it("useBuildingScan never fires Perplexity/Apify/listings/energy/condominio modules", () => {
    const hook = src("src/hooks/useBuildingScan.ts");
    for (const g of STRIPPED_GETTERS) {
      expect(hook, g).not.toContain(g);
    }
    expect(hook).toContain("SIDEWALK_STRIPPED_MODULES");
    // Official core stays
    for (const keep of ["identifyBuilding", "getPricing", "getPoiEnrichment", "fetchProSources", "getPhotoWow", "getRischioZona", "getTrendDemografico"]) {
      expect(hook, keep).toContain(keep);
    }
  });

  it("Result page does not render stripped sections", () => {
    const page = src("src/pages/Result.tsx");
    for (const banned of [
      "OffmarketSection",
      "ZoneIntelligenceSection",
      "ListingsSection",
      "CondominioSection",
      "StoricoTransazioniSection",
      "MoodScoreSection",
      "EnergySection",
      "Perplexity",
      "Apify",
      "Firecrawl",
      "MarketContextCard",
      "PosizionamentoCommercialeCard",
      "NeighborhoodIndexCard",
      "ConvergenzaTerritorialeCard",
      "OpportunityCard",
      "ScenarioTemporaleCard",
      "TimeViewCard",
      "SviluppoAreaCard",
      "successione",
    ]) {
      expect(page, banned).not.toContain(banned);
    }
    // Official sections stay
    for (const keep of ["OmiQuotesTable", "IstatSubMunicipalAreasTable", "PoiEnrichmentCard", "BuildingIdentityCard", "RischioZonaCard", "TrasparenzaFontiCard"]) {
      expect(page, keep).toContain(keep);
    }
  });

  it("no invented figures: no visura/APE ufficiale/vendita-successione claims, no sottra.it, no +IVA", () => {
    const page = src("src/pages/Result.tsx");
    expect(page).not.toMatch(/visura/i);
    expect(page).not.toMatch(/sottra\.it/i);
    expect(page).not.toMatch(/\+\s?IVA/i);
  });
});
