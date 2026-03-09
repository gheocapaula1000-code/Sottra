import { useNavigate } from "react-router-dom";
import { LEGAL_ENTITY, APP_BRAND, val } from "@/lib/legalEntity";

const CookiePolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-svh bg-background px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate(-1)} className="mb-6 text-sm text-muted-foreground hover:text-foreground transition-colors">← Torna indietro</button>

        <h1 className="text-2xl font-bold text-foreground mb-6">Cookie Policy</h1>

        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <section>
            <h2 className="font-semibold text-foreground mb-2">Cosa sono i cookie</h2>
            <p>I cookie sono piccoli file di testo che i siti web memorizzano sul dispositivo dell'utente per migliorare l'esperienza di navigazione.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Cookie tecnici utilizzati</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Cookie di sessione — per il corretto funzionamento dell'applicazione</li>
              <li>Preferenze UI — per salvare le impostazioni dell'interfaccia</li>
              <li>Consenso cookie — per ricordare la scelta dell'utente (localStorage)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Cookie di terze parti</h2>
            <p>Questo sito non utilizza cookie di profilazione. Potrebbero essere presenti cookie tecnici di terze parti (es. Google Fonts).</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Come disabilitare i cookie</h2>
            <p>È possibile disabilitare i cookie tramite le impostazioni del proprio browser. Si noti che la disabilitazione potrebbe compromettere il funzionamento del sito.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Titolare</h2>
            <p>{val(LEGAL_ENTITY.companyName)}</p>
            <p className="mt-1">Per informazioni: <a href={`mailto:${APP_BRAND.infoEmail}`} className="text-primary underline">{APP_BRAND.infoEmail}</a></p>
          </section>

          <p className="text-xs text-muted-foreground pt-4">Ultimo aggiornamento: marzo 2026</p>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicy;
