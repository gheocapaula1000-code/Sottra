import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const steps = [
  {
    num: "01",
    title: "Attivi la prova gratuita",
    desc: "Registrazione in 30 secondi. Nessuna carta di credito, nessun dato bancario.",
  },
  {
    num: "02",
    title: "Usi 5 scansioni in 3 giorni",
    desc: "Carica una foto, ottieni il quadro completo. Valuti il prodotto con calma.",
  },
  {
    num: "03",
    title: "Decidi se continuare",
    desc: "Se vuoi proseguire, scegli un piano. Se no, non succede nulla. Nessuna disdetta.",
  },
];

export default function HowItWorks() {
  const navigate = useNavigate();

  return (
    <section className="px-5 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-2xl font-black text-foreground sm:text-3xl lg:text-4xl">
          Prova senza impegno
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground sm:text-base" style={{ textWrap: "balance" as React.CSSProperties }}>
          Tre passaggi, zero rischi. Nessun pagamento anticipato.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-3 sm:gap-5">
          {steps.map((s) => (
            <div
              key={s.num}
              className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/60 p-5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">
                {s.num}
              </span>
              <h3 className="text-base font-bold text-foreground">{s.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        <Button
          size="lg"
          className="mt-10 gap-2 text-base min-h-[48px]"
          onClick={() => navigate("/signup")}
        >
          Inizia senza carta
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
