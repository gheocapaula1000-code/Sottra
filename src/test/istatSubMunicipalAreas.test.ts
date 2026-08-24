import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, from: vi.fn() },
}));

import { parseIstatResult } from "@/services/proSources";
import { IstatSubMunicipalAreasTable } from "@/components/report/IstatSubMunicipalAreasTable";
import {
  applyOmiNameOnlySuggestion,
  hasRenderableIstatAreas,
  ISTAT_SUB_MUNICIPAL_SOURCE_LABEL,
  mapOfficialSubMunicipalAreas,
  OMI_NAME_ONLY_SUGGESTION_NOTE,
  omiLabelSuggestsEstArea,
  PADOVA_BROKEN_COMUNI_POP,
  PADOVA_ISTAT_CODE,
  sanitizeComunalePopolazione,
} from "@/lib/istatSubMunicipalAreas";
import { isIstatPublishable } from "@/lib/reportSectionPublishable";
import type { IstatSubMunicipalArea } from "@/types";

/** Verified Lovable Sottra DB rows for Padova 028060 — pop / nuclei. */
export const PADOVA_ISTAT_2021_AREAS: IstatSubMunicipalArea[] = [
  { name: "Centro", popolazione: 25443, nucleiFamiliari: 14183, comuneIstatCode: PADOVA_ISTAT_CODE },
  { name: "Est", popolazione: 36443, nucleiFamiliari: 17385, comuneIstatCode: PADOVA_ISTAT_CODE },
  { name: "Nord", popolazione: 38567, nucleiFamiliari: 18876, comuneIstatCode: PADOVA_ISTAT_CODE },
  { name: "Ovest", popolazione: 32246, nucleiFamiliari: 14930, comuneIstatCode: PADOVA_ISTAT_CODE },
  { name: "Sud-Est", popolazione: 46376, nucleiFamiliari: 23065, comuneIstatCode: PADOVA_ISTAT_CODE },
  { name: "Sud-Ovest", popolazione: 27576, nucleiFamiliari: 13475, comuneIstatCode: PADOVA_ISTAT_CODE },
];

const PADOVA_ISTAT_PAYLOAD = {
  popolazione: 208202,
  comuneLabel: "Padova",
  comuneIstatCode: PADOVA_ISTAT_CODE,
  geoLevel: "comune",
  sourceType: "official",
  sourceLabel: "ISTAT — Popolazione residente al 1° gennaio",
  areas: PADOVA_ISTAT_2021_AREAS,
};

describe("Padova ISTAT 2021 sub-municipal areas", () => {
  it("Padova payload → 6 rows with the official pop / famiglie numbers", () => {
    const parsed = parseIstatResult(PADOVA_ISTAT_PAYLOAD);
    expect(parsed).not.toBeNull();
    expect(parsed!.popolazione).toBe(208202);
    expect(parsed!.areas).toHaveLength(6);

    const byName = Object.fromEntries((parsed!.areas ?? []).map((a) => [a.name, a]));
    expect(byName.Centro).toMatchObject({ popolazione: 25443, nucleiFamiliari: 14183 });
    expect(byName.Est).toMatchObject({ popolazione: 36443, nucleiFamiliari: 17385 });
    expect(byName.Nord).toMatchObject({ popolazione: 38567, nucleiFamiliari: 18876 });
    expect(byName.Ovest).toMatchObject({ popolazione: 32246, nucleiFamiliari: 14930 });
    expect(byName["Sud-Est"]).toMatchObject({ popolazione: 46376, nucleiFamiliari: 23065 });
    expect(byName["Sud-Ovest"]).toMatchObject({ popolazione: 27576, nucleiFamiliari: 13475 });
  });

  it("does not invent a D8-only population or change the comunale 208.202", () => {
    const parsed = parseIstatResult(PADOVA_ISTAT_PAYLOAD);
    expect(parsed!.popolazione).toBe(208202);
    expect(parsed!.popolazione).not.toBe(36443);
    expect(parsed!.areas?.find((a) => a.name === "Est")?.popolazione).toBe(36443);
  });

  it("never displays the broken istat_comuni 11185 as Padova population", () => {
    expect(sanitizeComunalePopolazione(PADOVA_BROKEN_COMUNI_POP, PADOVA_ISTAT_CODE, "Padova")).toBeNull();
    const parsed = parseIstatResult({
      ...PADOVA_ISTAT_PAYLOAD,
      popolazione: PADOVA_BROKEN_COMUNI_POP,
    });
    expect(parsed!.popolazione).toBeNull();
    expect(parsed!.areas).toHaveLength(6);
    expect(isIstatPublishable(parsed)).toBe(true);
  });

  it("keeps a live 208.202 comunale figure for Padova", () => {
    expect(sanitizeComunalePopolazione(208202, PADOVA_ISTAT_CODE, "Padova")).toBe(208202);
  });
});

