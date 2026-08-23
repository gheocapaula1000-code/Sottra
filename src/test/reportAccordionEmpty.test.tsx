import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ReportAccordionItem,
  PublishableAccordionItem,
  isEmptyAccordionChildren,
} from "@/components/report/ReportAccordion";
import {
  isCondominioPublishable,
  isEnergyPublishable,
  isFontiPublishable,
  isIstatPublishable,
  isMeaningfulCopy,
  isOmiPublishable,
  isOffmarketPublishable,
  isPoiPublishable,
  isPricingPublishable,
  isStoricoPublishable,
  shouldRenderAccordion,
} from "@/lib/reportSectionPublishable";
import type { OmiZoneData, PricingData } from "@/types";

function EmptyCard() {
  return null;
}

describe("isEmptyAccordionChildren", () => {
  it("treats null, false, empty string, and empty fragment as empty", () => {
    expect(isEmptyAccordionChildren(null)).toBe(true);
    expect(isEmptyAccordionChildren(undefined)).toBe(true);
    expect(isEmptyAccordionChildren(false)).toBe(true);
    expect(isEmptyAccordionChildren("")).toBe(true);
    expect(isEmptyAccordionChildren("   ")).toBe(true);
    expect(isEmptyAccordionChildren(<></>)).toBe(true);
    expect(isEmptyAccordionChildren(<>{null}</>)).toBe(true);
    expect(isEmptyAccordionChildren([null, false])).toBe(true);
  });

  it("treats real nodes as present", () => {
    expect(isEmptyAccordionChildren(<p>OMI</p>)).toBe(false);
    expect(isEmptyAccordionChildren(<EmptyCard />)).toBe(false);
    expect(isEmptyAccordionChildren("Quotazioni")).toBe(false);
  });
});

describe("data-gated accordion titles", () => {
  it("omits title+chevron when the section is unpublished and not loading", () => {
    const { container } = render(
      <PublishableAccordionItem id="empty" title="Sezione vuota" loading={false} publishable={false}>
        <EmptyCard />
      </PublishableAccordionItem>,
    );
    expect(screen.queryByText("Sezione vuota")).not.toBeInTheDocument();
    expect(container.querySelector("button")).toBeNull();
  });

  it("omits title for null/unavailable modules (condominio, APE, off-market, atti)", () => {
    render(
      <>
        <PublishableAccordionItem id="condominio" title="Condominio" loading={false} publishable={isCondominioPublishable(null)}>
          <EmptyCard />
        </PublishableAccordionItem>
        <PublishableAccordionItem id="energy" title="Profilo energetico stimato" loading={false} publishable={isEnergyPublishable({ sourceType: "unavailable" })}>
          <EmptyCard />
        </PublishableAccordionItem>
        <PublishableAccordionItem id="offmarket" title="Segnali Off-Market" loading={false} publishable={isOffmarketPublishable({ totale: 0, segnali: [], opportunita: [] })}>
          <EmptyCard />
        </PublishableAccordionItem>
        <PublishableAccordionItem id="atti" title="Storico transazioni" loading={false} publishable={isStoricoPublishable({ totale: 0, transazioni: [] })}>
          <EmptyCard />
        </PublishableAccordionItem>
      </>,
    );
    expect(screen.queryByText("Condominio")).not.toBeInTheDocument();
    expect(screen.queryByText("Profilo energetico stimato")).not.toBeInTheDocument();
    expect(screen.queryByText("Segnali Off-Market")).not.toBeInTheDocument();
    expect(screen.queryByText("Storico transazioni")).not.toBeInTheDocument();
  });

  it("still shows Quotazioni OMI when official zone prices exist", () => {
    const omi: OmiZoneData = {
      sourceType: "official",
      zonaOmi: "D8",
      zonaOmiLabel: "Est",
      comuneLabel: "Padova",
      quotazioneMinResidenziale: 1850,
      quotazioneMaxResidenziale: 2400,
      semestre: "2025-1",
    };
    render(
      <PublishableAccordionItem
        id="omi"
        title="Quotazioni OMI"
        defaultOpen
        loading={false}
        publishable={isOmiPublishable(omi)}
      >
        <p>Est OMI D8 · 1.850–2.400 €/m²</p>
      </PublishableAccordionItem>,
    );
    expect(screen.getByRole("button", { name: /quotazioni omi/i })).toBeInTheDocument();
    expect(screen.getByText("Quotazioni OMI")).toBeInTheDocument();
    expect(screen.getByText(/Est OMI D8/)).toBeInTheDocument();
  });

  it("keeps the tendina visible while a loading skeleton is shown, then can hide", () => {
    const { rerender } = render(
      <PublishableAccordionItem id="pricing" title="Prezzi di Mercato" defaultOpen loading publishable={false}>
        <div className="animate-pulse h-16" />
      </PublishableAccordionItem>,
    );
    expect(screen.getByRole("button", { name: /prezzi di mercato/i })).toBeInTheDocument();

    rerender(
      <PublishableAccordionItem id="pricing" title="Prezzi di Mercato" defaultOpen loading={false} publishable={false}>
        <EmptyCard />
      </PublishableAccordionItem>,
    );
    expect(screen.queryByText("Prezzi di Mercato")).not.toBeInTheDocument();
  });

  it("omits the tendina when children are statically null", () => {
    render(
      <ReportAccordionItem id="empty" title="Sezione vuota">
        {null}
      </ReportAccordionItem>,
    );
    expect(screen.queryByText("Sezione vuota")).not.toBeInTheDocument();
  });
});

