import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function src(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

const page = src("src/pages/TerminiCondizioni.tsx");

describe("Termini e Condizioni match the product Sottra sells", () => {
  it("titolare: Pi.Gi Service, Padova, P.IVA 05770260288, sottra.app only", () => {
    expect(page).toContain("companyNameLegal");
    expect(page).toContain("vatNumber");
    expect(page).toMatch(/PEC/);
    expect(page).toContain("APP_BRAND.domain");
    expect(page).not.toMatch(/sottra\.it/i);
  });

  it("oggetto: photo + GPS official-data dossier, no in-attivazione module promises", () => {
    expect(page).toMatch(/foto dell'edificio/i);
    expect(page).toMatch(/OMI/);
    expect(page).toMatch(/ISTAT/);
    expect(page).toMatch(/ISPRA/);
    expect(page).not.toMatch(/in fase di attivazione/i);
  });

  it("fail-closed: missing source is hidden, never invented visura/APE/vendita/successione/interior value", () => {
    expect(page).toMatch(/nasconde|omesso/i);
    expect(page).toMatch(/non inventiamo/i);
    expect(page).toMatch(/visur/i);
    expect(page).toMatch(/APE/);
    expect(page).toMatch(/succession/i);
    expect(page).not.toMatch(/elaborati o stimati in assenza di dati ufficiali completi/i);
  });

  it("licenza: Agente 1 telefono, Agenzia/Rete telefoni illimitati; blanket single-device rule is gone", () => {
    expect(page).toMatch(/Piano Agente: 1 telefono/);
    expect(page).toMatch(/Piano Agenzia: telefoni illimitati/);
    expect(page).toMatch(/Piano Rete: telefoni illimitati/);
    expect(page).not.toMatch(/vincolato a un singolo dispositivo per l'intera durata/i);
    expect(page).toMatch(/supporto@sottra\.app/);
  });

  it("WhatsApp JPEG to the saved agency number is intended use; credential sharing stays forbidden", () => {
    expect(page).toMatch(/uso previsto e consentito/i);
    expect(page).toMatch(/WhatsApp/);
    expect(page).toMatch(/JPEG/);
    expect(page).toMatch(/vietato condividere il login/i);
  });

  it("prezzi: regime forfettario, prices final, no +IVA, points to /prezzi, no annual plan", () => {
    expect(page).toContain("VAT_NOTICE");
    expect(page).not.toMatch(/\+\s?IVA/i);
    expect(page).not.toMatch(/IVA inclusa/i);
    expect(page).toContain("/prezzi");
    expect(page).toMatch(/non esiste un piano annuale/i);
    expect(page).not.toMatch(/\b(79|249|690)\s?€/);
  });

  it("keeps foro/legge and updates the revision date", () => {
    expect(page).toMatch(/Foro/);
    expect(page).toMatch(/settembre 2026/);
  });
});
