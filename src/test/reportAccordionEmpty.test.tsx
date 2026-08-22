import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ReportAccordionItem,
  isEmptyAccordionChildren,
} from "@/components/report/ReportAccordion";

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

describe("ReportAccordionItem empty hide", () => {
  it("omits the tendina when the child is null", () => {
    const { container } = render(
      <ReportAccordionItem id="empty" title="Sezione vuota">
        {null}
      </ReportAccordionItem>,
    );
    expect(screen.queryByText("Sezione vuota")).not.toBeInTheDocument();
    expect(container.querySelector("button")).toBeNull();
  });

  it("omits the tendina when the child is an empty fragment", () => {
    render(
      <ReportAccordionItem id="empty-frag" title="Sezione vuota">
        <>{null}</>
      </ReportAccordionItem>,
    );
    expect(screen.queryByRole("button", { name: /sezione vuota/i })).not.toBeInTheDocument();
  });

  it("omits the tendina when the child component renders nothing", () => {
    render(
      <ReportAccordionItem id="empty-card" title="Sezione vuota">
        <EmptyCard />
      </ReportAccordionItem>,
    );
    expect(screen.queryByRole("button", { name: /sezione vuota/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Sezione vuota")).not.toBeInTheDocument();
  });

  it("still shows a tendina that has real content", () => {
    render(
      <ReportAccordionItem id="omi" title="Quotazioni OMI" defaultOpen>
        <p>Microzona B1</p>
      </ReportAccordionItem>,
    );
    expect(screen.getByRole("button", { name: /quotazioni omi/i })).toBeInTheDocument();
    expect(screen.getByText("Microzona B1")).toBeInTheDocument();
  });

  it("keeps the tendina visible while a loading skeleton is shown", () => {
    render(
      <ReportAccordionItem id="pricing" title="Prezzi di Mercato" defaultOpen>
        <div className="animate-pulse h-16" />
      </ReportAccordionItem>,
    );
    expect(screen.getByRole("button", { name: /prezzi di mercato/i })).toBeInTheDocument();
  });
});
