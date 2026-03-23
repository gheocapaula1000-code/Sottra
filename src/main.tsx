import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const root = document.getElementById("root");

if (!root) {
  // Fatal: no mount point — show inline fallback
  document.body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;padding:24px;text-align:center;background:#fafafa">
      <h1 style="font-size:1.25rem;margin-bottom:8px">Impossibile avviare Sottra</h1>
      <p style="color:#666;margin-bottom:16px">Si è verificato un errore durante il caricamento.</p>
      <button onclick="location.reload()" style="padding:10px 24px;border-radius:6px;border:none;background:#1a1a2e;color:#fff;cursor:pointer;font-size:0.9rem">Riprova</button>
    </div>`;
} else {
  try {
    createRoot(root).render(<App />);
  } catch (e) {
    console.error("[Sottra] Fatal render error:", e);
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;padding:24px;text-align:center;background:#fafafa">
        <h1 style="font-size:1.25rem;margin-bottom:8px">Errore di avvio</h1>
        <p style="color:#666;margin-bottom:16px">Non è stato possibile caricare l'applicazione. Riprova tra qualche istante.</p>
        <button onclick="location.reload()" style="padding:10px 24px;border-radius:6px;border:none;background:#1a1a2e;color:#fff;cursor:pointer;font-size:0.9rem">Ricarica</button>
      </div>`;
  }
}
