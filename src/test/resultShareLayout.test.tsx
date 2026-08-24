import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { render, screen } from "@testing-library/react";
import {
  PublishableAccordionItem,
  ReportCaptureOpenContext,
} from "@/components/report/ReportAccordion";

describe("Result scroll + chrome", () => {
  it("Result scroll container is overflow-y auto (not locked)", () => {
    const result = readFileSync("src/pages/Result.tsx", "utf-8");
    const ptr = readFileSync("src/components/PullToRefresh.tsx", "utf-8");
    expect(ptr).toContain("overflow-y-auto");
    expect(ptr).toContain('WebkitOverflowScrolling: "touch"');
    expect(result).toContain('data-testid="result-scroll"');
    expect(result).toContain("overflow-y-auto");
    expect(result).toContain("fixed inset-0");
    expect(result).not.toMatch(/<div className="flex h-dvh flex-col overflow-hidden/);
  });

  it("only one Condividi in the live chrome", () => {
    const result = readFileSync("src/pages/Result.tsx", "utf-8");
    const wow = readFileSync("src/components/report/WowPanel.tsx", "utf-8");
    expect(wow).not.toContain("Condividi");
    expect(wow).not.toContain("Nuova scansione");
    expect(result).toContain("result-action-bar");
    expect(result).toContain("Condividi");
    expect(result.match(/Condividi/g)?.length).toBe(1);
    expect(result.match(/Nuova scansione/g)?.length).toBe(1);
    expect(result).not.toContain("fixed bottom-16");
    expect(result).not.toContain("Condividi Report");
    expect(wow).toContain("Intelligence zona");
    expect(wow).toContain("piano esclusiva");
  });
});

describe("capture expands publishable tendine only", () => {
  it("opens a publishable tendina when capture context is true", () => {
    render(
      <ReportCaptureOpenContext.Provider value={true}>
        <PublishableAccordionItem id="omi" title="Quotazioni OMI" loading={false} publishable>
          <p>1400 – 2750 €/m²</p>
        </PublishableAccordionItem>
        <PublishableAccordionItem id="empty" title="Catasto" loading={false} publishable={false}>
          <p>invented</p>
        </PublishableAccordionItem>
      </ReportCaptureOpenContext.Provider>,
    );

    expect(screen.getByText("Quotazioni OMI")).toBeInTheDocument();
    expect(screen.getByText("1400 – 2750 €/m²")).toBeInTheDocument();
    expect(screen.queryByText("Catasto")).not.toBeInTheDocument();
    expect(screen.queryByText("invented")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /quotazioni omi/i })).toHaveAttribute("aria-expanded", "true");
  });
});
