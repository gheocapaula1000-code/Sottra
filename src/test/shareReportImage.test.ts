import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import {
  buildReportShareFile,
  buildShareTitle,
  filenameFromShareTitle,
  shareOrDownloadReportFile,
} from "@/lib/shareReportImage";

describe("buildShareTitle — real OMI labels only", () => {
  it("formats Sottra · Padova D8 from official fields", () => {
    expect(buildShareTitle({ comuneLabel: "Padova", zonaOmi: "D8" })).toBe("Sottra · Padova D8");
  });

  it("does not invent Padova or D8 when labels are missing", () => {
    expect(buildShareTitle({})).toBe("Sottra");
    expect(buildShareTitle({ comuneLabel: null, zonaOmi: null })).toBe("Sottra");
    expect(buildShareTitle({ comuneLabel: "  ", zonaOmi: "" })).toBe("Sottra");
    expect(buildShareTitle({})).not.toContain("D8");
    expect(buildShareTitle({})).not.toContain("Padova");
  });

  it("uses only the labels that exist", () => {
    expect(buildShareTitle({ comuneLabel: "Padova" })).toBe("Sottra · Padova");
    expect(buildShareTitle({ zonaOmi: "D8" })).toBe("Sottra · D8");
  });
});

describe("buildReportShareFile — capture the report root", () => {
  it("builds a file from the report root and does not invent fields", async () => {
    const root = document.createElement("div");
    root.setAttribute("data-testid", "result-report-root");
    root.textContent = "Padova D8 1400–2750";
    const blob = new Blob(["real-pixels"], { type: "image/jpeg" });
    const capture = vi.fn(async (el: HTMLElement) => {
      expect(el).toBe(root);
      expect(el.textContent).toContain("1400");
      return blob;
    });

    const title = buildShareTitle({ comuneLabel: "Padova", zonaOmi: "D8" });
    const file = await buildReportShareFile({ root, title, capture });

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(root);
    expect(file.name).toBe("sottra-padova-d8.jpg");
    expect(file.type).toBe("image/jpeg");
    expect(file.size).toBeGreaterThan(0);
    expect(filenameFromShareTitle("Sottra")).toBe("sottra.jpg");
    expect(filenameFromShareTitle("Sottra")).not.toContain("d8");
  });
});

describe("shareOrDownloadReportFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shares a JPEG file via navigator.share when canShare accepts files", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { share, canShare });
    const file = new File([new Uint8Array([1, 2, 3])], "sottra-padova-d8.jpg", { type: "image/jpeg" });

    const outcome = await shareOrDownloadReportFile(file, "Sottra · Padova D8");

    expect(outcome).toBe("shared");
    expect(canShare).toHaveBeenCalled();
    expect(share).toHaveBeenCalledWith({
      files: [file],
      title: "Sottra · Padova D8",
      text: "Sottra · Padova D8",
    });
  });
});

describe("share wiring — not KeyDraft JSON", () => {
  it("Result uses the image helper, not sottraExportBridge", () => {
    const result = readFileSync("src/pages/Result.tsx", "utf-8");
    const helper = readFileSync("src/lib/shareReportImage.ts", "utf-8");
    expect(result).toContain("buildReportShareFile");
    expect(result).toContain("captureReportElement");
    expect(result).toContain("result-report-root");
    expect(result).not.toContain("sottraExportBridge");
    expect(helper).toContain("toJpeg");
    expect(helper).not.toContain("quotazioneMinResidenziale: 1400");
    expect(helper).not.toContain("zonaOmi: \"D8\"");
  });
});
