import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomepageWowDemo from "@/components/landing/HomepageWowDemo";
import {
  DEMO_OMI,
  DEMO_OMI_MAX,
  DEMO_OMI_MIN,
  DEMO_OMI_SEMESTRE_LABEL,
  DEMO_OMI_ZONA,
  OMI_MICROZONA_HONESTY,
} from "@/lib/homepageWowDemo";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: null, user: null, loading: false, signOut: vi.fn() }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    functions: { invoke: vi.fn() },
  },
}));

import Index from "@/pages/Index";

describe("homepage WOW demo is public", () => {
  it("renders without auth and shows D8 Est official OMI 1400–1850", () => {
    render(
      <MemoryRouter>
        <HomepageWowDemo />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("homepage-wow-demo")).toBeInTheDocument();
    expect(screen.getAllByText(/Esempio/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Dato ufficiale OMI/i)).toBeInTheDocument();
    expect(document.body.textContent).toContain(DEMO_OMI_ZONA);
    expect(screen.getByText(/Padova/)).toBeInTheDocument();
    expect(document.body.textContent).toContain(DEMO_OMI_SEMESTRE_LABEL);
    expect(document.body.textContent).toMatch(/1400|1\.400/);
    expect(document.body.textContent).toMatch(/1850|1\.850/);
    expect(document.body.textContent).not.toMatch(/1\.400\s*€\s*[–-]\s*2\.750|1400 € – 2750/);
    expect(screen.getAllByTestId("omi-honesty-line").some((el) => el.textContent === OMI_MICROZONA_HONESTY)).toBe(true);
    expect(OMI_MICROZONA_HONESTY).toMatch(/non è una media comunale/i);
    expect(screen.getByRole("button", { name: /prova gratis 3 giorni/i })).toBeInTheDocument();
    expect(screen.getByAltText("Edificio acquisito")).toBeInTheDocument();
    expect(screen.getByTestId("building-identity")).toBeInTheDocument();
    expect(screen.queryByTestId("civico-signals")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Palazzina/).length).toBeGreaterThanOrEqual(1);
    expect(document.body.textContent).toMatch(/Intonaco ocra/);
    expect(document.body.textContent).toMatch(/Persiane verdi/);
    expect(document.body.textContent).toMatch(/successione/i);
    expect(screen.getAllByText(/Questo edificio/i).length).toBeGreaterThanOrEqual(1);
    expect(document.body.textContent).not.toMatch(/3 appartamenti/i);
  });

  it("does not invent catasto, APE, reddito or Superbonus on the demo", () => {
    render(
      <MemoryRouter>
        <HomepageWowDemo />
      </MemoryRouter>,
    );
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/visura|particella|subalterno/i);
    expect(body).not.toMatch(/superbonus/i);
    expect(body).not.toMatch(/reddito medio/i);
    expect(body).not.toMatch(/classe energetica|APE\b/i);
    expect(body).toMatch(/catastale/i);
    expect(DEMO_OMI.quotazioneMinResidenziale).toBe(DEMO_OMI_MIN);
    expect(DEMO_OMI.quotazioneMaxResidenziale).toBe(DEMO_OMI_MAX);
    expect(DEMO_OMI_MIN).toBe(1400);
    expect(DEMO_OMI_MAX).toBe(1850);
  });

  it("Index mounts the public demo without a session (no /login redirect in the tree)", () => {
    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("homepage-wow-demo")).toBeInTheDocument();
    expect(screen.getAllByText(/prova gratis 3 giorni/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Accedi al tuo account/i)).not.toBeInTheDocument();
  });

  it("Index and App keep the homepage public — demo is not behind TrialProtectedRoute", () => {
    const index = readFileSync("src/pages/Index.tsx", "utf8");
    const app = readFileSync("src/App.tsx", "utf8");
    expect(index).toContain("HomepageWowDemo");
    expect(app).toMatch(/path="\/"\s+element=\{<Index \/>\}/);
    expect(app).not.toMatch(/path="\/"\s+element=\{<TrialProtectedRoute>/);
    expect(app).not.toMatch(/path="\/"\s+element=\{<ProtectedRoute>/);
  });
});
