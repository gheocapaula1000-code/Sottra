import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { BuildingIdentityCard } from "@/components/report/BuildingIdentityCard";
import type { IdentifyResult } from "@/types";

const PHOTO =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAD/2Q==";

const IDENTIFY: IdentifyResult = {
  address: "Via Forcellini 18, Padova",
  buildingId: "bld-18",
  confidence: 0.9,
  streetEvidence: {
    facadeConsistencyLevel: "strong",
    photoAnalysis: {
      buildingType: "Condominio residenziale",
      visibleFloors: 5,
      photoReadability: "clear",
    },
  },
};

describe("BuildingIdentityCard", () => {
  it("keeps the captured photo while identify is still loading — no blank slot", () => {
    render(
      <BuildingIdentityCard
        photo={PHOTO}
        identify={null}
        loading
        lat={45.4066}
        lng={11.9172}
      />,
    );
    const img = screen.getByAltText("Edificio acquisito");
    expect(img).toHaveAttribute("src", PHOTO);
    expect(screen.queryByTestId("building-identity-empty-photo")).not.toBeInTheDocument();
    expect(screen.getByText(/Riconoscimento civico/i)).toBeInTheDocument();
  });

  it("leads with civico + photoAnalysis so this building is not the one next door", () => {
    render(
      <BuildingIdentityCard
        photo={PHOTO}
        identify={IDENTIFY}
        lat={45.4066}
        lng={11.9172}
      />,
    );
    expect(screen.getByText("Via Forcellini 18, Padova")).toBeInTheDocument();
    expect(screen.getByText("Condominio residenziale")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Facciata coerente")).toBeInTheDocument();
    expect(screen.getByText("Foto chiara")).toBeInTheDocument();
    expect(screen.getByText(/Questo edificio/i)).toBeInTheDocument();
    expect(screen.getByText(/identici per il civico accanto/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Dato ufficiale/i);
    expect(document.body.textContent).toMatch(/non un dato catastale/i);
  });
});

describe("Result leads with this-building WOW then zone", () => {
  it("BuildingIdentityCard and HouseDifferentiation appear before WowPanel; engines stay", () => {
    const result = readFileSync("src/pages/Result.tsx", "utf8");
    const id = result.indexOf("<BuildingIdentityCard");
    const diff = result.indexOf("<HouseDifferentiationCard");
    const wow = result.indexOf("<WowPanel");
    const omi = result.indexOf('id="omi"');
    const istat = result.indexOf('id="istat"');
    const poi = result.indexOf('id="poi"');
    const rischio = result.indexOf('id="rischio"');
    expect(id).toBeGreaterThan(0);
    expect(diff).toBeGreaterThan(id);
    expect(wow).toBeGreaterThan(diff);
    expect(result).not.toContain("CivicoSignalsCard");
    expect(omi).toBeGreaterThan(wow);
    expect(istat).toBeGreaterThan(omi);
    expect(poi).toBeGreaterThan(0);
    expect(rischio).toBeGreaterThan(0);
    expect(result).toContain("streetEvidence?.photoAnalysis?.buildingType");
    expect(result).toContain("loadLastScanPhoto");
    expect(result).toContain("saveLastScanPhoto");
    // dossier stays dense — do not shrink to 3–4 cards
    expect(result).toContain('id="pricing"');
    expect(result).toContain('id="market"');
    expect(result).toContain('id="facciata"');
    expect(result).toContain('id="convergenza"');
    expect(result).toContain("Fonti e Metodologia");
  });
});
