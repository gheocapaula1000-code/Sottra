import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard } from "lucide-react";
import { VAT_NOTICE } from "@/lib/plans";
import { isBillingReady } from "@/lib/billing";
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

  const billingReady = isBillingReady();
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
              {billingReady
                ? " Per continuare a utilizzare Sottra, scegli il piano più adatto."
                : ` Per attivare un piano, contattaci a ${APP_BRAND.supportEmail}.`}
            </>
          )}
        </p>

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

        {isPastDue && !billingReady && (
          <p className="mt-6 text-sm text-muted-foreground">
            Per sbloccare l'account scrivi a{" "}
            <a href={`mailto:${APP_BRAND.supportEmail}`} className="text-primary underline">
              {APP_BRAND.supportEmail}
            </a>
          </p>
        )}

        {!isPastDue && (
          <>
            <p className="mt-2 text-xs text-muted-foreground">
              Nessun dato bancario è stato richiesto durante la prova · Paghi solo se decidi di proseguire
            </p>

            {billingReady && (
              <>
                <p className="mt-6 text-xs text-muted-foreground">{VAT_NOTICE}</p>
                <PlanCheckoutGrid onCheckout={startCheckout} loadingPlan={loadingPlan} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TrialExpiredScreen;
