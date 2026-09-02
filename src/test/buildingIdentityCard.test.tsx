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
    const photoEl = screen.getByTestId("building-identity-photo");
    expect(photoEl.tagName).toBe("CANVAS");
    expect(screen.getByRole("img", { name: "Edificio acquisito" })).toBe(photoEl);
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
    expect(screen.getAllByText(/Questo edificio/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/identici per il civico accanto/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Dato ufficiale/i);
    expect(document.body.textContent).toMatch(/non un dato catastale/i);
    expect(document.body.textContent).not.toMatch(/successione|in vendita|intero stabile/i);
  });

  it("shows photo-read and GPS civic facts only when Core sends them", () => {
    render(
      <BuildingIdentityCard
        photo={PHOTO}
        identify={{
          ...IDENTIFY,
          streetEvidence: {
            ...IDENTIFY.streetEvidence,
            houseNumberConfirmed: true,
            photoAnalysis: {
              ...IDENTIFY.streetEvidence!.photoAnalysis,
              visibleHouseNumber: "18",
              visibleStreetName: "Via Forcellini",
            },
          },
          geoResolution: {
            resolvedHouseNumber: "18",
            resolvedStreet: "Via Forcellini",
            resolvedPostalCode: "35128",
            resolvedComune: "Padova",
            resolvedProvincia: "PD",
          },
        }}
      />,
    );
    expect(screen.getByText("Civico letto sulla facciata")).toBeInTheDocument();
    expect(screen.getByText("Via letta sulla targa")).toBeInTheDocument();
    expect(screen.getByText("35128 · Padova (PD)")).toBeInTheDocument();
    expect(screen.getByText(/Civico confermato: foto = GPS/i)).toBeInTheDocument();
    expect(screen.queryByTestId("civico-mismatch")).not.toBeInTheDocument();
  });

  it("fails closed on a photo/GPS civic conflict — no winner picked", () => {
    render(
      <BuildingIdentityCard
        photo={PHOTO}
        identify={{
          ...IDENTIFY,
          streetEvidence: {
            photoAnalysis: { visibleHouseNumber: "20" },
          },
          geoResolution: { resolvedHouseNumber: "18" },
        }}
      />,
    );
    expect(screen.getByTestId("civico-mismatch")).toBeInTheDocument();
    expect(screen.queryByText(/Civico confermato/i)).not.toBeInTheDocument();
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
    expect(result).toContain('id="facciata"');
    expect(result).toContain('id="istat"');
    expect(result).toContain('id="poi"');
    expect(result).toContain("Fonti e Metodologia");
  });
});

describe("identity photo screenshots on iPhone", () => {
  it("does not overlay the facade — no full-card or bottom fade, meta below the photo", () => {
    const src = readFileSync("src/components/report/BuildingIdentityCard.tsx", "utf8");
    expect(src).not.toMatch(/inset-0 bg-gradient-to-t from-card via-card\/25/);
    expect(src).not.toContain("bottom-0 h-20");
    expect(src).not.toContain("bg-gradient-to-t from-card");
    expect(src).not.toContain("-mt-8");
    expect(src).not.toMatch(/mix-blend|backdrop-filter|filter:\s*blur/);
    expect(src).toContain("[dynamic-range-limit:standard]");
    expect(src).toContain("bg-card");
    expect(src).toContain("<canvas");
    expect(src).toContain("FacadeCanvas");
    expect(src).not.toMatch(/<img\s+src=\{photo\}/);
    expect(src).toContain("getImageData");
  });
});
