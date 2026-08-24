/**
 * Persist the last scan JPEG + geo + finished report snapshot so /result
 * survives Back, Home, PWA reload, and browser pull-to-refresh
 * (router location.state is gone).
 *
 * IndexedDB holds the real dataURL (too large for Web Storage quotas).
 * Memory cache covers the same JS session. Never invents a photo, coords, or tendine.
 */

import { isValidImageDataUrl } from "@/lib/imageUtils";
import type { ScanResult } from "@/types";

export const LAST_SCAN_DB_NAME = "sottra-last-scan";
export const LAST_SCAN_STORE = "scan";
export const LAST_SCAN_KEY = "last";

export interface LastScanRecord {
  photo: string;
  lat: number | null;
  lng: number | null;
  manualAddress?: string;
  /** Stable history row id so reload / PTR updates the same Cronologia entry. */
  historyId?: string;
  /** Finished report sections (success only). Restore these — do not rescan. */
  savedResult?: Partial<ScanResult>;
}

let memoryRecord: LastScanRecord | null = null;

export function isSavedResultSnapshot(value: unknown): value is Partial<ScanResult> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

function normalizeRecord(input: LastScanRecord): LastScanRecord | null {
  if (!isValidImageDataUrl(input.photo)) return null;
  const lat = typeof input.lat === "number" && Number.isFinite(input.lat) ? input.lat : null;
  const lng = typeof input.lng === "number" && Number.isFinite(input.lng) ? input.lng : null;
  const trimmed =
    typeof input.manualAddress === "string" && input.manualAddress.trim().length >= 3
      ? input.manualAddress.trim()
      : undefined;
  const historyId = typeof input.historyId === "string" && input.historyId.trim()
    ? input.historyId.trim()
    : undefined;
  const savedResult = isSavedResultSnapshot(input.savedResult) ? input.savedResult : undefined;
  return {
    photo: input.photo,
    lat,
    lng,
    ...(trimmed ? { manualAddress: trimmed } : {}),
    ...(historyId ? { historyId } : {}),
    ...(savedResult ? { savedResult } : {}),
  };
}

export function isUsableLastScan(value: unknown): value is LastScanRecord {
  if (!value || typeof value !== "object") return false;
  const rec = value as LastScanRecord;
  if (!isValidImageDataUrl(rec.photo)) return false;
  const latOk = rec.lat == null || (typeof rec.lat === "number" && Number.isFinite(rec.lat));
  const lngOk = rec.lng == null || (typeof rec.lng === "number" && Number.isFinite(rec.lng));
  if (!latOk || !lngOk) return false;
  if (rec.manualAddress != null && typeof rec.manualAddress !== "string") return false;
  if (rec.savedResult != null && (typeof rec.savedResult !== "object" || Array.isArray(rec.savedResult))) return false;
  return true;
}

/**
 * Router photo wins. Attach persisted savedResult only when it belongs to
 * the same JPEG — never graft an older report onto a new capture.
 */
export function mergeResultScanState<T extends { photo?: unknown; savedResult?: unknown }>(
  routerState: T | null | undefined,
  persisted: LastScanRecord | null,
): T | LastScanRecord | null {
  const persistOk = persisted && isValidImageDataUrl(persisted.photo) ? persisted : null;

  if (routerState && isValidImageDataUrl(routerState.photo)) {
    if (isSavedResultSnapshot(routerState.savedResult)) return routerState;
    if (persistOk && persistOk.photo === routerState.photo && isSavedResultSnapshot(persistOk.savedResult)) {
      return { ...routerState, savedResult: persistOk.savedResult };
    }
    return routerState;
  }

  if (persistOk) {
    if (isSavedResultSnapshot(routerState?.savedResult)) {
      return { ...persistOk, savedResult: routerState!.savedResult as Partial<ScanResult> };
    }
    return persistOk;
  }

  return routerState ?? null;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LAST_SCAN_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LAST_SCAN_STORE)) {
        db.createObjectStore(LAST_SCAN_STORE);
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
      const tx = db.transaction(LAST_SCAN_STORE, mode);
      const req = fn(tx.objectStore(LAST_SCAN_STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("indexedDB request failed"));
    });
  } finally {
    db.close();
  }
}

async function idbPut(record: LastScanRecord): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    await withStore("readwrite", (store) => store.put(record, LAST_SCAN_KEY));
  } catch {
    // Private mode / quota — memory cache still holds this session.
  }
}

async function idbGet(): Promise<LastScanRecord | null> {
  if (!hasIndexedDb()) return null;
  try {
    const raw = await withStore<unknown>("readonly", (store) => store.get(LAST_SCAN_KEY));
    return isUsableLastScan(raw) ? raw : null;
  } catch {
    return null;
  }
}

async function idbDelete(): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    await withStore("readwrite", (store) => store.delete(LAST_SCAN_KEY));
  } catch {
    /* ignore */
  }
}

/** New scan replaces the stored one. Does not invent photo or GPS. */
export async function saveLastScanPhoto(input: LastScanRecord): Promise<void> {
  const record = normalizeRecord(input);
  if (!record) return;
  memoryRecord = record;
  await idbPut(record);
}

/** Same-session read — no IDB wait. Used so /result can restore before scan(). */
export function peekLastScanPhoto(): LastScanRecord | null {
  return memoryRecord && isValidImageDataUrl(memoryRecord.photo) ? memoryRecord : null;
}

export async function loadLastScanPhoto(): Promise<LastScanRecord | null> {
  if (memoryRecord && isValidImageDataUrl(memoryRecord.photo)) {
    return memoryRecord;
  }
  const fromIdb = await idbGet();
  if (fromIdb) {
    memoryRecord = fromIdb;
    return fromIdb;
  }
  return null;
}

/** Explicit Cronologia wipe only — Home / Back must not call this. */
export async function clearLastScanPhoto(): Promise<void> {
  memoryRecord = null;
  await idbDelete();
}
