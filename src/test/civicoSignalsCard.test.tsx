import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CivicoSignalsCard } from "@/components/report/CivicoSignalsCard";

describe("CivicoSignalsCard is photo-first and fail-closed", () => {
  it("on esempio shows facade facts and does not invent listings or a civico", () => {
    render(
      <CivicoSignalsCard
        esempio
        buildingType="Palazzina"
        materiale="Intonaco ocra"
        strengths={["Persiane verdi", "Più piani visibili"]}
      />,
    );
    expect(screen.getByTestId("civico-signals")).toBeInTheDocument();
    expect(screen.getByText("Palazzina")).toBeInTheDocument();
    expect(screen.getByText("Intonaco ocra")).toBeInTheDocument();
    expect(screen.getByText("Persiane verdi")).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/in vendita/i);
    expect(document.body.textContent).toMatch(/stabile/i);
    expect(document.body.textContent).toMatch(/successione/i);
    expect(document.body.textContent).not.toMatch(/Via San Francesco/i);
    expect(document.body.textContent).not.toMatch(/3 appartamenti/i);
    expect(document.body.textContent).not.toMatch(/Non disponibile per questo civico/);
  });

  it("hides itself when a real scan has no photo facts and no address yet", () => {
    const { container } = render(<CivicoSignalsCard />);
    expect(container.querySelector("[data-testid=civico-signals]")).toBeNull();
  });

  it("on a real scan shows via/civico from GPS and piano only if the photo gave it", () => {
    render(
      <CivicoSignalsCard
        viaCivico="Via Forcellini 18, Padova"
        buildingType="Condominio residenziale"
        visibleFloors={5}
        pianoStimato="3"
      />,
    );
    expect(screen.getByText("Via Forcellini 18, Padova")).toBeInTheDocument();
    expect(screen.getByText("5 piani visibili")).toBeInTheDocument();
    expect(screen.getByText(/Piano letto dalla foto: 3/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Non disponibile per questo civico/);
  });
});
