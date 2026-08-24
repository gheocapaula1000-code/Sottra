/**
 * Share the finished /result report as a long image (WhatsApp / Mail / Files).
 * Captures the report root as it is on screen — never paints invented OMI,
 * catasto, APE, or scores. sottraExportBridge (KeyDraft JSON) is not this flow.
 */

import { toJpeg } from "html-to-image";

export interface ShareTitleInput {
  comuneLabel?: string | null;
  zonaOmi?: string | null;
}

export function buildShareTitle(input: ShareTitleInput): string {
  const comune = typeof input.comuneLabel === "string" ? input.comuneLabel.trim() : "";
  const zona = typeof input.zonaOmi === "string" ? input.zonaOmi.trim() : "";
  if (comune && zona) return `Sottra · ${comune} ${zona}`;
  if (comune) return `Sottra · ${comune}`;
  if (zona) return `Sottra · ${zona}`;
  return "Sottra";
}

export function filenameFromShareTitle(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "sottra"}.jpg`;
}

export async function waitForCaptureLayout(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 80);
      });
    });
  });
}

export type ReportCaptureFn = (root: HTMLElement) => Promise<Blob>;

/** Rasterize the live report root. Does not invent fields — pixels come from the DOM. */
export async function captureReportElement(root: HTMLElement): Promise<Blob> {
  const pixelRatio = typeof window !== "undefined"
    ? Math.min(2, window.devicePixelRatio || 1)
    : 1;
  const dataUrl = await toJpeg(root, {
    quality: 0.92,
    pixelRatio,
    backgroundColor: "#0a0a0f",
    cacheBust: true,
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return true;
      return !node.hasAttribute("data-capture-hide");
    },
  });
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  if (!blob || blob.size === 0) {
    throw new Error("capture empty");
  }
  return blob;
}

export async function buildReportShareFile(opts: {
  root: HTMLElement;
  title: string;
  capture: ReportCaptureFn;
}): Promise<File> {
  const blob = await opts.capture(opts.root);
  const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  return new File([blob], filenameFromShareTitle(opts.title), { type });
}

export function downloadBlobFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareOrDownloadReportFile(
  file: File,
  title: string,
): Promise<"shared" | "downloaded"> {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === "function") {
    const data: ShareData = { files: [file], title, text: title };
    const can = typeof nav.canShare !== "function" || nav.canShare(data);
    if (can) {
      await nav.share(data);
      return "shared";
    }
  }
  downloadBlobFile(file);
  return "downloaded";
}
