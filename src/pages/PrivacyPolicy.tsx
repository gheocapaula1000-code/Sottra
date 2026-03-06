import { useNavigate } from "react-router-dom";
import { LEGAL_ENTITY, val } from "@/lib/legalEntity";

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const e = LEGAL_ENTITY;

  return (
    <div className="min-h-svh bg-background px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate(-1)} className="mb-6 text-sm text-muted-foreground hover:text-foreground transition-colors">← Torna indietro</button>

        <h1 className="text-2xl font-bold text-foreground mb-6">Informativa sulla Privacy</h1>

        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <section>
            <h2 className="font-semibold text-foreground mb-2">Titolare del trattamento</h2>
            <p>{val(e.companyName)}<br/>{val(e.address)} {val(e.cap)} {val(e.city)} ({val(e.province)})<br/>Email: {val(e.email)} | PEC: {val(e.pec)}</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Tipi di dati raccolti</h2>
            <p>Dati di navigazione (log del server, indirizzo IP), cookie tecnici, e dati forniti volontariamente dall'utente (es. email, form di contatto).</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Finalità del trattamento</h2>
            <p>Funzionamento del servizio, assistenza tecnica, adempimenti di legge.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Base giuridica</h2>
            <p>Consenso dell'interessato, esecuzione di un contratto, legittimo interesse del titolare.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Conservazione dei dati</h2>
            <p>I dati personali sono conservati per il tempo strettamente necessario al raggiungimento delle finalità per cui sono stati raccolti.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Diritti dell'interessato</h2>
            <p>L'utente ha diritto di accesso, rettifica, cancellazione, portabilità, opposizione al trattamento e reclamo al Garante per la protezione dei dati personali (Art. 15-22 GDPR).</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Cookie</h2>
            <p>Per informazioni sull'uso dei cookie, consulta la <a href="/cookie-policy" className="underline hover:text-foreground">Cookie Policy</a>.</p>
          </section>

          <p className="text-xs text-muted-foreground pt-4">Ultimo aggiornamento: marzo 2026</p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
