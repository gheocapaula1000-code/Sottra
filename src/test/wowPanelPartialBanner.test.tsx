import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  hasOfficialOmiQuotes,
  hasPianoEsclusivaContent,
  hasZonaIntelligenceContent,
  WowPanel,
} from "@/components/report/WowPanel";
import type { PhotoWowResponse } from "@/types/photoWow";
import type { OmiZoneData } from "@/types";

const PHOTO = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const PADOVA_D8: OmiZoneData = {
  sourceType: "official",
  zonaOmi: "D8",
  zonaOmiLabel: "D8",
  comuneLabel: "Padova",
  quotazioneMinResidenziale: 1400,
  quotazioneMaxResidenziale: 2750,
  semestre: "2S 2024",
};

function emptyWow(overrides: Partial<PhotoWowResponse> = {}): PhotoWowResponse {
  return {
    immobile: {
      tipologiaProbabile: null,
      pianoStimato: null,
      statoApparente: null,
      puntiDiForzaVisivi: [],
      materialePresunto: null,
      annoPresunto: null,
    },
    zona: {
      nomeComune: "Padova",
      provincia: "PD",
      nomeZonaOmi: null,
      fascia: null,
      valoreMinOmi: null,
      valoreMaxOmi: null,
      tendenzaMercato: null,
      classificazioneZona: null,
      sentimentResidenti: null,
      livelloSentiment: null,
    },
    scores: {
      vendibilita: null,
      opportunitaInvestimento: null,
      pressioneEreditaria: null,
    },
    liveSignals: [],
    territorialDocuments: [],
    zonaIntelligence: {
      notizieRecenti: [],
      puntiDiForzaNascosti: [],
      criticitaEmergenti: [],
      tendenzaMercato: "",
    },
    vendutoRecente: [],
    mappaCaloreUrl: "",
    pianoEsclusiva: {
      argomento: "",
      puntiChiave: [],
      obiezioniProbabili: [],
      stimaRapida: "",
    },
    qualita: "minima",
    tempoElaborazione: 0,
    fontiUsate: [],
    ...overrides,
  };
}

describe("hasOfficialOmiQuotes", () => {
  it("is true for Padova D8 official quotes", () => {
    expect(hasOfficialOmiQuotes(PADOVA_D8, "success")).toBe(true);
  });

  it("is true from quotes even without status", () => {
    expect(hasOfficialOmiQuotes(PADOVA_D8)).toBe(true);
  });

  it("is false when OMI is missing or unavailable", () => {
    expect(hasOfficialOmiQuotes(null, "error")).toBe(false);
    expect(hasOfficialOmiQuotes({ sourceType: "unavailable" }, "success")).toBe(false);
    expect(hasOfficialOmiQuotes({ sourceType: "official" }, "success")).toBe(false);
  });

  it("is true when status is success with real quotes even if sourceType is omitted", () => {
    expect(hasOfficialOmiQuotes({
      quotazioneMinResidenziale: 1400,
      quotazioneMaxResidenziale: 2750,
    }, "success")).toBe(true);
  });
});

describe("WowPanel partial banner", () => {
  it("hides the amber preview banner when official OMI is already on screen", () => {
    render(
      <WowPanel
        data={null}
        status="error"
        photo={PHOTO}
        officialOmi={{ status: "success", data: PADOVA_D8 }}
      />,
    );
    expect(screen.queryByTestId("wow-partial-banner")).not.toBeInTheDocument();
    expect(screen.queryByText(/Anteprima visiva non disponibile/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Dato ufficiale OMI/i)).toBeInTheDocument();
    expect(screen.getByText(/D8/)).toBeInTheDocument();
    expect(screen.getByText(/Padova/)).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/1400|1\.400/);
    expect(document.body.textContent).toMatch(/1850|1\.850/);
    expect(document.body.textContent).not.toMatch(/1400 € – 2750 €|1\.400\s*€\s*[–-]\s*2\.750/);
  });

  it("hides Intelligence zona and piano esclusiva when Core sent no body", () => {
    render(
      <WowPanel
        data={emptyWow()}
        status="success"
        photo={PHOTO}
        officialOmi={{ status: "success", data: PADOVA_D8 }}
      />,
    );
    expect(hasZonaIntelligenceContent(emptyWow().zonaIntelligence)).toBe(false);
    expect(hasPianoEsclusivaContent(emptyWow().pianoEsclusiva)).toBe(false);
    expect(screen.queryByText("Intelligence zona")).not.toBeInTheDocument();
    expect(screen.queryByText("Il tuo piano esclusiva")).not.toBeInTheDocument();
    expect(screen.getByText("Vendibilità")).toBeInTheDocument();
    expect(screen.getAllByText(/Non disponibile/i).length).toBeGreaterThanOrEqual(2);
  });

  it("keeps Intelligence zona when Core sent a body", () => {
    render(
      <WowPanel
        data={emptyWow({
          zonaIntelligence: {
            notizieRecenti: [],
            puntiDiForzaNascosti: ["tram"],
            criticitaEmergenti: [],
            tendenzaMercato: "",
          },
        })}
        status="success"
        photo={PHOTO}
        officialOmi={{ status: "success", data: PADOVA_D8 }}
      />,
    );
    expect(screen.getByText("Intelligence zona")).toBeInTheDocument();
    expect(screen.queryByText("Il tuo piano esclusiva")).not.toBeInTheDocument();
  });

  it("shows the amber preview banner when Core visual is missing and official OMI is not", () => {
    render(
      <WowPanel
        data={null}
        status="error"
        photo={PHOTO}
        officialOmi={{ status: "error", data: null }}
      />,
    );
    expect(screen.getByTestId("wow-partial-banner")).toBeInTheDocument();
    expect(screen.getByText(/Anteprima visiva non disponibile/i)).toBeInTheDocument();
  });

  it("keeps NON DISPONIBILE on score cards when Core omitted them — zero-mock", () => {
    render(
      <WowPanel
        data={emptyWow()}
        status="success"
        photo={PHOTO}
        officialOmi={{ status: "success", data: PADOVA_D8 }}
      />,
    );
    expect(screen.getByText("Vendibilità")).toBeInTheDocument();
    expect(screen.getByText("Opportunità")).toBeInTheDocument();
    expect(screen.getAllByText(/Non disponibile/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("70")).not.toBeInTheDocument();
    expect(screen.queryByText("80")).not.toBeInTheDocument();
  });
});
