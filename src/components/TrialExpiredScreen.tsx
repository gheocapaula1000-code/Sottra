import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, ArrowRight, AlertTriangle } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { PLANS, PlanKey } from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const planFeatures: Record<PlanKey, string[]> = {
  agente: [
    "Analisi completa — dati ufficiali ed elaborati separati",
    "Quadro predittivo zona e trend demografico",
    "Prezzi di mercato, rischio zona, infrastrutture",
    "Indice opportunità e scenario evolutivo",
    "Storico scansioni 6 mesi",
    "Solo visualizzazione in-app (no export PDF)",
    "Dispositivo vincolato per durata abbonamento",
  ],
  agenzia: [
    "Tutto del piano Agente",
    "Dashboard agenzia multi-agente",
    "Export PDF con logo agenzia (in attivazione)",
    "Annunci attivi nella zona",
    "Storico scansioni illimitato",
    "Supporto prioritario via email",
    "Dispositivo vincolato per durata abbonamento",
  ],
  enterprise: [
    "Tutto del piano Agenzia",
    "Dashboard agenzia multi-agente",
    "Export PDF con logo agenzia + watermark Sottra",
    "Storico scansioni illimitato",
    "Supporto prioritario",
  ],
};

const planMeta: Record<PlanKey, { users: string; scans: string; popular: boolean }> = {
  agente: { users: "1 account", scans: "80 scansioni/mese", popular: false },
  agenzia: { users: "3 account inclusi", scans: "250 scansioni/mese", popular: true },
  enterprise: { users: "10 account inclusi", scans: "800 scansioni/mese", popular: false },
};

interface TrialExpiredScreenProps {
  scansUsed: number;
}

export const TrialExpiredScreen = ({ scansUsed }: TrialExpiredScreenProps) => {
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const { toast } = useToast();

  const handleCheckout = async (key: PlanKey) => {
    setLoadingPlan(key);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: PLANS[key].price_id },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e: unknown) {
      toast({ title: "Errore", description: e instanceof Error ? e.message : "Errore sconosciuto", variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-12">
      <div className="mx-auto max-w-4xl text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-6 text-3xl font-black text-foreground sm:text-4xl">
          Il tuo trial è terminato
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Hai effettuato <strong className="text-foreground">{scansUsed} scansioni</strong> in 3 giorni.
          <br />Scegli il piano più adatto a te per continuare.
        </p>
        <p className="mt-2 text-sm font-semibold text-primary">
          Nessun dato bancario è stato richiesto durante il trial · Il pagamento avviene solo ora, se decidi di proseguire
        </p>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {(Object.keys(PLANS) as PlanKey[]).map((key) => {
            const plan = PLANS[key];
            const meta = planMeta[key];
            const features = planFeatures[key];

            return (
              <Card
                key={key}
                className={`relative flex flex-col rounded-2xl border p-6 text-left ${
                  meta.popular
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-card"
                }`}
              >
                {meta.popular && (
                  <Badge className="absolute -top-3 left-6 bg-primary text-primary-foreground text-xs">
                    Più popolare
                  </Badge>
                )}
                <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-foreground">€{plan.price}</span>
                  <span className="text-muted-foreground">/mese</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs">{meta.scans}</Badge>
                  <Badge variant="secondary" className="text-xs">{meta.users}</Badge>
                </div>

                <Separator className="my-5" />

                <ul className="flex-1 space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground/80">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-6 w-full gap-2"
                  variant={meta.popular ? "default" : "outline"}
                  size="lg"
                  disabled={loadingPlan !== null}
                  onClick={() => handleCheckout(key)}
                >
                  {loadingPlan === key ? "Caricamento…" : (
                    <>Scegli {plan.name} <ArrowRight className="h-4 w-4" /></>
                  )}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TrialExpiredScreen;
