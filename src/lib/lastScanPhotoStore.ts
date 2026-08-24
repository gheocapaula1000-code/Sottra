/**
 * Persist the last scan JPEG + geo so /result survives PWA reload,
 * backgrounding, and browser pull-to-refresh (router location.state is gone).
 *
 * IndexedDB holds the real dataURL (too large for sessionStorage).
 * Memory cache covers the same JS session. Never invents a photo or coords.
 */

import { isValidImageDataUrl } from "@/lib/imageUtils";

export const LAST_SCAN_DB_NAME = "sottra-last-scan";
export const LAST_SCAN_STORE = "scan";
export const LAST_SCAN_KEY = "last";

export interface LastScanRecord {
  photo: string;
  lat: number | null;
  lng: number | null;
  manualAddress?: string;
}

let memoryRecord: LastScanRecord | null = null;

function normalizeRecord(input: LastScanRecord): LastScanRecord | null {
  if (!isValidImageDataUrl(input.photo)) return null;
  const lat = typeof input.lat === "number" && Number.isFinite(input.lat) ? input.lat : null;
  const lng = typeof input.lng === "number" && Number.isFinite(input.lng) ? input.lng : null;
  const trimmed =
    typeof input.manualAddress === "string" && input.manualAddress.trim().length >= 3
      ? input.manualAddress.trim()
      : undefined;
  return { photo: input.photo, lat, lng, ...(trimmed ? { manualAddress: trimmed } : {}) };
}

export function isUsableLastScan(value: unknown): value is LastScanRecord {
  if (!value || typeof value !== "object") return false;
  const rec = value as LastScanRecord;
  if (!isValidImageDataUrl(rec.photo)) return false;
  const latOk = rec.lat == null || (typeof rec.lat === "number" && Number.isFinite(rec.lat));
  const lngOk = rec.lng == null || (typeof rec.lng === "number" && Number.isFinite(rec.lng));
  if (!latOk || !lngOk) return false;
  if (rec.manualAddress != null && typeof rec.manualAddress !== "string") return false;
  return true;
}

/** Router state wins when it still has the shot; otherwise restore IndexedDB. */
export function mergeResultScanState<T extends { photo?: unknown }>(
  routerState: T | null | undefined,
  persisted: LastScanRecord | null,
): T | LastScanRecord | null {
  if (routerState && isValidImageDataUrl(routerState.photo)) return routerState;
  if (persisted && isValidImageDataUrl(persisted.photo)) return persisted;
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

/** Home / clear / new flow — drop the last shot. */
export async function clearLastScanPhoto(): Promise<void> {
  memoryRecord = null;
  await idbDelete();
}