describe("non-Padova comune does not receive invented Padova areas", () => {
  it("filters Padova-tagged rows when the scan comune is Milano", () => {
    const mapped = mapOfficialSubMunicipalAreas(PADOVA_ISTAT_2021_AREAS, "015146");
    expect(mapped).toEqual([]);
  });

  it("parseIstatResult for Milano drops Padova areas[]", () => {
    const parsed = parseIstatResult({
      popolazione: 1372000,
      comuneLabel: "Milano",
      comuneIstatCode: "015146",
      geoLevel: "comune",
      sourceType: "official",
      areas: PADOVA_ISTAT_2021_AREAS,
    });
    expect(parsed!.comuneLabel).toBe("Milano");
    expect(parsed!.popolazione).toBe(1372000);
    expect(parsed!.areas).toEqual([]);
  });

  it("maps snake_case DB rows for Padova 028060", () => {
    const dbRows = [
      { area_name: "Centro", popolazione: 25443, nuclei_familiari: 14183, comune_istat_code: "028060" },
      { area_name: "Est", popolazione: 36443, nuclei_familiari: 17385, comune_istat_code: "028060" },
      { area_name: "Nord", popolazione: 38567, nuclei_familiari: 18876, comune_istat_code: "028060" },
      { area_name: "Ovest", popolazione: 32246, nuclei_familiari: 14930, comune_istat_code: "028060" },
      { area_name: "Sud-Est", popolazione: 46376, nuclei_familiari: 23065, comune_istat_code: "028060" },
      { area_name: "Sud-Ovest", popolazione: 27576, nuclei_familiari: 13475, comune_istat_code: "028060" },
    ];
    const mapped = mapOfficialSubMunicipalAreas(dbRows, PADOVA_ISTAT_CODE);
    expect(mapped).toHaveLength(6);
    expect(mapped.map((a) => [a.name, a.popolazione, a.nucleiFamiliari])).toEqual([
      ["Centro", 25443, 14183],
      ["Est", 36443, 17385],
      ["Nord", 38567, 18876],
      ["Ovest", 32246, 14930],
      ["Sud-Est", 46376, 23065],
      ["Sud-Ovest", 27576, 13475],
    ]);
  });

  it("does not invent Padova areas when the payload has none", () => {
    const parsed = parseIstatResult({
      popolazione: 48200,
      comuneLabel: "Vicenza",
      comuneIstatCode: "024116",
      geoLevel: "comune",
      sourceType: "official",
    });
    expect(parsed!.areas).toEqual([]);
    expect(hasRenderableIstatAreas(parsed!.areas)).toBe(false);
  });
});

