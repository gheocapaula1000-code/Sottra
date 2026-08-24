/**
 * Device-side scan history. IndexedDB is the source of truth (snapshots +
 * thumbnails are too large for a reliable localStorage-only list).
 * localStorage is a best-effort backup so jsdom / private mode still reload.
 * Never invents scans, OMI codes, or photos.
 */

import { isValidImageDataUrl } from "@/lib/imageUtils";
import { hasRenderableOfficialOmi } from "@/lib/officialOmiFromCore";
import type { OmiZoneData, ScanResult, SectionState } from "@/types";

export const HISTORY_DB_NAME = "sottra-scan-history";
export const HISTORY_STORE = "list";
export const HISTORY_KEY = "scans";
export const HISTORY_LS_KEY = "sottra_scan_history";
export const MAX_HISTORY_SCANS = 20;

export interface SavedScan {
  id: string;
  /** Short comune + fascia label (e.g. "Padova D8") — not a full street address */
  locality: string;
  date: string;
  moodScore: number | null;
  convergenzaTerritoriale: {
    score: number | null;
    band: string | null;
  } | null;
  lat: number | null;
  lng: number | null;
  /** Compressed JPEG thumbnail — or the real shot if compress failed */
  photoThumbnail: string | null;
  resultSnapshot: Partial<ScanResult> | null;
  primaryGeoLevel: string | null;
  restorable: boolean;
  zonaOmi: string | null;
  comune: string | null;
  manualAddress?: string;
}

export type HistoryDraft = Omit<SavedScan, "id" | "date"> & { id?: string; date?: string };

let memoryList: SavedScan[] | null = null;

export function formatHistoryLocality(
  comune: string | null | undefined,
  zonaOmi: string | null | undefined,
): string {
  const c = typeof comune === "string" ? comune.trim() : "";
  const z = typeof zonaOmi === "string" ? zonaOmi.trim() : "";
  if (c && z) return `${c} ${z}`;
  if (c) return c;
  if (z) return z;
  return "Posizione non disponibile";
}

export function isHistoryRestorable(scan: {
  photoThumbnail: string | null;
  resultSnapshot: Partial<ScanResult> | null;
  lat: number | null;
  lng: number | null;
  manualAddress?: string;
}): boolean {
  const hasSnap = !!(scan.resultSnapshot && Object.keys(scan.resultSnapshot).length > 0);
  const hasPhoto = typeof scan.photoThumbnail === "string" && scan.photoThumbnail.length > 0;
  const hasCoords = typeof scan.lat === "number" && typeof scan.lng === "number"
    && Number.isFinite(scan.lat) && Number.isFinite(scan.lng);
  const hasAddr = typeof scan.manualAddress === "string" && scan.manualAddress.trim().length >= 3;
  return hasSnap && hasPhoto && (hasCoords || hasAddr);
}

export function canReopenHistoryScan(scan: SavedScan): boolean {
  return isHistoryRestorable(scan);
}

export function shouldRecordFinishedScan(opts: {
  scanning: boolean;
  hasPhoto: boolean;
  officialOmi: OmiZoneData | null;
  identifyOk: boolean;
}): boolean {
  if (opts.scanning || !opts.hasPhoto) return false;
  return hasRenderableOfficialOmi(opts.officialOmi) || opts.identifyOk;
}

export function serializeResult(result: Partial<ScanResult>): Partial<ScanResult> | null {
  try {
    const serializable: Record<string, SectionState> = {};
    for (const [key, section] of Object.entries(result)) {
      const s = section as SectionState;
      if (s && s.status === "success" && s.data != null) {
        serializable[key] = { status: "success", data: s.data, message: null };
      }
    }
    JSON.stringify(serializable);
    return serializable as Partial<ScanResult>;
  } catch {
    return null;
  }
}

/**
 * Compress a photo to a small JPEG. If canvas decode fails and the input is
 * already a modest data URL, keep those real bytes — never invent a building.
 */
export function compressToThumbnail(photoDataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const fallback = () => {
      finish(isValidImageDataUrl(photoDataUrl) && photoDataUrl.length < 500_000 ? photoDataUrl : null);
    };
    try {
      const img = new Image();
      const timer = setTimeout(fallback, 400);
      img.onload = () => {
        clearTimeout(timer);
        const MAX_DIM = 320;
        let w = img.width;
        let h = img.height;
        if (!w || !h) {
          fallback();
          return;
        }
        if (w > h) {
          h = Math.round(h * (MAX_DIM / w));
          w = MAX_DIM;
        } else {
          w = Math.round(w * (MAX_DIM / h));
          h = MAX_DIM;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        finish(canvas.toDataURL("image/jpeg", 0.5));
      };
      img.onerror = () => {
        clearTimeout(timer);
        fallback();
      };
      img.src = photoDataUrl;
    } catch {
      fallback();
    }
  });
}

