import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2 } from "lucide-react";

const plans = [
  {
    name: "Agente",
    price: 129,
    period: "/mese",
    description:
      "Per l'agente immobiliare indipendente o il professionista singolo.",
    scans: "80 scansioni/mese",
    users: "1 account",
    features: [
      "Analisi completa — dati ufficiali ed elaborati separati",
      "Quadro predittivo zona e trend demografico",
      "Prezzi di mercato, rischio zona, infrastrutture",
      "Indice opportunità e scenario evolutivo",
      "Storico scansioni 6 mesi",
      "Solo visualizzazione in-app (no export PDF)",
      "Dispositivo vincolato per durata abbonamento",
    ],
    cta: "Prova gratis 3 giorni",
    popular: false,
  },
  {
    name: "Agenzia",
    price: 349,
    period: "/mese",
    description: "Per l'agenzia strutturata. 3 agenti inclusi.",
    scans: "250 scansioni/mese",
    users: "3 account inclusi",
    features: [
      "Tutto del piano Agente",
      "Dashboard agenzia multi-agente",
      "Export PDF con logo agenzia (in attivazione)",
      "Annunci attivi nella zona",
      "Storico scansioni illimitato",
      "Supporto prioritario via email",
      "Dispositivo vincolato per durata abbonamento",
    ],
    extra: "Agente aggiuntivo: €49/mese (+80 scansioni)",
    cta: "Prova gratis 3 giorni",
    popular: true,
  },
  {
    name: "Enterprise",
    price: 749,
    period: "/mese",
    description: "Per agenzie strutturate e grandi team.",
    scans: "800 scansioni/mese",
    users: "10 account inclusi",
    features: [
      "Tutto del piano Agenzia",
      "Dashboard agenzia multi-agente",
      "Export PDF con logo agenzia + watermark Sottra",
      "Storico scansioni illimitato",
      "Supporto prioritario",
    ],
    extra: "Agente aggiuntivo: €39/mese (sconto rispetto ai €49 standard)",
    cta: "Prova gratis 3 giorni",
    popular: false,
  },
];

export default function PricingSection() {
  const navigate = useNavigate();

  return (
    <section id="pricing" className="px-5 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-2xl font-black text-foreground sm:text-3xl lg:text-4xl">
            Piani di abbonamento
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base" style={{ textWrap: "balance" as any }}>
            Prima provi, poi decidi. 3 giorni gratis, 5 scansioni incluse.
            Nessuna carta di credito, nessun dato bancario, nessuna disdetta.
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs font-semibold text-primary sm:text-sm">
            Se non ti abboni, non succede nulla. Paghi solo se scegli di continuare.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-5 sm:p-7 ${
                plan.popular
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-card"
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-5 bg-primary text-primary-foreground text-xs">
                  Più popolare
                </Badge>
              )}
              <h3 className="text-lg font-bold text-foreground sm:text-xl">
                {plan.name}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {plan.description}
              </p>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-black text-foreground sm:text-4xl">
                  €{plan.price}
                </span>
                <span className="text-muted-foreground text-sm">
                  {plan.period}
                </span>
              </div>

              <p className="mt-2 text-xs text-primary font-semibold">
                Zero carta per iniziare · Paghi solo dopo la prova
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-[10px] sm:text-xs">
                  {plan.scans}
                </Badge>
                <Badge variant="secondary" className="text-[10px] sm:text-xs">
                  {plan.users}
                </Badge>
              </div>

              <Separator className="my-5" />

              <ul className="flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-xs text-foreground/80 sm:text-sm"
                  >
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary sm:h-4 sm:w-4" />
                    <span className="break-words">{f}</span>
                  </li>
                ))}
              </ul>

              {plan.extra && (
                <p className="mt-4 rounded-lg bg-secondary/50 px-3 py-2 text-[10px] text-muted-foreground sm:text-xs">
                  {plan.extra}
                </p>
              )}

              <Button
                className="mt-5 w-full"
                variant={plan.popular ? "default" : "outline"}
                size="lg"
                onClick={() => navigate("/signup")}
              >
                {plan.cta}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
