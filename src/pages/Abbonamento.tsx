import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import PlanCheckoutGrid from "@/components/PlanCheckoutGrid";
import { useStartCheckout } from "@/hooks/useStartCheckout";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { isBillingReady } from "@/lib/billing";
import { PLANS, VAT_NOTICE } from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Abbonamento() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscribed, planKey, trial, isOwner, isAdmin, canManageBilling } = useSubscription();
  const { startCheckout, loadingPlan } = useStartCheckout();
  const { toast } = useToast();
  const [loadingPortal, setLoadingPortal] = useState(false);

  const billingReady = isBillingReady();
  const showPortal = billingReady && canManageBilling && !isAdmin && !isOwner;
  const trialActive = trial?.active === true && !subscribed;

  const handlePortal = async () => {
    setLoadingPortal(true);
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
    } finally {
      setLoadingPortal(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader
        rightContent={
          <>
            <span className="hidden md:inline text-xs text-muted-foreground truncate max-w-[180px]">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => navigate("/app")}>
              Pannello
            </Button>
          </>
        }
      />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-black text-foreground sm:text-3xl">
          {subscribed ? "Il tuo abbonamento" : "Abbonati a Sottra"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {subscribed && planKey ? (
            <>Sei sul piano <strong className="text-foreground">{PLANS[planKey].name}</strong>. Puoi gestire pagamento e fatture dal portale Stripe.</>
          ) : trialActive ? (
            <>La prova gratuita resta attiva (3 giorni, 5 scansioni, nessuna carta). Abbonati quando vuoi: il checkout Stripe si apre in una pagina sicura.</>
          ) : (
            <>Scegli Agente, Agenzia o Rete. Nessun extra a consumo · {VAT_NOTICE}.</>
          )}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{VAT_NOTICE}</p>

        {showPortal && (
          <div className="mt-6">
            <Button className="gap-2" onClick={handlePortal} disabled={loadingPortal}>
              <CreditCard className="h-4 w-4" />
              {loadingPortal ? "Caricamento…" : "Gestisci abbonamento"}
            </Button>
          </div>
        )}

        {isOwner || isAdmin ? (
          <p className="mt-8 text-sm text-muted-foreground">
            Questo account ha accesso interno. Per un piano a pagamento usa un account acquirente.
          </p>
        ) : subscribed ? (
          <p className="mt-8 text-sm text-muted-foreground">
            Per cambiare piano o aggiornare la carta usa il portale di gestione.
          </p>
        ) : (
          <PlanCheckoutGrid
            onCheckout={startCheckout}
            loadingPlan={loadingPlan}
            currentPlan={planKey}
            ctaLabel={(key) => `Abbonati a ${PLANS[key].name}`}
          />
        )}
      </main>
    </div>
  );
}
