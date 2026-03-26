import { useRegisterSW } from "virtual:pwa-register/react";
import { useState, useEffect, useCallback, useRef } from "react";
import { BUILD_VERSION } from "@/lib/buildInfo";

const isDev = import.meta.env.DEV;
const POLL_INTERVAL = 30_000; // 30s
const MAX_CONSECUTIVE_ERRORS = 3;

/**
 * Cleans up legacy localStorage/sessionStorage keys from old builds.
 */
function cleanLegacyStorage() {
  const legacyPrefixes = [
    "sottra-landing-",
    "sottra-cache-",
    "sw-version",
    "pwa-update-",
    "old-build-",
  ];
  try {
    for (const store of [localStorage, sessionStorage]) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key && legacyPrefixes.some((p) => key.startsWith(p))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => store.removeItem(k));
    }
  } catch {
    // silent
  }
}

cleanLegacyStorage();

export default function PwaUpdateBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const consecutiveErrors = useRef(0);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (isDev) console.log("[PWA] SW registered, build:", BUILD_VERSION);
      if (registration) {
        const poll = setInterval(() => {
          // Stop polling after too many consecutive errors to prevent loops
          if (consecutiveErrors.current >= MAX_CONSECUTIVE_ERRORS) {
            clearInterval(poll);
            console.warn("[PWA] Stopping update poll after repeated errors");
            return;
          }
          registration.update().catch(() => {
            consecutiveErrors.current++;
          });
        }, POLL_INTERVAL);
      }
      try {
        localStorage.setItem("sottra-sw-status", JSON.stringify({
          build: BUILD_VERSION,
          swActive: true,
          lastCheck: new Date().toISOString(),
        }));
      } catch { /* silent */ }
    },
    onRegisterError(error) {
      console.error("[PWA] SW error:", error);
    },
  });

  useEffect(() => {
    if (needRefresh && !dismissed) {
      setShowBanner(true);
      const timer = setTimeout(() => {
        window.location.reload();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [needRefresh, dismissed]);

  const handleUpdate = useCallback(() => {
    updateServiceWorker(true);
    setTimeout(() => window.location.reload(), 500);
  }, [updateServiceWorker]);

  if (!showBanner || dismissed) return null;

  return (
    <div className="fixed z-[9999] mx-auto max-w-md rounded-xl border border-border bg-card p-4 shadow-2xl sm:left-auto sm:right-6 sm:max-w-sm" style={{ bottom: 'max(env(safe-area-inset-bottom, 16px), 16px)', left: 'max(env(safe-area-inset-left, 16px), 16px)', right: 'max(env(safe-area-inset-right, 16px), 16px)' }}>
      <p className="text-sm font-medium text-foreground">
        È disponibile una nuova versione di Sottra
      </p>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={handleUpdate}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Aggiorna ora
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Più tardi
        </button>
      </div>
    </div>
  );
}
