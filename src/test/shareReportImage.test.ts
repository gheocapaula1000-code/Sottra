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
    expect(result).toContain("captureReportElement(reportRoot, { facadeSrc: state.photo })");
    expect(result).toContain("result-report-root");
    expect(result).not.toContain("sottraExportBridge");
    expect(helper).toContain("toJpeg");
    expect(helper).toContain("flattenShareJpeg");
    expect(helper).toContain("getImageData");
    expect(helper).not.toContain("quotazioneMinResidenziale: 1400");
    expect(helper).not.toContain("zonaOmi: \"D8\"");
  });
});

describe("capture stamps the live facade canvas (no blank clone in WhatsApp)", () => {
  it("collects pixels from the live canvas, with data-facade-src fallback", async () => {
    const { collectFacadeStamps } = await import("@/lib/shareReportImage");
    const root = document.createElement("div");
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 2000 }) as DOMRect;

    const canvas = document.createElement("canvas");
    canvas.setAttribute("data-testid", "building-identity-photo");
    canvas.setAttribute("data-facade-src", `data:image/jpeg;base64,${"F".repeat(120)}`);
    canvas.width = 360;
    canvas.height = 225;
    canvas.toDataURL = () => { throw new Error("tainted"); };
    canvas.getBoundingClientRect = () => ({ left: 12, top: 40, width: 366, height: 229 }) as DOMRect;
    root.appendChild(canvas);

    const stamps = collectFacadeStamps(root);
    expect(stamps).toHaveLength(1);
    expect(stamps[0].src).toContain("data:image/jpeg;base64,");
    expect(stamps[0].left).toBe(12);
    expect(stamps[0].width).toBe(366);
  });

  it("prefers the explicit real scan photo over data-facade-src and canvas pixels", async () => {
    const { collectFacadeStamps } = await import("@/lib/shareReportImage");
    const root = document.createElement("div");
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 900 }) as DOMRect;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("data-testid", "building-identity-photo");
    canvas.setAttribute("data-facade-src", "https://example.com/embedded.jpg");
    canvas.width = 10;
    canvas.height = 10;
    canvas.toDataURL = () => `data:image/jpeg;base64,${"B".repeat(120)}`;
    canvas.getBoundingClientRect = () => ({ left: 8, top: 20, width: 374, height: 230 }) as DOMRect;
    root.appendChild(canvas);

    const facadeSrc = `data:image/jpeg;base64,${"R".repeat(120)}`;
    const stamps = collectFacadeStamps(root, { facadeSrc });
    expect(stamps).toHaveLength(1);
    expect(stamps[0].src).toBe(facadeSrc);
  });

  it("does not let a black canvas win over the real photo", async () => {
    const { collectFacadeStamps } = await import("@/lib/shareReportImage");
    const root = document.createElement("div");
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 900 }) as DOMRect;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("data-testid", "building-identity-photo");
    canvas.width = 8;
    canvas.height = 8;
    canvas.getContext = vi.fn(() => ({
      getImageData: () => ({ data: new Uint8ClampedArray(8 * 8 * 4) }),
    })) as typeof canvas.getContext;
    canvas.toDataURL = () => `data:image/jpeg;base64,${"0".repeat(120)}`;
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 240 }) as DOMRect;
    root.appendChild(canvas);

    const facadeSrc = "blob:https://sottra.app/real-scan";
    const stamps = collectFacadeStamps(root, { facadeSrc });
    expect(stamps[0]?.src).toBe(facadeSrc);

    const withoutPhoto = collectFacadeStamps(root);
    expect(withoutPhoto).toHaveLength(0);
  });

  it("fails closed when there is no facade: no invented pixels", async () => {
    const { collectFacadeStamps } = await import("@/lib/shareReportImage");
    const root = document.createElement("div");
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 900 }) as DOMRect;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("data-testid", "building-identity-photo");
    canvas.width = 0;
    canvas.height = 0;
    root.appendChild(canvas);
    expect(collectFacadeStamps(root)).toHaveLength(0);
  });

  it("compositeFacadeStamps returns the original blob when there is nothing to stamp", async () => {
    const { compositeFacadeStamps } = await import("@/lib/shareReportImage");
    const blob = new Blob(["pixels"], { type: "image/jpeg" });
    expect(await compositeFacadeStamps(blob, [], 390)).toBe(blob);
  });

  it("capture keeps toJpeg + flattenShareJpeg and swaps the cloned canvas via onclone", () => {
    const helper = readFileSync("src/lib/shareReportImage.ts", "utf-8");
    expect(helper).toContain("toJpeg");
    expect(helper).toContain("flattenShareJpeg");
    expect(helper).toContain("onclone");
    expect(helper).toContain('canvas[data-testid="building-identity-photo"]');
    expect(helper).toContain("collectFacadeStamps");
    expect(helper).toContain("compositeFacadeStamps");
  });
});