export function buildHistoryDraft(input: {
  id?: string;
  photoThumbnail: string | null;
  resultSnapshot: Partial<ScanResult> | null;
  officialOmi: OmiZoneData | null;
  lat: number | null;
  lng: number | null;
  manualAddress?: string;
  identifyAddress?: string | null;
  primaryGeoLevel: string | null;
  convergenzaTerritoriale: SavedScan["convergenzaTerritoriale"];
}): HistoryDraft {
  const comune = input.officialOmi?.comuneLabel?.trim()
    || inferComuneFromIdentify(input.identifyAddress)
    || null;
  const zonaOmi = input.officialOmi?.zonaOmi?.trim() || null;
  const draft: HistoryDraft = {
    ...(input.id ? { id: input.id } : {}),
    locality: formatHistoryLocality(comune, zonaOmi),
    moodScore: null,
    convergenzaTerritoriale: input.convergenzaTerritoriale,
    lat: input.lat,
    lng: input.lng,
    photoThumbnail: input.photoThumbnail,
    resultSnapshot: input.resultSnapshot,
    primaryGeoLevel: input.primaryGeoLevel,
    zonaOmi,
    comune,
    restorable: false,
    ...(input.manualAddress && input.manualAddress.trim().length >= 3
      ? { manualAddress: input.manualAddress.trim() }
      : {}),
  };
  draft.restorable = isHistoryRestorable(draft);
  return draft;
}

function inferComuneFromIdentify(address: string | null | undefined): string | null {
  if (!address || !address.trim()) return null;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1] || parts[parts.length - 2] || null;
  return parts[0] ?? null;
}

function isSavedScan(value: unknown): value is SavedScan {
  if (!value || typeof value !== "object") return false;
  const s = value as SavedScan;
  return typeof s.id === "string" && typeof s.locality === "string";
}

function normalizeLoaded(raw: unknown[]): SavedScan[] {
  return raw.filter(isSavedScan).slice(0, MAX_HISTORY_SCANS).map((s) => ({
    ...s,
    zonaOmi: typeof s.zonaOmi === "string" ? s.zonaOmi : null,
    comune: typeof s.comune === "string" ? s.comune : null,
    restorable: isHistoryRestorable(s),
  }));
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HISTORY_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        db.createObjectStore(HISTORY_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(HISTORY_STORE, mode);
      const req = fn(tx.objectStore(HISTORY_STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("indexedDB request failed"));
    });
  } finally {
    db.close();
  }
}

async function idbPut(scans: SavedScan[]): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    await withStore("readwrite", (store) => store.put(scans, HISTORY_KEY));
  } catch {
    /* private mode / quota — memory + localStorage backup still apply */
  }
}

async function idbGet(): Promise<SavedScan[] | null> {
  if (!hasIndexedDb()) return null;
  try {
    const raw = await withStore<unknown>("readonly", (store) => store.get(HISTORY_KEY));
    return Array.isArray(raw) ? normalizeLoaded(raw) : null;
  } catch {
    return null;
  }
}

async function idbDelete(): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    await withStore("readwrite", (store) => store.delete(HISTORY_KEY));
  } catch {
    /* ignore */
  }
}

function readLocalStorageBackup(): SavedScan[] {
  try {
    const raw = localStorage.getItem(HISTORY_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeLoaded(parsed) : [];
  } catch {
    return [];
  }
}

function writeLocalStorageBackup(scans: SavedScan[]): void {
  try {
    localStorage.setItem(HISTORY_LS_KEY, JSON.stringify(scans));
  } catch {
    try {
      const slim = scans.map((s) => ({
        ...s,
        photoThumbnail: s.photoThumbnail && s.photoThumbnail.length > 80_000 ? null : s.photoThumbnail,
      }));
      localStorage.setItem(HISTORY_LS_KEY, JSON.stringify(slim));
    } catch {
      /* IndexedDB remains the durable copy */
    }
  }
}

export function upsertHistoryList(prev: SavedScan[], incoming: SavedScan): SavedScan[] {
  const idx = prev.findIndex((s) => s.id === incoming.id);
  if (idx >= 0) {
    const merged = [...prev];
    merged[idx] = { ...incoming, date: prev[idx].date };
    return merged.slice(0, MAX_HISTORY_SCANS);
  }
  return [incoming, ...prev].slice(0, MAX_HISTORY_SCANS);
}

export async function persistHistoryRows(scans: SavedScan[]): Promise<void> {
  const next = scans.slice(0, MAX_HISTORY_SCANS);
  memoryList = next;
  await idbPut(next);
  writeLocalStorageBackup(next);
}

export async function loadHistoryRows(): Promise<SavedScan[]> {
  if (memoryList) return memoryList;
  const fromIdb = await idbGet();
  if (fromIdb && fromIdb.length > 0) {
    memoryList = fromIdb;
    return fromIdb;
  }
  const fromLs = readLocalStorageBackup();
  memoryList = fromLs;
  if (fromLs.length > 0) await idbPut(fromLs);
  return fromLs;
}

export async function clearHistoryRows(): Promise<void> {
  memoryList = [];
  await idbDelete();
  try {
    localStorage.removeItem(HISTORY_LS_KEY);
  } catch {
    /* ignore */
  }
}

/** Drop the in-memory cache so the next load hits IDB / localStorage (reload). */
export function resetHistoryMemoryCache(): void {
  memoryList = null;
}
