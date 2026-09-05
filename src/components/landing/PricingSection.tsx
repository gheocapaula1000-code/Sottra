import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2 } from "lucide-react";
import {
  PLANS,
  PLAN_DESCRIPTIONS,
  PLAN_FEATURES,
  PLAN_POPULAR,
  VAT_NOTICE,
  planScansLabel,
  planUsersLabel,
  type PlanKey,
} from "@/lib/plans";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useStartCheckout } from "@/hooks/useStartCheckout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isBillingReady } from "@/lib/billing";

const planOrder: PlanKey[] = ["agente", "agenzia", "rete"];

export default function PricingSection() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { subscribed, planKey, canManageBilling, isOwner, isAdmin } = useSubscription();
  const { startCheckout, startTrial, loadingPlan } = useStartCheckout();
  const { toast } = useToast();

  const loggedIn = Boolean(session);
  const showTrialCta = !loggedIn;
  const canOpenPortal = loggedIn && isBillingReady() && canManageBilling && !isAdmin && !isOwner;

  const handlePortal = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: unknown) {
      toast({
        title: "Errore",
        description: e instanceof Error ? e.message : "Errore sconosciuto",
        variant: "destructive",
      });
    }
  };

  return (
    <section id="pricing" className="px-5 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-2xl font-black text-foreground sm:text-3xl lg:text-4xl">
            Listino flat, tetto incluso, nessun extra a consumo
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base" style={{ textWrap: "balance" } as React.CSSProperties}>
            Prova gratuita iniziale: 3 giorni, 5 scansioni, accesso completo. Zero carta di credito.
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground sm:text-sm">
            Al termine del trial serve un abbonamento attivo. Esaurito il tetto di scansioni ci si ferma
            fino al mese successivo, oppure si passa al piano sopra.
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground sm:text-sm">
            {VAT_NOTICE}
          </p>
        </div>


        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {planOrder.map((key) => {
            const plan = PLANS[key];
            const popular = key === PLAN_POPULAR;
            const isCurrent = subscribed && planKey === key;
            return (
              <Card
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-5 sm:p-7 ${
                  popular
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-card"
                }`}
              >
                {popular && (
                  <Badge className="absolute -top-3 left-5 bg-primary text-primary-foreground text-xs">
                    Più popolare
                  </Badge>
                )}
                <h3 className="text-lg font-bold text-foreground sm:text-xl">
                  {plan.name}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  {PLAN_DESCRIPTIONS[key]}
                </p>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-foreground sm:text-4xl">
                    €{plan.price}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    /mese
                  </span>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  Tetto flat incluso · {VAT_NOTICE}
                </p>


                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-[10px] sm:text-xs">
                    {planScansLabel(plan.scans)}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] sm:text-xs">
                    {planUsersLabel(plan.users)}
                  </Badge>
                </div>

                <Separator className="my-5" />

                <ul className="flex-1 space-y-2.5">
                  {PLAN_FEATURES[key].map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-xs text-foreground/80 sm:text-sm"
                    >
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 text-primary" />
                      <span className="break-words">{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button
                    className="mt-5 w-full"
                    variant={canOpenPortal ? "default" : "outline"}
                    size="lg"
                    disabled={!canOpenPortal}
                    onClick={() => void handlePortal()}
                  >
                    {canOpenPortal ? "Gestisci abbonamento" : "Piano attuale"}
                  </Button>
                ) : subscribed ? (
                  <Button
                    className="mt-5 w-full"
                    variant="outline"
                    size="lg"
                    disabled={!canOpenPortal}
                    onClick={() => void handlePortal()}
                  >
                    {canOpenPortal ? "Cambia piano" : "Piano non selezionato"}
                  </Button>
                ) : (
                  <>
                    <Button
                      className="mt-5 w-full"
                      variant={popular ? "default" : "outline"}
                      size="lg"
                      disabled={loadingPlan !== null}
                      onClick={() => void startCheckout(key)}
                    >
                      {loadingPlan === key ? "Caricamento…" : `Abbonati — ${plan.name}`}
                    </Button>
                    {showTrialCta && (
                      <Button
                        className="mt-2 w-full"
                        variant="ghost"
                        size="lg"
                        onClick={startTrial}
                      >
                        Inizia la prova gratuita
                      </Button>
                    )}
                    {loggedIn && (
                      <Button
                        className="mt-2 w-full"
                        variant="ghost"
                        size="lg"
                        onClick={() => navigate("/app")}
                      >
                        Continua la prova
                      </Button>
                    )}
                  </>
                )}
              </Card>
            );
          })}
        </div>

        <div className="mx-auto mt-10 max-w-2xl space-y-2 text-center text-xs text-muted-foreground sm:text-sm">
          <p>
            Copertura: tutta Italia, con quotazione OMI ufficiale quando il GPS cade dentro il poligono
            della microzona. Solo su Padova le sette aree sono nominate una per una.
          </p>
          <p>
            L'agente salva una volta il WhatsApp dell'agenzia e invia il report in un tap.
          </p>
          <p>
            Le stime restano stime: nessun dato catastale inventato, nessuna promessa sulla vendita del
            singolo civico.
          </p>
        </div>
      </div>

    </section>
  );
}
