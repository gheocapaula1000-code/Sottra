import { useRegisterSW } from "virtual:pwa-register/react";
import { useState, useCallback } from "react";
import { BUILD_VERSION } from "@/lib/buildInfo";

const isDev = import.meta.env.DEV;

/**
 * Cleans up legacy localStorage/sessionStorage keys from old builds.
 * Does NOT remove user-critical data (auth tokens, preferences).
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
    // storage access may fail in some contexts
  }
}

// Run once on import
cleanLegacyStorage();

export default function PwaUpdateBanner() {
  const [dismissed, setDismissed] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (isDev) console.log("[PWA] SW registered:", swUrl);
      // Check for updates every 60 seconds
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60_000);
      }
    },
    onRegisterError(error) {
      console.error("[PWA] SW registration error:", error);
    },
  });

  const handleUpdate = useCallback(() => {
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  if (!needRefresh || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-md rounded-xl border border-border bg-card p-4 shadow-2xl sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm">
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
      {isDev && (
        <p className="mt-2 text-[10px] text-muted-foreground font-mono">
          build {BUILD_VERSION}
        </p>
      )}
    </div>
  );
}
