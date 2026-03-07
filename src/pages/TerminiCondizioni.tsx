import { useNavigate } from "react-router-dom";
import { LEGAL_ENTITY, val } from "@/lib/legalEntity";

const TerminiCondizioni = () => {
  const navigate = useNavigate();
  const e = LEGAL_ENTITY;

  return (
    <div className="min-h-svh bg-background px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate(-1)} className="mb-6 text-sm text-muted-foreground hover:text-foreground transition-colors">← Torna indietro</button>

        <h1 className="text-2xl font-bold text-foreground mb-6">Termini e Condizioni</h1>

        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <section>
            <h2 className="font-semibold text-foreground mb-2">Titolare del servizio</h2>
            <p>{val(e.companyName)}</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Oggetto</h2>
            <p>Sottra è una PWA che permette di fotografare edifici e ottenere dati catastali, prezzi di mercato, classe energetica, annunci nella zona e previsioni di investimento.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Accettazione</h2>
            <p>L'utilizzo del servizio implica l'accettazione integrale dei presenti termini e condizioni.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Uso della licenza</h2>
            <p>La licenza d'uso di Sottra è strettamente personale, non cedibile e non trasferibile. Ogni account è vincolato a un singolo dispositivo per l'intera durata dell'abbonamento. Il cambio dispositivo non è disponibile in modalità self-service: per trasferire l'account a un nuovo dispositivo è necessario contattare il supporto scrivendo a <a href="mailto:supporto@sottra.app" className="text-primary underline">supporto@sottra.app</a>.</p>
            <p className="mt-2">La condivisione dell'account, delle credenziali o dei dati ottenuti tramite il servizio con terzi non autorizzati è espressamente vietata e comporta la sospensione immediata dell'account senza diritto a rimborso.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Proprietà intellettuale</h2>
            <p>Tutti i contenuti, marchi, grafiche e software presenti nel sito sono di proprietà esclusiva del titolare e protetti dalle leggi vigenti.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Limitazione di responsabilità</h2>
            <p>Il servizio è fornito "così com'è" senza garanzie di alcun tipo. I dati forniti hanno carattere indicativo e non sostituiscono perizie professionali.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Modifiche</h2>
            <p>Il titolare si riserva il diritto di modificare i presenti termini in qualsiasi momento, dandone comunicazione tramite il sito.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Foro competente e legge applicabile</h2>
            <p>Per qualsiasi controversia sarà competente il Tribunale della sede legale del titolare. Legge applicabile: legge italiana.</p>
          </section>

          <p className="text-xs text-muted-foreground pt-4">Ultimo aggiornamento: marzo 2026</p>
        </div>
      </div>
    </div>
  );
};

export default TerminiCondizioni;
