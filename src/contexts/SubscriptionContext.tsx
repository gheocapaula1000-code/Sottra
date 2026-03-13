import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPlanByProductId, PlanKey } from "@/lib/plans";
import { isOwnerEmail } from "@/lib/ownerConfig";

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
  /** Has admin role or is owner — use for permission checks */
  isAdmin: boolean;
  /** Is the super-owner account — use ONLY for showing admin panel link */
  isOwner: boolean;
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
  isOwner: false,
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

    // Skip if JWT is expired (avoids 500 "Auth session missing")
    const expiresAt = session.expires_at;
    if (expiresAt && expiresAt * 1000 < Date.now()) {
      console.warn("[Subscription] Session expired, skipping check-subscription");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) {
        const msg = typeof error === "object" && error !== null && "message" in error ? (error as { message: string }).message : String(error);
        // Treat auth / 401 / 403 errors as session expiry, not app crash
        const isAuthIssue = msg.includes("Auth session missing") || msg.includes("auth") || msg.includes("401") || msg.includes("non-2xx");
        if (isAuthIssue) {
          console.warn("[Subscription] Auth expired during check:", msg);
          setLoading(false);
          return;
        }
        throw error;
      }

      setSubscribed(data.subscribed);
      setPlanKey(data.product_id ? getPlanByProductId(data.product_id) : null);
      setSubscriptionEnd(data.subscription_end);
      setTrial(data.trial);
      setIsAdmin(data.is_admin ?? false);
    } catch (e) {
      console.error("Failed to check subscription:", e);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh every 60s — only while session is valid
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      const expiresAt = session.expires_at;
      if (expiresAt && expiresAt * 1000 < Date.now()) {
        clearInterval(interval);
        return;
      }
      refresh();
    }, 60000);
    return () => clearInterval(interval);
  }, [session, refresh]);

  const isOwner = isOwnerEmail(session?.user?.email);
  const canScan = isOwner || isAdmin || subscribed || (trial?.active ?? false);

  return (
    <SubscriptionContext.Provider value={{ loading, subscribed, planKey, subscriptionEnd, trial, canScan, isAdmin, isOwner, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
