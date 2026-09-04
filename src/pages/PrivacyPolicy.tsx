import { useNavigate } from "react-router-dom";
import { LEGAL_ENTITY, APP_BRAND, val } from "@/lib/legalEntity";

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const e = LEGAL_ENTITY;

  return (
    <div className="min-h-dvh bg-background px-6 py-10 pt-safe pb-safe">
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate(-1)} className="mb-6 text-sm text-muted-foreground hover:text-foreground transition-colors">← Torna indietro</button>

        <h1 className="text-2xl font-bold text-foreground mb-6">Informativa sulla Privacy</h1>

        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <section>
            <h2 className="font-semibold text-foreground mb-2">Titolare del trattamento</h2>
            <p>{val(e.companyNameLegal)}<br/>{val(e.address)}, {val(e.cap)} {val(e.city)} ({val(e.province)})<br/>PEC: {val(e.pec)} | Email: <a href={`mailto:${APP_BRAND.infoEmail}`} className="text-primary underline">{APP_BRAND.infoEmail}</a></p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Tipi di dati raccolti</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Email e credenziali di accesso (autenticazione)</li>
              <li>Coordinate GPS del dispositivo al momento della scansione, usate in modo transitorio per localizzare la microzona OMI</li>
              <li>Fotografia dell'edificio inviata all'elaborazione (non archiviata nel backend Sottra)</li>
              <li>Dati di navigazione (log del server, indirizzo IP) e cookie tecnici di sessione</li>
              <li>Dati di fatturazione e pagamento gestiti da Stripe (Sottra non memorizza numeri di carta)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Finalità del trattamento</h2>
            <p>Erogazione del servizio (scansione, report territoriale, trial e abbonamento), autenticazione, assistenza tecnica, adempimenti di legge e, se scelto dall'utente, invio del report in formato immagine al WhatsApp dell'agenzia salvato.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Base giuridica</h2>
            <p>Esecuzione del contratto (uso del servizio e dell'abbonamento), consenso (fotocamera, geolocalizzazione, invio WhatsApp), legittimo interesse (sicurezza e prevenzione abusi) e obblighi di legge.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Cosa NON conserviamo</h2>
            <p>Le foto dell'edificio e le coordinate GPS non restano nel database Sottra dopo l'elaborazione della scansione. Il contenuto del report è ricostruito lato client dalla risposta delle API. Sottra non inventa visure catastali, APE ufficiali, vendite o successioni sul civico fotografato.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Responsabili e destinatari</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Supabase — autenticazione, database e funzioni (hosting UE disponibile)</li>
              <li>Stripe — pagamenti e abbonamenti (PCI DSS)</li>
              <li>Central Core V3 — analisi dell'edificio e contesto territoriale, invocato solo dal backend Sottra (core-proxy), mai direttamente dal browser</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Conservazione dei dati</h2>
            <p>Account, trial, eventi di scansione (id, senza foto) e stato abbonamento sono conservati per il tempo necessario all'erogazione del servizio e agli obblighi di legge, poi cancellati o anonimizzati su richiesta.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Diritti dell'interessato</h2>
            <p>L'utente ha diritto di accesso, rettifica, cancellazione, portabilità, opposizione al trattamento e reclamo al Garante per la protezione dei dati personali (Art. 15-22 GDPR).</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Cookie</h2>
            <p>Per informazioni sull'uso dei cookie, consulta la <a href="/cookie-policy" className="underline hover:text-foreground">Cookie Policy</a>.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Contatti</h2>
            <p>Per esercitare i tuoi diritti o per qualsiasi richiesta: <a href={`mailto:${APP_BRAND.infoEmail}`} className="text-primary underline">{APP_BRAND.infoEmail}</a></p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Legge applicabile e foro competente</h2>
            <p>{e.applicableLaw} — {e.jurisdiction}</p>
          </section>

          <p className="text-xs text-muted-foreground pt-4">Ultimo aggiornamento: settembre 2026</p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
