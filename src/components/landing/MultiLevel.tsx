import { Camera, Layers, Eye } from "lucide-react";

const levels = [
  {
    icon: Camera,
    title: "Un solo input",
    desc: "Una foto e le coordinate GPS. Nient'altro.",
  },
  {
    icon: Layers,
    title: "Più livelli di analisi",
    desc: "Prezzo, contesto, rischio, sviluppo, scenario, infrastrutture — elaborati in parallelo.",
  },
  {
    icon: Eye,
    title: "Lettura chiara e operativa",
    desc: "Ogni dato è classificato: ufficiale, elaborato o non disponibile. Nessuna ambiguità.",
  },
];

export default function MultiLevel() {
  return (
    <section className="px-5 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-2xl font-black text-foreground sm:text-3xl lg:text-4xl">
          Da un solo scatto, più livelli di lettura
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
          L'immobile non finisce nella sua immagine.
          Sottra apre il contesto che lo circonda.
        </p>

        <div className="mt-14 grid gap-8 sm:grid-cols-3">
          {levels.map((l, i) => (
            <div key={l.title} className="flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-secondary/60">
                <l.icon className="h-6 w-6 text-primary" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-primary/60">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-lg font-bold text-foreground">{l.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {l.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
