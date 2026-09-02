import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  SHARED_SEAT_PRICE_IDS,
  SINGLE_SEAT_PRICE_IDS,
  isSharedSeatPriceId,
  inheritsAgencySeat,
  sharedCapUserIds,
} from "../../supabase/functions/_shared/agencySeats";
import { PLANS } from "@/lib/plans";

const AGENZIA = PLANS.agenzia.price_id;
const RETE = PLANS.rete.price_id;
const AGENTE = PLANS.agente.price_id;

describe("Agency seats — price mapping mirrors plans.ts", () => {
  it("Agenzia e Rete sono posti condivisi (telefoni illimitati)", () => {
    expect(SHARED_SEAT_PRICE_IDS).toContain(AGENZIA);
    expect(SHARED_SEAT_PRICE_IDS).toContain(RETE);
  });

  it("Agente è posto singolo", () => {
    expect(SINGLE_SEAT_PRICE_IDS).toEqual([AGENTE]);
    expect(isSharedSeatPriceId(AGENTE)).toBe(false);
  });

  it("price id sconosciuto non è condiviso (fail-closed)", () => {
    expect(isSharedSeatPriceId("price_fake")).toBe(false);
    expect(isSharedSeatPriceId(null)).toBe(false);
    expect(isSharedSeatPriceId("")).toBe(false);
  });
});

describe("Agency seats — inheritance rules", () => {
  it("agente extra su Agenzia attiva passa l'entitlement", () => {
    expect(inheritsAgencySeat({ owner_user_id: "owner-1", price_id: AGENZIA, status: "active" })).toBe(true);
  });

  it("agente extra su Rete in trial passa l'entitlement", () => {
    expect(inheritsAgencySeat({ owner_user_id: "owner-1", price_id: RETE, status: "trialing" })).toBe(true);
  });

  it("piano Agente NON è ereditabile da un secondo telefono", () => {
    expect(inheritsAgencySeat({ owner_user_id: "owner-1", price_id: AGENTE, status: "active" })).toBe(false);
  });

  it("abbonamento agenzia non attivo non dà accesso", () => {
    for (const status of ["canceled", "past_due", "incomplete", "unpaid", ""]) {
      expect(inheritsAgencySeat({ owner_user_id: "o", price_id: AGENZIA, status })).toBe(false);
    }
  });

  it("nessuna appartenenza / nessun abbonamento = fail-closed", () => {
    expect(inheritsAgencySeat(null)).toBe(false);
    expect(inheritsAgencySeat(undefined)).toBe(false);
    expect(inheritsAgencySeat({})).toBe(false);
  });
});

describe("Agency seats — shared monthly cap", () => {
  it("include sempre l'utente stesso", () => {
    expect(sharedCapUserIds("me", [])).toEqual(["me"]);
    expect(sharedCapUserIds("me", null)).toEqual(["me"]);
  });

  it("unisce i colleghi della stessa agenzia senza duplicati", () => {
    const ids = sharedCapUserIds("me", ["owner", "me", "peer", ""]);
    expect(new Set(ids)).toEqual(new Set(["me", "owner", "peer"]));
  });
});

describe("Agency seats — server wiring", () => {
  const entitlement = readFileSync("supabase/functions/_shared/entitlement.ts", "utf-8");
  const recordScan = readFileSync("supabase/functions/record-scan/index.ts", "utf-8");

  it("checkEntitlement consulta l'abbonamento condiviso dell'agenzia", () => {
    expect(entitlement).toContain("agency_shared_subscription");
    expect(entitlement).toContain("inheritsAgencySeat");
    expect(entitlement).toContain("agency_seat");
  });

  it("record-scan conta il tetto su tutti gli agenti dell'agenzia", () => {
    expect(recordScan).toContain("agency_scan_user_ids");
    expect(recordScan).toContain("sharedCapUserIds");
    expect(recordScan).toContain('.in("user_id", capUserIds)');
  });

  it("non introduce sottra.it né IVA aggiunta", () => {
    for (const src of [entitlement, recordScan]) {
      expect(src).not.toMatch(/sottra\.it/i);
      expect(src).not.toMatch(/\+\s*IVA/i);
    }
  });
});
