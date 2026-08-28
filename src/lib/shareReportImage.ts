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


async function flattenShareJpeg(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("flatten load"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    if (canvas.width < 1 || canvas.height < 1) return blob;
    const settings = { colorSpace: "srgb", willReadFrequently: true } as CanvasRenderingContext2DSettings;
    const ctx = canvas.getContext("2d", settings) ?? canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.drawImage(img, 0, 0);
    ctx.putImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), 0, 0);
    const out = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });
    return out && out.size > 0 ? out : blob;
  } catch {
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type ReportCaptureFn = (root: HTMLElement) => Promise<Blob>;

export interface FacadeStamp {
  /** Real scan photo, data-facade-src, or validated live-canvas fallback. */
  src: string;
  /** CSS-px box relative to the report root. */
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ReportCaptureOptions {
  facadeSrc?: string | null;
}

function isAllowedFacadeSrc(value?: string | null): value is string {
  if (typeof value !== "string") return false;
  const src = value.trim();
  return /^data:image\//i.test(src) || /^blob:/i.test(src) || /^https?:\/\//i.test(src);
}

function canvasHasVisiblePixels(canvas: HTMLCanvasElement): boolean {
  if (canvas.width < 1 || canvas.height < 1) return false;
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const pixelCount = pixels.length / 4;
    const stride = Math.max(1, Math.floor(pixelCount / 1024));
    let sampled = 0;
    let nearlyBlackOrTransparent = 0;
    for (let pixel = 0; pixel < pixelCount; pixel += stride) {
      const i = pixel * 4;
      sampled += 1;
      if (pixels[i + 3] < 16 || (pixels[i] < 16 && pixels[i + 1] < 16 && pixels[i + 2] < 16)) {
        nearlyBlackOrTransparent += 1;
      }
    }
    return sampled > 0 && nearlyBlackOrTransparent / sampled < 0.95;
  } catch {
    return false;
  }
}

/**
 * html-to-image clones the DOM and a cloned <canvas> can come back blank
 * (tainted / not re-rasterized), which is why WhatsApp got a black house.
 * Read the pixels from the LIVE canvas before capture. Fail-closed: no pixels,
 * no stamp — we never invent a facade.
 */
export function collectFacadeStamps(
  root: HTMLElement,
  options: ReportCaptureOptions = {},
): FacadeStamp[] {
  const nodes = Array.from(
    root.querySelectorAll<HTMLCanvasElement>('canvas[data-testid="building-identity-photo"]'),
  );
  const rootRect = root.getBoundingClientRect();
  const stamps: FacadeStamp[] = [];
  for (const canvas of nodes) {
    // The original scan is authoritative. The canvas supplies only its CSS box.
    let src = isAllowedFacadeSrc(options.facadeSrc) ? options.facadeSrc.trim() : "";
    const embeddedSrc = canvas.getAttribute("data-facade-src");
    if (!src && isAllowedFacadeSrc(embeddedSrc)) src = embeddedSrc.trim();
    if (!src && canvasHasVisiblePixels(canvas) && typeof canvas.toDataURL === "function") {
      try {
        const url = canvas.toDataURL("image/jpeg", 0.92);
        if (isAllowedFacadeSrc(url) && url.length > 64) src = url;
      } catch {
        src = "";
      }
    }
    if (!src) continue; // fail-closed
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    stamps.push({
      src,
      left: rect.left - rootRect.left,
      top: rect.top - rootRect.top,
      width: rect.width,
      height: rect.height,
    });
  }
  return stamps;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("facade load"));
    el.src = src;
  });
}

/** Paint the live facade pixels back over the captured JPEG at the canvas box. */
export async function compositeFacadeStamps(
  blob: Blob,
  stamps: FacadeStamp[],
  rootWidthCss: number,
): Promise<Blob> {
  if (stamps.length === 0 || rootWidthCss < 1) return blob;
  const url = URL.createObjectURL(blob);
  try {
    const base = await loadImage(url);
    const bw = base.naturalWidth || base.width;
    const bh = base.naturalHeight || base.height;
    if (bw < 1 || bh < 1) return blob;
    const scale = bw / rootWidthCss;
    const canvas = document.createElement("canvas");
    canvas.width = bw;
    canvas.height = bh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.drawImage(base, 0, 0);
    for (const stamp of stamps) {
      try {
        const img = await loadImage(stamp.src);
        const nw = img.naturalWidth || img.width;
        const nh = img.naturalHeight || img.height;
        if (nw < 1 || nh < 1) continue;
        const dx = stamp.left * scale;
        const dy = stamp.top * scale;
        const outW = stamp.width * scale;
        const outH = stamp.height * scale;
        // Same cover-crop math as FacadeCanvas (object-fit: cover, centered).
        const coverScale = Math.max(outW / nw, outH / nh);
        const dw = nw * coverScale;
        const dh = nh * coverScale;
        ctx.save();
        ctx.beginPath();
        ctx.rect(dx, dy, outW, outH);
        ctx.clip();
        ctx.drawImage(img, dx + (outW - dw) / 2, dy + (outH - dh) / 2, dw, dh);
        ctx.restore();
      } catch {
        /* fail-closed: keep whatever the capture produced */
      }
    }

    const out = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });
    return out && out.size > 0 ? out : blob;
  } catch {
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Rasterize the live report root. Does not invent fields — pixels come from the DOM. */
export async function captureReportElement(
  root: HTMLElement,
  options: ReportCaptureOptions = {},
): Promise<Blob> {
  const pixelRatio = typeof window !== "undefined"
    ? Math.min(2, window.devicePixelRatio || 1)
    : 1;
  const stamps = collectFacadeStamps(root, options);
  const stampBySrc = new Map(stamps.map((s) => [s.src, s]));
  const dataUrl = await toJpeg(root, {
    quality: 0.92,
    pixelRatio,
    backgroundColor: "#0a0a0f",
    cacheBust: true,
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return true;
      return !node.hasAttribute("data-capture-hide");
    },
    // Replace the blank cloned canvas with the live facade pixels.
    onclone: (doc: Document) => {
      const clones = Array.from(
        doc.querySelectorAll<HTMLCanvasElement>('canvas[data-testid="building-identity-photo"]'),
      );
      clones.forEach((clone, i) => {
        const stamp = stamps[i] ?? stampBySrc.get(clone.getAttribute("data-facade-src") ?? "");
        if (!stamp) return; // fail-closed
        const img = doc.createElement("img");
        img.src = stamp.src;
        img.setAttribute("data-testid", "building-identity-photo");
        img.setAttribute("alt", "Edificio acquisito");
        img.className = clone.className;
        img.style.width = "100%";
        img.style.display = "block";
        img.style.objectFit = "cover";
        clone.replaceWith(img);
      });
    },
  } as Parameters<typeof toJpeg>[1]);
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  if (!blob || blob.size === 0) {
    throw new Error("capture empty");
  }
  const rootWidthCss = root.getBoundingClientRect().width || root.offsetWidth || 0;
  const stamped = await compositeFacadeStamps(blob, stamps, rootWidthCss);
  return flattenShareJpeg(stamped);
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
