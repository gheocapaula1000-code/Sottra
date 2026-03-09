import { Building2, Briefcase, TrendingUp, Search } from "lucide-react";

const targets = [
  {
    icon: Building2,
    title: "Agenzie immobiliari",
    desc: "Team strutturati che vogliono valutare immobili e zone in modo rapido e documentato.",
  },
  {
    icon: Briefcase,
    title: "Professionisti del settore",
    desc: "Agenti, periti e consulenti che hanno bisogno di un quadro completo prima di ogni decisione.",
  },
  {
    icon: TrendingUp,
    title: "Investitori attenti",
    desc: "Chi vuole leggere il contesto territoriale oltre il prezzo, prima di muoversi.",
  },
  {
    icon: Search,
    title: "Chi vuole capire davvero",
    desc: "Per chi sa che il valore di un immobile dipende anche da ciò che lo circonda.",
  },
];

export default function TargetAudience() {
  return (
    <section className="px-5 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-center text-2xl font-black text-foreground sm:text-3xl lg:text-4xl">
          Per chi è Sottra
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center text-sm text-muted-foreground sm:text-base">
          Costruito per chi lavora nel settore immobiliare e vuole decidere meglio.
        </p>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-5">
          {targets.map((t) => (
            <div
              key={t.title}
              className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
            >
              <t.icon className="mb-3 h-5 w-5 text-primary sm:h-6 sm:w-6" />
              <h3 className="text-sm font-bold text-foreground sm:text-base break-words">
                {t.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {t.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
