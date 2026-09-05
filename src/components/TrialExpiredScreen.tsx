import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard } from "lucide-react";
import { PLANS, VAT_NOTICE } from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { APP_BRAND } from "@/lib/legalEntity";
import { useStartCheckout } from "@/hooks/useStartCheckout";
import PlanCheckoutGrid from "@/components/PlanCheckoutGrid";

interface TrialExpiredScreenProps {
  scansUsed: number;
  canManageBilling?: boolean;
  subscriptionStatus?: string | null;
}

export const TrialExpiredScreen = ({ scansUsed, canManageBilling, subscriptionStatus }: TrialExpiredScreenProps) => {
  const [loadingPortal, setLoadingPortal] = useState(false);
  const { toast } = useToast();
  const { startCheckout, loadingPlan } = useStartCheckout();

  const isPastDue = subscriptionStatus === "past_due";

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
              {" "}Per continuare, abbonati ad Agente, Agenzia o Rete. Il checkout Stripe si apre in una pagina sicura.
            </>
          )}
        </p>

        {isPastDue && (
          <div className="mt-8 space-y-4">
            {canManageBilling && (
              <Button
                size="lg"
                className="gap-2"
                onClick={handleManageSubscription}
                disabled={loadingPortal}
              >
                <CreditCard className="h-4 w-4" />
                {loadingPortal ? "Caricamento…" : "Gestisci abbonamento"}
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              Se il portale non si apre, scrivi a{" "}
              <a href={`mailto:${APP_BRAND.supportEmail}`} className="text-primary underline">
                {APP_BRAND.supportEmail}
              </a>
            </p>
          </div>
        )}

        {!isPastDue && (
          <>
            <p className="mt-2 text-xs text-muted-foreground">
              Nessun dato bancario è stato richiesto durante la prova · Paghi solo se decidi di proseguire
            </p>
            <p className="mt-6 text-xs text-muted-foreground">{VAT_NOTICE}</p>
            <PlanCheckoutGrid
              onCheckout={startCheckout}
              loadingPlan={loadingPlan}
              ctaLabel={(key) => `Abbonati a ${PLANS[key].name}`}
            />
            <p className="mt-8 text-sm text-muted-foreground">
              Serve aiuto?{" "}
              <a href={`mailto:${APP_BRAND.supportEmail}`} className="text-primary underline">
                {APP_BRAND.supportEmail}
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default TrialExpiredScreen;
