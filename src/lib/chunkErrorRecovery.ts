/**
 * Chunk Load Error Recovery
 *
 * Handles the common production failure where a new deploy invalidates
 * old hashed chunk filenames, causing `import()` to fail with a network error.
 * Also handles SW cache mismatches that serve stale HTML pointing to dead chunks.
 *
 * Strategy:
 * 1. Detect chunk load errors (dynamic import failures)
 * 2. Unregister stale service workers
 * 3. Clear caches
 * 4. Reload once (with a guard to prevent infinite loops)
 */

const RELOAD_KEY = "sottra-chunk-reload";
const RELOAD_MAX = 2;
const RELOAD_WINDOW_MS = 30_000; // 30 seconds

interface ReloadRecord {
  count: number;
  first: number;
}

function getReloadRecord(): ReloadRecord {
  try {
    const raw = sessionStorage.getItem(RELOAD_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* silent */ }
  return { count: 0, first: Date.now() };
}

function setReloadRecord(rec: ReloadRecord) {
  try {
    sessionStorage.setItem(RELOAD_KEY, JSON.stringify(rec));
  } catch { /* silent */ }
}

function clearReloadRecord() {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch { /* silent */ }
}

/** Returns true if the error looks like a chunk/module load failure */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    msg.includes("dynamically imported module") ||
    msg.includes("error loading dynamically imported module") ||
    (msg.includes("fetch") && msg.includes("module"))
  );
}

/**
 * Attempt recovery from a chunk load error:
 * - Unregisters service workers
 * - Clears caches
 * - Reloads the page (max RELOAD_MAX times within RELOAD_WINDOW_MS)
 *
 * Returns true if recovery reload is happening, false if max retries exceeded.
 */
export async function recoverFromChunkError(): Promise<boolean> {
  const rec = getReloadRecord();

  // Reset counter if window has elapsed
  if (Date.now() - rec.first > RELOAD_WINDOW_MS) {
    rec.count = 0;
    rec.first = Date.now();
  }

  if (rec.count >= RELOAD_MAX) {
    // Give up — clear the record for next session
    clearReloadRecord();
    return false;
  }

  // Increment reload counter
  rec.count++;
  setReloadRecord(rec);

  // Purge SW and caches
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch { /* silent */ }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch { /* silent */ }

  // Hard reload bypassing cache
  window.location.reload();
  return true;
}

/**
 * Clear the reload guard on successful app boot.
 * Call this once the app renders successfully.
 */
export function markBootSuccess() {
  clearReloadRecord();
}
