import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useToast } from "@/hooks/use-toast";
import { PLANS } from "@/lib/plans";
import { createCheckoutSession, redirectToCheckout } from "@/lib/checkout";
import {
  consumePendingPlan,
  parsePlanKey,
  releaseCheckoutLaunchLock,
  takeCheckoutLaunchLock,
} from "@/lib/pendingCheckout";

/**
 * After login/signup (or email confirm landing on /app?plan=), start Stripe
 * Checkout for the chosen plan. Does not collect a card in-app.
 */
export default function PendingCheckoutRunner() {
  const location = useLocation();
  const { session } = useAuth();
  const { checked, loading, bootFailed, subscribed, isOwner, isAdmin } = useSubscription();
  const { toast } = useToast();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (!session || loading || !checked || bootFailed) return;

    const params = new URLSearchParams(location.search);
    if (params.get("checkout") === "success" || params.get("checkout") === "cancel") {
      consumePendingPlan();
      return;
    }

    const plan = parsePlanKey(params.get("plan")) ?? consumePendingPlan();
    if (!plan) return;

    if (subscribed || isOwner || isAdmin) {
      consumePendingPlan();
      stripPlanParam();
      return;
    }

    if (!takeCheckoutLaunchLock()) return;
    started.current = true;
    consumePendingPlan();
    stripPlanParam();

    void createCheckoutSession(PLANS[plan].price_id).then((result) => {
      if (result.ok) {
        redirectToCheckout(result.url);
        return;
      }
      releaseCheckoutLaunchLock();
      started.current = false;
      toast({
        title: "Checkout non avviato",
        description: result.error,
        variant: result.error_code === "unknown" ? "destructive" : "default",
      });
    });
  }, [session, loading, checked, bootFailed, subscribed, isOwner, isAdmin, location.search, toast]);

  return null;
}

function stripPlanParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("plan")) return;
  url.searchParams.delete("plan");
  const next = url.pathname + (url.search ? url.search : "");
  window.history.replaceState({}, "", next);
}
