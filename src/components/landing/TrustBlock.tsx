import { Database, ShieldCheck, FileCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const items = [
  {
    icon: Database,
    title: "Fonti ufficiali dove disponibili",
    desc: "OMI, ISTAT, ISPRA, INGV. Quando il dato proviene da una fonte istituzionale, lo indichiamo.",
    badge: "Dato ufficiale",
  },
  {
    icon: ShieldCheck,
    title: "Elaborazione da fonti pubbliche",
    desc: "Dove il dato ufficiale non basta, l'analisi integra fonti pubbliche con metodologia strutturata.",
    badge: "Dato elaborato",
  },
  {
    icon: FileCheck,
    title: "Classificazione trasparente",
    desc: "Ogni sezione del report indica la natura del dato: ufficiale, elaborato o non disponibile. Nessuna ambiguità.",
    badge: "Trasparenza",
  },
];

export default function TrustBlock() {
  return (
    <section className="px-5 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-center text-2xl font-black text-foreground sm:text-3xl lg:text-4xl">
          Dati che puoi leggere con fiducia
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center text-sm text-muted-foreground sm:text-base">
          Non tutto è dato ufficiale — e lo rendiamo chiaro fin dall'inizio.
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-card/60 p-5"
            >
              <item.icon className="mb-3 h-6 w-6 text-primary" />
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground break-words">
                  {item.title}
                </h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.desc}
              </p>
              <Badge
                variant="secondary"
                className="mt-3 text-[10px] uppercase tracking-wider"
              >
                {item.badge}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
