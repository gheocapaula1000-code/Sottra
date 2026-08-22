import {
  BarChart3,
  ShieldCheck,
  Users,
  TrendingUp,
  Compass,
  Clock,
  Building2,
} from "lucide-react";

const modules = [
  {
    icon: BarChart3,
    title: "Prezzi",
    copy: "Quotazioni OMI ufficiali (€/m² di zona). Se la copertura manca, lo diciamo — non inventiamo il prezzo.",
  },
  {
    icon: ShieldCheck,
    title: "Rischio zona",
    copy: "Rischio sismico, idrogeologico e alluvionale. Dati ufficiali, leggibili al volo.",
  },
  {
    icon: Users,
    title: "Trend demografico",
    copy: "Popolazione, età media, composizione familiare. Il contesto sociale che conta.",
  },
  {
    icon: TrendingUp,
    title: "Dinamica territoriale",
    copy: "Segnali di sviluppo, trasformazioni e tendenze dell'area circostante.",
  },
  {
    icon: Compass,
    title: "Opportunity",
    copy: "Punti di forza e di attenzione della zona, sintetizzati in un quadro operativo.",
  },
  {
    icon: Clock,
    title: "TimeView",
    copy: "Scenario a medio periodo: fattori trainanti, rischi e prospettive del contesto.",
  },
  {
    icon: Building2,
    title: "Infrastrutture e reti",
    copy: "Opere, mobilità, connettività e interventi pubblici che sostengono o trasformano l'area.",
  },
];

export default function ValueModules() {
  return (
    <section id="value" className="px-5 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-black text-foreground sm:text-3xl lg:text-4xl">
          Sette moduli, un unico quadro operativo
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-sm text-muted-foreground sm:text-base">
          Foto → fonti ufficiali italiane (OMI, ISTAT, OpenStreetMap). Ogni voce è etichettata: ufficiale, elaborata o non disponibile.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <div
              key={m.title}
              className="group rounded-2xl border border-border bg-card/60 p-5 transition-colors hover:border-primary/30"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <m.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-base font-bold text-foreground">{m.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {m.copy}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
