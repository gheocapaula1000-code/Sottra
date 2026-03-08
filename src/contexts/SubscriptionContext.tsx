import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPlanByProductId, PlanKey } from "@/lib/plans";

interface TrialInfo {
  active: boolean;
  scans_used: number;
  max_scans: number;
  trial_end: string;
}

interface SubscriptionState {
  loading: boolean;
  subscribed: boolean;
  planKey: PlanKey | null;
  subscriptionEnd: string | null;
  trial: TrialInfo | null;
  canScan: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionState>({
  loading: true,
  subscribed: false,
  planKey: null,
  subscriptionEnd: null,
  trial: null,
  canScan: false,
  isAdmin: false,
  refresh: async () => {},
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [planKey, setPlanKey] = useState<PlanKey | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [trial, setTrial] = useState<TrialInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const refresh = useCallback(async () => {
    if (!session) {
      setLoading(false);
      setSubscribed(false);
      setPlanKey(null);
      setTrial(null);
      setIsAdmin(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;

      setSubscribed(data.subscribed);
      setPlanKey(data.product_id ? getPlanByProductId(data.product_id) : null);
      setSubscriptionEnd(data.subscription_end);
      setTrial(data.trial);
    } catch (e) {
      console.error("Failed to check subscription:", e);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh every 60s
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [session, refresh]);

  const canScan = subscribed || (trial?.active ?? false);

  return (
    <SubscriptionContext.Provider value={{ loading, subscribed, planKey, subscriptionEnd, trial, canScan, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
