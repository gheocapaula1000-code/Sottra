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

/**
 * Keep the capture canvas under iOS/PWA memory limits (~16M pixels).
 * Flatten + facade composite allocate extra canvases, so stay below that.
 */
export function shareCapturePixelRatio(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio = 1,
): number {
  const w = Math.max(1, cssWidth);
  const h = Math.max(1, cssHeight);
  const maxPixels = 12_000_000;
  const dpr = Math.min(2, Math.max(1, devicePixelRatio || 1));
  if (w * h * dpr * dpr <= maxPixels) return dpr;
  return Math.max(0.5, Math.min(dpr, Math.sqrt(maxPixels / (w * h))));
}

/** Rasterize the live report root. Does not invent fields — pixels come from the DOM. */
export async function captureReportElement(
  root: HTMLElement,
  options: ReportCaptureOptions = {},
): Promise<Blob> {
  const cssWidth = Math.max(
    root.scrollWidth || 0,
    root.offsetWidth || 0,
    root.getBoundingClientRect().width || 0,
  );
  const cssHeight = Math.max(root.scrollHeight || 0, root.offsetHeight || 0);
  const pixelRatio = shareCapturePixelRatio(
    cssWidth,
    cssHeight,
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  );
  const stamps = collectFacadeStamps(root, options);
  const stampBySrc = new Map(stamps.map((s) => [s.src, s]));
  const dataUrl = await toJpeg(root, {
    quality: 0.92,
    pixelRatio,
    width: cssWidth || undefined,
    height: cssHeight || undefined,
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
  const rootWidthCss = cssWidth || root.getBoundingClientRect().width || root.offsetWidth || 0;
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

export const REPORT_CAPTURE_TIMEOUT_MS = 8000;

export type ShareReportOutcome = "shared" | "downloaded" | "copied" | "whatsapp" | "cancelled";

export interface ShareReportPayload {
  file?: File | null;
  title: string;
  text: string;
  /** App origin only — never presented as a permalink to this scan. */
  url?: string | null;
  whatsappUrl?: string | null;
}

type NavigatorWithShare = Navigator & {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
};

export function isShareCancellation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: string; message?: string };
  if (e.name === "AbortError") return true;
  const msg = (e.message ?? "").toLowerCase();
  return msg.includes("share canceled") || msg.includes("share cancelled") || msg.includes("abort");
}

function canShareData(nav: NavigatorWithShare, data: ShareData): boolean {
  try {
    if (typeof nav.canShare !== "function") return true;
    return nav.canShare(data);
  } catch {
    return false;
  }
}

async function tryNavigatorShare(data: ShareData): Promise<"shared" | "cancelled" | "failed"> {
  const nav = navigator as NavigatorWithShare;
  if (typeof nav.share !== "function") return "failed";
  if (!canShareData(nav, data)) return "failed";
  try {
    await nav.share(data);
    return "shared";
  } catch (error) {
    if (isShareCancellation(error)) return "cancelled";
    return "failed";
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = text.trim();
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through to execCommand */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Prefer window.open; fall back to a synthetic <a> so iOS PWA can still leave the gesture. */
export function openShareFallbackUrl(url: string): boolean {
  if (!url) return false;
  try {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) return true;
  } catch {
    /* popup blocked — try a click */
  }
  try {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
}

/**
 * Native share when the browser allows it (image file, else text+url).
 * Fallbacks: download JPEG, copy caption, open WhatsApp. Never a silent no-op.
 */
export async function shareReportPayload(payload: ShareReportPayload): Promise<ShareReportOutcome> {
  const title = payload.title.trim() || "Sottra";
  const text = payload.text.trim() || title;
  const file = payload.file && payload.file.size > 0 ? payload.file : null;
  const url = typeof payload.url === "string" && /^https?:\/\//i.test(payload.url) ? payload.url : null;

  if (file) {
    const withFiles: ShareData = { files: [file], title, text };
    const fileShare = await tryNavigatorShare(withFiles);
    if (fileShare === "shared") return "shared";
    if (fileShare === "cancelled") return "cancelled";
  }

  const textData: ShareData = { title, text };
  if (url) textData.url = url;
  const textShare = await tryNavigatorShare(textData);
  if (textShare === "shared") return "shared";
  if (textShare === "cancelled") return "cancelled";

  if (file) downloadBlobFile(file);
  const copied = await copyTextToClipboard(text);
  if (payload.whatsappUrl && openShareFallbackUrl(payload.whatsappUrl)) {
    return "whatsapp";
  }
  if (file) return "downloaded";
  if (copied) return "copied";
  throw new Error("share unavailable");
}

export async function tryBuildReportShareFile(opts: {
  root: HTMLElement;
  title: string;
  capture: ReportCaptureFn;
  timeoutMs?: number;
}): Promise<File | null> {
  const timeoutMs = opts.timeoutMs ?? REPORT_CAPTURE_TIMEOUT_MS;
  try {
    return await Promise.race([
      buildReportShareFile(opts),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("capture timeout")), timeoutMs);
      }),
    ]);
  } catch {
    return null;
  }
}

export function shareOutcomeToast(
  outcome: ShareReportOutcome,
  fileName?: string | null,
): { title: string; description: string } | null {
  switch (outcome) {
    case "shared":
      return {
        title: "Report condiviso",
        description: "Il report è stato inviato all'app scelta.",
      };
    case "downloaded":
      return {
        title: "Immagine salvata",
        description: fileName
          ? `Apri File o WhatsApp e allega ${fileName}.`
          : "Apri File o WhatsApp e allega l'immagine del report.",
      };
    case "copied":
      return {
        title: "Testo copiato",
        description: "Incollalo in WhatsApp o in un messaggio.",
      };
    case "whatsapp":
      return {
        title: "WhatsApp aperto",
        description: fileName
          ? `Allega ${fileName} nella chat se l'immagine è stata salvata.`
          : "Completa l'invio dalla chat WhatsApp.",
      };
    case "cancelled":
      return null;
  }
}

export async function shareOrDownloadReportFile(
  file: File,
  title: string,
  text = title,
): Promise<ShareReportOutcome> {
  return shareReportPayload({ file, title, text });
}
