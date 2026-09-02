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
  shouldShowEmptyScanAddressPrompt,
} from "@/lib/reportSectionPublishable";
import { officialOmiFromCore } from "@/lib/officialOmiFromCore";
import AddressOverrideForm from "@/components/AddressOverrideForm";
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

  it("hides only the empty modules on that scan — not a permanent hide-list", () => {
    const padovaOmi: OmiZoneData = {
      sourceType: "official",
      zonaOmi: "D8",
      zonaOmiLabel: "Est",
      comuneLabel: "Padova",
      quotazioneMinResidenziale: 1850,
      quotazioneMaxResidenziale: 2400,
    };
    const { rerender } = render(
      <>
        <PublishableAccordionItem id="omi" title="Quotazioni OMI" loading={false} publishable={isOmiPublishable(padovaOmi)}>
          <p>Est D8</p>
        </PublishableAccordionItem>
        <PublishableAccordionItem id="condominio" title="Condominio" loading={false} publishable={isCondominioPublishable(null)}>
          <EmptyCard />
        </PublishableAccordionItem>
        <PublishableAccordionItem id="istat" title="Dati Demografici" loading={false} publishable={isIstatPublishable({ popolazione: null })}>
          <EmptyCard />
        </PublishableAccordionItem>
        <PublishableAccordionItem id="poi" title="Servizi e POI" loading={false} publishable={isPoiPublishable({ totalPois: 0, categories: [], pois: [], searchRadius: 800 })}>
          <EmptyCard />
        </PublishableAccordionItem>
      </>,
    );
    expect(screen.getByText("Quotazioni OMI")).toBeInTheDocument();
    expect(screen.queryByText("Condominio")).not.toBeInTheDocument();

    rerender(
      <>
        <PublishableAccordionItem id="omi" title="Quotazioni OMI" loading={false} publishable={isOmiPublishable({ sourceType: "unavailable" })}>
          <EmptyCard />
        </PublishableAccordionItem>
        <PublishableAccordionItem id="condominio" title="Condominio" loading={false} publishable={isCondominioPublishable({ amministratore: "Studio Rossi", numero_unita: 12 })}>
          <p>Studio Rossi</p>
        </PublishableAccordionItem>
        <PublishableAccordionItem id="istat" title="Dati Demografici" loading={false} publishable={isIstatPublishable({ popolazione: 48200, sourceType: "official" })}>
          <p>48.200 abitanti</p>
        </PublishableAccordionItem>
        <PublishableAccordionItem id="poi" title="Servizi e POI" loading={false} publishable={isPoiPublishable({ totalPois: 0, categories: [], pois: [], searchRadius: 800 })}>
          <EmptyCard />
        </PublishableAccordionItem>
      </>,
    );
    expect(screen.queryByText("Quotazioni OMI")).not.toBeInTheDocument();
    expect(screen.getByText("Condominio")).toBeInTheDocument();
    expect(screen.getByText("Dati Demografici")).toBeInTheDocument();
    expect(screen.queryByText("Servizi e POI")).not.toBeInTheDocument();
  });

  it("shows Quotazioni OMI defaultOpen when official Padova B1 2400–3400 is publishable", () => {
    const omi = officialOmiFromCore({
      zona: "Centro (OMI B1)",
      officialMicrozona: "B1",
      prezzoMqMin: 2400,
      prezzoMqMax: 3400,
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
        <p>Centro B1 · 2400–3400 €/m²</p>
      </PublishableAccordionItem>,
    );
    const trigger = screen.getByRole("button", { name: /quotazioni omi/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/2400–3400/)).toBeInTheDocument();
  });

  it("shows Quotazioni OMI defaultOpen for official D7 950–1200 and does not force B1", () => {
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
          polygonMatch: true,
        },
      ],
    });
    expect(isOmiPublishable(omi)).toBe(true);
    expect(omi!.zonaOmi).toBe("D7");
    expect(omi!.quotazioneMinResidenziale).toBe(950);
    expect(omi!.quotazioneMaxResidenziale).toBe(1200);
    expect(omi!.zonaOmi).not.toBe("B1");

    render(
      <PublishableAccordionItem
        id="omi"
        title="Quotazioni OMI"
        defaultOpen
        loading={false}
        publishable={isOmiPublishable(omi)}
      >
        <p>D7 · 950–1200 €/m²</p>
      </PublishableAccordionItem>,
    );
    expect(screen.getByRole("button", { name: /quotazioni omi/i })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/950–1200/)).toBeInTheDocument();
    expect(screen.queryByText(/B1/)).not.toBeInTheDocument();
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
      sourceType: "official", polygonMatch: true, omiGeoLevel: "microzona_omi",
    };
    expect(isPricingPublishable(pricing)).toBe(true);
    // Fail-closed: GPS outside the AdE polygon (comunale) hides the pricing card.
    expect(isPricingPublishable({ ...pricing, polygonMatch: false, omiGeoLevel: "comune" })).toBe(false);
    expect(isPricingPublishable({ ...pricing, prezzoMq: null as unknown as number, sourceType: "official" })).toBe(false);

    expect(isPoiPublishable({ totalPois: 12, categories: [], pois: [], searchRadius: 800, sourceType: "verified_geo" })).toBe(true);
    expect(isPoiPublishable({ totalPois: 0, categories: [], pois: [], searchRadius: 800, sourceType: "verified_geo" })).toBe(false);

    expect(isIstatPublishable({ popolazione: 207000, sourceType: "official" })).toBe(true);
    expect(isIstatPublishable({ popolazione: null, sourceType: "official" })).toBe(false);

    expect(isFontiPublishable({ fonti: [{ categoria: "dato_ufficiale", categoriaLabel: "Quotazioni OMI" }] })).toBe(true);
    expect(isFontiPublishable({ fonti: [] })).toBe(false);
    expect(isFontiPublishable(null)).toBe(false);
  });

  it("publishes condominio / APE / off-market / atti only when that scan has real data", () => {
    expect(isCondominioPublishable(null)).toBe(false);
    expect(isCondominioPublishable({ amministratore: "non disponibile" })).toBe(false);
    expect(isCondominioPublishable({ amministratore: "Studio Rossi", numero_unita: 12 })).toBe(true);

    expect(isEnergyPublishable({ classeEnergetica: "—", sourceType: "estimate" })).toBe(false);
    expect(isEnergyPublishable({ classeEnergetica: "D", epglKwhM2Anno: 180, sourceType: "estimate" })).toBe(true);

    expect(isOffmarketPublishable({ totale: 0, segnali: [], opportunita: ["Segnali non disponibili"] })).toBe(false);
    expect(isOffmarketPublishable({ totale: 1, segnali: [{ tipo: "asta", titolo: "Asta via Roma" }] })).toBe(true);

    expect(isStoricoPublishable({ totale: 0, transazioni: [] })).toBe(false);
    expect(isStoricoPublishable({ totale: 2, transazioni: [{ prezzo: 240000 }] })).toBe(true);
  });
});

