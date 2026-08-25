/**
 * Client-side image normalization utility.
 * Resizes and compresses images before sending to the backend.
 */

const MAX_LONG_SIDE = 1280;
const INITIAL_QUALITY = 0.72;
const MAX_SIZE_BYTES = 350_000; // ~350 KB
const MIN_QUALITY = 0.3;
const QUALITY_STEP = 0.08;

const isDev = import.meta.env.DEV;

function devLog(...args: unknown[]) {
  if (isDev) console.log("[IMG]", ...args);
}

/**
 * Load an image from a data URL and return an HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossibile caricare l'immagine"));
    img.src = src;
  });
}

/**
 * Estimate byte size of a base64 data URL.
 */
function dataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1];
  if (!base64) return 0;
  return Math.ceil(base64.length * 0.75);
}

/**
 * Normalize an image: resize to max 1280px long side, compress JPEG,
 * progressively reduce quality to stay under ~350KB.
 *
 * Canvas toDataURL strips EXIF — read GPS with extractExifGps / extractExifGpsFromFile
 * from the original File or bytes before calling this.
 *
 * @returns Compressed JPEG data URL
 * @throws Error if image cannot be processed
 */
export async function normalizeImage(dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:image")) {
    throw new Error("Input non valido: non è un'immagine");
  }

  const originalSize = dataUrlByteSize(dataUrl);
  devLog(`Original size: ${(originalSize / 1024).toFixed(0)} KB`);

  const img = await loadImage(dataUrl);
  const { width: ow, height: oh } = img;

  // Calculate target dimensions
  let w = ow;
  let h = oh;
  const longSide = Math.max(w, h);

  if (longSide > MAX_LONG_SIDE) {
    const scale = MAX_LONG_SIDE / longSide;
    w = Math.round(ow * scale);
    h = Math.round(oh * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non supportato");

  ctx.drawImage(img, 0, 0, w, h);

  // Progressive quality reduction
  let quality = INITIAL_QUALITY;
  let result = canvas.toDataURL("image/jpeg", quality);
  let size = dataUrlByteSize(result);

  while (size > MAX_SIZE_BYTES && quality > MIN_QUALITY) {
    quality -= QUALITY_STEP;
    result = canvas.toDataURL("image/jpeg", quality);
    size = dataUrlByteSize(result);
  }

  // If still too large, further reduce dimensions
  if (size > MAX_SIZE_BYTES) {
    const extraScale = 0.7;
    canvas.width = Math.round(w * extraScale);
    canvas.height = Math.round(h * extraScale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    result = canvas.toDataURL("image/jpeg", MIN_QUALITY);
    size = dataUrlByteSize(result);
  }

  devLog(`Normalized: ${w}x${h} → ${canvas.width}x${canvas.height}, quality=${quality.toFixed(2)}, size=${(size / 1024).toFixed(0)} KB`);

  return result;
}

/**
 * Decode any camera File (JPEG, PNG, and iOS HEIC/HEIF) into a real JPEG data URL.
 * Safari decodes HEIC natively through an <img> pointed at a blob URL, so the
 * canvas re-encode gives us a format the rest of the pipeline can handle.
 * EXIF is stripped by the canvas — read GPS from the File before calling this.
 */
export async function fileToJpegDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    if (!canvas.width || !canvas.height) throw new Error("Immagine senza dimensioni");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas non supportato");
    ctx.drawImage(img, 0, 0);
    const out = canvas.toDataURL("image/jpeg", 0.9);
    if (!isValidImageDataUrl(out)) throw new Error("Conversione JPEG non riuscita");
    devLog(`file → jpeg: ${canvas.width}x${canvas.height}, ${(dataUrlByteSize(out) / 1024).toFixed(0)} KB`);
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Validate that a string is a valid image data URL.
 */
export function isValidImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/") && value.length > 100;
}

/**
 * Validate GPS coordinates are real (not null, not 0,0).
 */
export function isValidGps(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!isFinite(lat) || !isFinite(lng)) return false;
  // Reject 0,0 — middle of the ocean
  if (lat === 0 && lng === 0) return false;
  // Basic range check
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
}