describe("shouldRenderAccordion + publishability", () => {
  it("shows only while loading or when data is publishable", () => {
    expect(shouldRenderAccordion(true, false)).toBe(true);
    expect(shouldRenderAccordion(false, true)).toBe(true);
    expect(shouldRenderAccordion(false, false)).toBe(false);
  });

  it("does not treat leftover dash / non disponibile copy as content", () => {
    expect(isMeaningfulCopy("—")).toBe(false);
    expect(isMeaningfulCopy("non disponibile")).toBe(false);
    expect(isMeaningfulCopy("Segnali non disponibili")).toBe(false);
    expect(isMeaningfulCopy("APE non disponibile")).toBe(false);
    expect(isMeaningfulCopy("Est")).toBe(true);
  });

  it("keeps official OMI / pricing / POI / ISTAT / fonti when they have real data", () => {
    expect(isOmiPublishable({
      sourceType: "official",
      zonaOmi: "D8",
      quotazioneMinResidenziale: 1850,
    })).toBe(true);
    expect(isOmiPublishable({ sourceType: "unavailable" })).toBe(false);

    const pricing: PricingData = {
      prezzoMq: 2100, prezzoMqMin: 1800, prezzoMqMax: 2500, mediaZona: null, trend5Anni: null,
      sourceType: "official",
    };
    expect(isPricingPublishable(pricing)).toBe(true);
    expect(isPricingPublishable({ ...pricing, prezzoMq: null as unknown as number, sourceType: "official" })).toBe(false);

    expect(isPoiPublishable({ totalPois: 12, categories: [], pois: [], searchRadius: 800, sourceType: "verified_geo" })).toBe(true);
    expect(isPoiPublishable({ totalPois: 0, categories: [], pois: [], searchRadius: 800, sourceType: "verified_geo" })).toBe(false);

    expect(isIstatPublishable({ popolazione: 207000, sourceType: "official" })).toBe(true);
    expect(isIstatPublishable({ popolazione: null, sourceType: "official" })).toBe(false);

    expect(isFontiPublishable({ fonti: [{ categoria: "dato_ufficiale", categoriaLabel: "Quotazioni OMI" }] })).toBe(true);
    expect(isFontiPublishable({ fonti: [] })).toBe(false);
    expect(isFontiPublishable(null)).toBe(false);
  });

  it("never publishes empty condominio / APE / off-market / atti", () => {
    expect(isCondominioPublishable(null)).toBe(false);
    expect(isCondominioPublishable({ amministratore: "non disponibile" })).toBe(false);
    expect(isEnergyPublishable({ classeEnergetica: "—", sourceType: "estimate" })).toBe(false);
    expect(isOffmarketPublishable({ totale: 0, segnali: [], opportunita: ["Segnali non disponibili"] })).toBe(false);
    expect(isStoricoPublishable({ totale: 0, transazioni: [] })).toBe(false);
  });
});
