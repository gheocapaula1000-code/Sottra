import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, AlertTriangle, CreditCard } from "lucide-react";
import { PLANS, PlanKey } from "@/lib/plans";
import { isBillingReady } from "@/lib/billing";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { APP_BRAND } from "@/lib/legalEntity";

const planFeatures: Record<PlanKey, string[]> = {
  agente: [
    "Analisi completa — dati ufficiali ed elaborati distinti",
    "Quadro demografico e indicatori di zona",
    "Prezzi di mercato, rischio zona, infrastrutture",
    "Indice opportunità e scenario evolutivo",
    "Storico scansioni 6 mesi",
    "Visualizzazione in-app",
    "Dispositivo vincolato per durata abbonamento",
  ],
  agenzia: [
    "Tutto del piano Agente",
    "Dashboard agenzia multi-agente",
    "Export PDF con logo agenzia",
    "Annunci attivi nella zona",
    "Storico scansioni illimitato",
    "Supporto prioritario via email",
    "Dispositivo vincolato per durata abbonamento",
  ],
  enterprise: [
    "Tutto del piano Agente",
    "Dashboard agenzia multi-agente",
    "Export PDF con logo agenzia",
    "Annunci attivi nella zona",
    "Storico scansioni illimitato",
    "Supporto prioritario",
  ],
};

const planMeta: Record<PlanKey, { users: string; scans: string; popular: boolean }> = {
  agente: { users: "1 account", scans: "80 scansioni/mese", popular: false },
  agenzia: { users: "3 account inclusi", scans: "250 scansioni/mese", popular: true },
  enterprise: { users: "10 account inclusi", scans: "800 scansioni/mese", popular: false },
};

import { HAS_REAL_ANNUAL_PRICES } from "@/lib/plans";

interface TrialExpiredScreenProps {
  scansUsed: number;
  canManageBilling?: boolean;
  subscriptionStatus?: string | null;
}

export const TrialExpiredScreen = ({ scansUsed, canManageBilling, subscriptionStatus }: TrialExpiredScreenProps) => {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const { toast } = useToast();

  const billingReady = isBillingReady();
  const isPastDue = subscriptionStatus === "past_due";

  const handleCheckout = async (key: PlanKey) => {
    if (!billingReady) {
      toast({ title: "Non disponibile", description: "Il sistema di pagamento sarà attivo a breve. Contattaci per informazioni.", variant: "default" });
      return;
    }
    const plan = PLANS[key];
    const priceId = plan.price_id;

    if (!priceId) {
      toast({ title: "Non disponibile", description: "Questo piano non è ancora disponibile.", variant: "default" });
      return;
    }

    setLoadingPlan(key);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });

      // Handle 409 duplicate subscription
      if (error) {
        const parsed = typeof error === "object" && "message" in error ? (error as { message: string }).message : String(error);
        if (parsed.includes("409") || parsed.includes("already_subscribed")) {
          toast({ title: "Abbonamento esistente", description: "Hai già un abbonamento attivo.", variant: "default" });
          return;
        }
        if (parsed.includes("use_customer_portal")) {
          toast({ title: "Pagamento in sospeso", description: "Aggiorna il metodo di pagamento dal portale di gestione.", variant: "default" });
          return;
        }
        throw error;
      }
      if (data?.error_code === "already_subscribed") {
        toast({ title: "Abbonamento esistente", description: "Hai già un abbonamento attivo.", variant: "default" });
        return;
      }
      if (data?.error_code === "use_customer_portal") {
        toast({ title: "Pagamento in sospeso", description: "Aggiorna il metodo di pagamento dal portale di gestione.", variant: "default" });
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e: unknown) {
      toast({ title: "Errore", description: e instanceof Error ? e.message : "Errore sconosciuto", variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: unknown) {
      toast({ title: "Errore", description: e instanceof Error ? e.message : "Errore sconosciuto", variant: "destructive" });
    } finally {
      setLoadingPortal(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12 py-safe">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <AlertTriangle className="h-7 w-7 text-primary" />
        </div>
        <h1 className="mt-5 text-2xl font-black text-foreground sm:text-3xl">
          {isPastDue ? "Pagamento in sospeso" : "Periodo di prova concluso"}
        </h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg" style={{ textWrap: "balance" } as React.CSSProperties}>
          {isPastDue ? (
            <>
              Il tuo abbonamento ha un pagamento in sospeso. Aggiorna il metodo di pagamento per ripristinare l'accesso.
            </>
          ) : (
            <>
              Hai utilizzato <strong className="text-foreground">{scansUsed} scansioni</strong> durante i 3 giorni di prova.
              {billingReady
                ? " Per continuare a utilizzare Sottra, scegli il piano più adatto."
                : ` Per attivare un piano, contattaci a ${APP_BRAND.supportEmail}.`}
            </>
          )}
        </p>

        {/* past_due: show portal CTA prominently */}
        {isPastDue && canManageBilling && billingReady && (
          <div className="mt-8">
            <Button
              size="lg"
              className="gap-2"
              onClick={handleManageSubscription}
              disabled={loadingPortal}
            >
              <CreditCard className="h-4 w-4" />
              {loadingPortal ? "Caricamento…" : "Gestisci abbonamento"}
            </Button>
          </div>
        )}

        {!isPastDue && (
          <>
            <p className="mt-2 text-xs text-muted-foreground">
              Nessun dato bancario è stato richiesto durante la prova · Paghi solo se decidi di proseguire
            </p>

            {billingReady && (
              <>
                {/* Annual toggle — only shown when real annual price IDs exist */}
                {HAS_REAL_ANNUAL_PRICES && (
                  <div className="mt-8 inline-flex items-center rounded-full border border-border bg-muted/50 p-1">
                    <button className="rounded-full px-4 py-1.5 text-sm font-medium bg-background text-foreground shadow-sm">
                      Mensile
                    </button>
                    <button
                      className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground"
                      disabled
                    >
                      Annuale
                      <span className="ml-1 text-xs text-primary">2 mesi gratis</span>
                    </button>
                  </div>
                )}

                <div className="mt-8 grid gap-6 lg:grid-cols-3">
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
                          {loadingPlan === key ? "Caricamento…" : `Scegli ${plan.name}`}
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TrialExpiredScreen;
