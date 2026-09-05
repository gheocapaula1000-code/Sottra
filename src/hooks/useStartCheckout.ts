import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PLANS, type PlanKey } from "@/lib/plans";
import {
  checkoutErrorMessage,
  createCheckoutSession,
  redirectToCheckout,
  type CheckoutFailureCode,
} from "@/lib/checkout";
import { rememberPendingPlan, clearPendingPlan } from "@/lib/pendingCheckout";

const SOFT_CODES: CheckoutFailureCode[] = [
  "already_subscribed",
  "use_customer_portal",
  "billing_inactive",
];

const TITLES: Record<CheckoutFailureCode, string> = {
  already_subscribed: "Abbonamento esistente",
  use_customer_portal: "Pagamento in sospeso",
  billing_inactive: "Non disponibile",
  invalid_plan: "Piano non valido",
  unknown: "Errore",
};

export function useStartCheckout() {
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);

  const startCheckout = useCallback(
    async (plan: PlanKey) => {
      if (!session) {
        rememberPendingPlan(plan);
        navigate(`/signup?plan=${plan}`);
        return;
      }

      setLoadingPlan(plan);
      try {
        const result = await createCheckoutSession(PLANS[plan].price_id);
        if (result.ok) {
          redirectToCheckout(result.url);
          return;
        }
        toast({
          title: TITLES[result.error_code],
          description: result.error || checkoutErrorMessage(result.error_code),
          variant: SOFT_CODES.includes(result.error_code) ? "default" : "destructive",
        });
      } finally {
        setLoadingPlan(null);
      }
    },
    [session, navigate, toast],
  );

  const startTrial = useCallback(() => {
    clearPendingPlan();
    navigate("/signup");
  }, [navigate]);

  return { startCheckout, startTrial, loadingPlan };
}
