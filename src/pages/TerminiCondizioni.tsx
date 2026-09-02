import { useNavigate } from "react-router-dom";
import { LEGAL_ENTITY, APP_BRAND, val } from "@/lib/legalEntity";
import { VAT_NOTICE } from "@/lib/plans";

const TerminiCondizioni = () => {
  const navigate = useNavigate();
  const e = LEGAL_ENTITY;

  return (
    <div className="min-h-dvh bg-background px-6 py-10 pt-safe pb-safe">
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate(-1)} className="mb-6 text-sm text-muted-foreground hover:text-foreground transition-colors">← Torna indietro</button>

        <h1 className="text-2xl font-bold text-foreground mb-6">Termini e Condizioni</h1>

        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <section>
            <h2 className="font-semibold text-foreground mb-2">Titolare del servizio</h2>
            <p>{val(e.companyNameLegal)}</p>
            <p>Sede: {val(e.address)}, {val(e.cap)} {val(e.city)} ({val(e.province)}), {val(e.country)}</p>
            <p>P.IVA: {val(e.vatNumber)}</p>
            <p>PEC: {val(e.pec)}</p>
            <p>Servizio: {APP_BRAND.name} — {APP_BRAND.domain}</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Oggetto</h2>
            <p>{APP_BRAND.name} è una PWA per professionisti del settore immobiliare. Da una foto dell'edificio e dalla posizione GPS, l'agente ottiene un dossier di dati ufficiali: indirizzo da geocodifica inversa, quotazioni OMI di microzona dell'Agenzia delle Entrate quando il GPS cade dentro il poligono OMI (in caso contrario la quotazione OMI viene nascosta, non inventata), dati demografici ISTAT, indicatori di rischio ISPRA/INGV e punti di interesse OSM. Prima la foto, poi solo fonti ufficiali.</p>
            <p className="mt-2">Il servizio non fornisce visure catastali, certificati energetici (APE) ufficiali, il valore del singolo interno, né informazioni su vendite o successioni relative al civico fotografato.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Natura dei dati</h2>
            <p>I dati contrassegnati come ufficiali (OMI, ISTAT, ISPRA, INGV) provengono da fonti istituzionali pubbliche e sono etichettati come tali. Se una fonte non è disponibile per la zona, il report nasconde quella riga: non inventiamo visure, APE ufficiali, vendite o successioni sul civico, né il valore dell'interno. Le stime restano stime.</p>
            <p className="mt-2">Nessun contenuto del report sostituisce una perizia professionale, una visura catastale ufficiale, un certificato energetico o una consulenza legale.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Accettazione</h2>
            <p>L'utilizzo del servizio implica l'accettazione integrale dei presenti termini e condizioni.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Licenza d'uso e dispositivi</h2>
            <p>Le credenziali di accesso sono personali, non cedibili e non trasferibili: è vietato condividere il login con terzi non autorizzati.</p>
            <p className="mt-2">Il numero di telefoni utilizzabili dipende dal piano sottoscritto:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Piano Agente: 1 telefono. Il cambio dispositivo non è self-service: per trasferire l'account a un nuovo telefono scrivi a <a href={`mailto:${APP_BRAND.supportEmail}`} className="text-primary underline">{APP_BRAND.supportEmail}</a>.</li>
              <li>Piano Agenzia: telefoni illimitati sullo stesso abbonamento, per gli agenti dell'agenzia.</li>
              <li>Piano Rete: telefoni illimitati sullo stesso abbonamento, anche su più sedi.</li>
            </ul>
            <p className="mt-2">Costituisce uso previsto e consentito l'invio del report in formato immagine (JPEG) al numero WhatsApp che l'agente ha salvato come recapito dell'agenzia per cui opera, nell'ambito della propria attività professionale.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Prezzi e IVA</h2>
            <p>{VAT_NOTICE}. I prezzi mostrati nel prodotto sono finali. Il listino aggiornato è pubblicato su <a href="/prezzi" className="text-primary underline">{APP_BRAND.domain}/prezzi</a>. Gli abbonamenti sono mensili; non esiste un piano annuale.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Proprietà intellettuale</h2>
            <p>Tutti i contenuti, marchi, grafiche e software presenti nel sito sono di proprietà esclusiva del titolare e protetti dalle leggi vigenti.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Limitazione di responsabilità</h2>
            <p>Il servizio è fornito "così com'è" senza garanzie di alcun tipo. I dati forniti hanno carattere informativo e non sostituiscono perizie professionali o consulenze specialistiche. Quando una fonte ufficiale non è disponibile, il dato viene omesso dal report, non ricostruito.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Modifiche</h2>
            <p>Il titolare si riserva il diritto di modificare i presenti termini in qualsiasi momento, dandone comunicazione tramite il sito.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Foro competente e legge applicabile</h2>
            <p>Per qualsiasi controversia sarà competente il {e.jurisdiction}. Legge applicabile: {e.applicableLaw}.</p>
          </section>

          <p className="text-xs text-muted-foreground pt-4">Ultimo aggiornamento: settembre 2026</p>
        </div>
      </div>
    </div>
  );
};

export default TerminiCondizioni;