describe("empty areas hide", () => {
  it("table renders nothing when areas is empty", () => {
    const { container } = render(<IstatSubMunicipalAreasTable areas={[]} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("istat-submunicipal-areas")).not.toBeInTheDocument();
    expect(screen.queryByText("Centro")).not.toBeInTheDocument();
  });

  it("table renders nothing when areas is null", () => {
    const { container } = render(<IstatSubMunicipalAreasTable areas={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("isIstatPublishable stays false without municipal metrics or areas", () => {
    expect(isIstatPublishable({ popolazione: null, sourceType: "official", areas: [] })).toBe(false);
    expect(isIstatPublishable({ popolazione: 207000, sourceType: "official" })).toBe(true);
  });
});

describe("IstatSubMunicipalAreasTable — Padova rows", () => {
  it("renders the 6 official areas with exact pop and famiglie", () => {
    render(<IstatSubMunicipalAreasTable areas={PADOVA_ISTAT_2021_AREAS} />);
    expect(screen.getByTestId("istat-submunicipal-areas")).toBeInTheDocument();
    expect(screen.getByText(ISTAT_SUB_MUNICIPAL_SOURCE_LABEL)).toBeInTheDocument();

    for (const area of PADOVA_ISTAT_2021_AREAS) {
      expect(screen.getByText(area.name)).toBeInTheDocument();
      expect(screen.getByText(area.popolazione!.toLocaleString("it-IT"))).toBeInTheDocument();
      expect(screen.getByText(area.nucleiFamiliari!.toLocaleString("it-IT"))).toBeInTheDocument();
    }
    expect(screen.queryByText("Densità")).not.toBeInTheDocument();
    expect(screen.queryByText("Età media")).not.toBeInTheDocument();
  });

  it("does not invent density or age when those columns are null", () => {
    const withNulls = PADOVA_ISTAT_2021_AREAS.map((a) => ({ ...a, densita: null, etaMedia: null }));
    render(<IstatSubMunicipalAreasTable areas={withNulls} />);
    expect(screen.queryByText("Densità")).not.toBeInTheDocument();
    expect(screen.queryByText("Età media")).not.toBeInTheDocument();
    expect(screen.queryByText("11185")).not.toBeInTheDocument();
  });
});

describe("OMI name-only Est suggestion — not a polygon match", () => {
  it.each([
    "Est",
    "D8 Est",
    "Est - Forcellini / Terranegra",
    "Forcellini",
    "Terranegra",
    "San Gregorio",
  ])("highlights Est for OMI label %s", (label) => {
    expect(omiLabelSuggestsEstArea(label)).toBe(true);
    const annotated = applyOmiNameOnlySuggestion(PADOVA_ISTAT_2021_AREAS, label);
    expect(annotated.find((a) => a.name === "Est")?.suggestedNameOnly).toBe(true);
    expect(annotated.filter((a) => a.suggestedNameOnly).map((a) => a.name)).toEqual(["Est"]);
  });

  it("does not treat Ovest or a bare D8 code as Est", () => {
    expect(omiLabelSuggestsEstArea("Ovest")).toBe(false);
    expect(omiLabelSuggestsEstArea("D8")).toBe(false);
    expect(omiLabelSuggestsEstArea("Sud-Ovest")).toBe(false);
    const annotated = applyOmiNameOnlySuggestion(PADOVA_ISTAT_2021_AREAS, "D8");
    expect(annotated.every((a) => !a.suggestedNameOnly)).toBe(true);
  });

  it("shows explicit copy that the highlight is not a polygon match", () => {
    render(
      <IstatSubMunicipalAreasTable
        areas={PADOVA_ISTAT_2021_AREAS}
        omiZoneLabel="Est - Forcellini / Terranegra"
      />,
    );
    const estRow = document.querySelector('[data-area="Est"]');
    expect(estRow).toHaveAttribute("data-suggested", "true");
    expect(screen.getByText(/suggerimento nominale/i)).toBeInTheDocument();
    expect(screen.getByText(OMI_NAME_ONLY_SUGGESTION_NOTE)).toBeInTheDocument();
    expect(OMI_NAME_ONLY_SUGGESTION_NOTE).toMatch(/non è un match poligonale/i);
  });
});