describe("empty finished scan — address prompt, no invented quotes", () => {
  it("keeps the Italian address form and hides Quotazioni OMI when nothing is publishable", () => {
    expect(shouldShowEmptyScanAddressPrompt(false, false)).toBe(true);
    expect(shouldShowEmptyScanAddressPrompt(true, false)).toBe(false);
    expect(shouldShowEmptyScanAddressPrompt(false, true)).toBe(false);

    const emptyOmi = officialOmiFromCore({ zona: { nomeComune: "Padova" }, scores: null });
    expect(isOmiPublishable(emptyOmi)).toBe(false);

    render(
      <>
        <AddressOverrideForm defaultOpen onSubmit={() => undefined} />
        <PublishableAccordionItem
          id="omi"
          title="Quotazioni OMI"
          defaultOpen
          loading={false}
          publishable={isOmiPublishable(emptyOmi)}
        >
          <p>2400–3400</p>
        </PublishableAccordionItem>
      </>,
    );

    expect(screen.getByText("Indirizzo immobile")).toBeInTheDocument();
    expect(screen.getByText(/inserisci l'indirizzo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/via \/ piazza/i)).toBeInTheDocument();
    expect(screen.queryByText("Quotazioni OMI")).not.toBeInTheDocument();
    expect(screen.queryByText("2400–3400")).not.toBeInTheDocument();
    expect(screen.queryByText(/catasto/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/APE/i)).not.toBeInTheDocument();
  });
});
