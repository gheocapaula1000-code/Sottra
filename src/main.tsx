import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import App from "./App.tsx";
import "./index.css";
import { isChunkLoadError, recoverFromChunkError, markBootSuccess } from "./lib/chunkErrorRecovery";

/**
 * CSP-safe fallback UI using DOM API only — no direct HTML injection, no inline handlers.
 */
function buildFallbackUI(title: string, body: string): HTMLDivElement {
  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui,sans-serif",
    padding: "24px", textAlign: "center", background: "#fafafa",
  });

  const h1 = document.createElement("h1");
  Object.assign(h1.style, { fontSize: "1.25rem", marginBottom: "8px" });
  h1.textContent = title;

  const p = document.createElement("p");
  Object.assign(p.style, { color: "#666", marginBottom: "16px" });
  p.textContent = body;

  const btn = document.createElement("button");
  Object.assign(btn.style, {
    padding: "10px 24px", borderRadius: "6px", border: "none",
    background: "#1a1a2e", color: "#fff", cursor: "pointer", fontSize: "0.9rem",
  });
  btn.textContent = "Ricarica";
  btn.addEventListener("click", () => location.reload());

  wrap.appendChild(h1);
  wrap.appendChild(p);
  wrap.appendChild(btn);
  return wrap;
}

function showFatalUI(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
  const ui = buildFallbackUI(
    "Errore di avvio",
    "Non è stato possibile caricare l'applicazione. Riprova tra qualche istante.",
  );
  ui.setAttribute("data-sottra-fatal", "1");
  el.appendChild(ui);
}

/**
 * Last-resort catch for module-init throws (e.g. historical `supabaseUrl is required`)
 * that happen before React can mount ErrorBoundary — otherwise the page stays black.
 */
function installEmptyRootGuards(el: HTMLElement) {
  const maybeFallback = (err: unknown) => {
    if (el.querySelector("[data-sottra-fatal]")) return;
    if (el.childElementCount > 0) return;
    console.error("[Sottra] Fatal boot error:", err);
    showFatalUI(el);
  };
  window.addEventListener("error", (ev) => {
    maybeFallback(ev.error ?? ev.message);
  });
  window.addEventListener("unhandledrejection", (ev) => {
    maybeFallback(ev.reason);
  });
}

/**
 * Wrapper that calls markBootSuccess on first real mount/commit.
 */
function BootGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    markBootSuccess();
  }, []);
  return <>{children}</>;
}

const root = document.getElementById("root");

if (!root) {
  // No #root element — render fallback into body via DOM API
  document.body.appendChild(
    buildFallbackUI(
      "Impossibile avviare Sottra",
      "Si è verificato un errore durante il caricamento.",
    ),
  );
} else {
  installEmptyRootGuards(root);
  try {
    createRoot(root).render(
      <BootGuard>
        <App />
      </BootGuard>,
    );
  } catch (e) {
    console.error("[Sottra] Fatal render error:", e);

    if (isChunkLoadError(e)) {
      recoverFromChunkError().then((recovering) => {
        if (!recovering) {
          showFatalUI(root);
        }
      });
    } else {
      showFatalUI(root);
    }
  }
}
