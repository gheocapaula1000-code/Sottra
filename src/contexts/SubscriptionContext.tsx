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
  isAdmin: boolean;
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

/** Reset to safe defaults — never leaves UI in ambiguous state */
const SAFE_DEFAULTS = {
  subscribed: false,
  planKey: null as PlanKey | null,
  subscriptionEnd: null as string | null,
  trial: null as TrialInfo | null,
  isAdmin: false,
};

/** Validate that payload is a non-null object with expected shape */
function parsePayload(data: unknown): {
  subscribed: boolean;
  planKey: PlanKey | null;
  subscriptionEnd: string | null;
  trial: TrialInfo | null;
  isAdmin: boolean;
} {
  if (!data || typeof data !== "object") {
    console.warn("[Subscription] malformed payload — not an object");
    return { ...SAFE_DEFAULTS };
  }

  const d = data as Record<string, unknown>;

  const subscribed = d.subscribed === true;
  const isAdmin = d.is_admin === true;
  const subscriptionEnd = typeof d.subscription_end === "string" ? d.subscription_end : null;
  const planKey = typeof d.product_id === "string" ? getPlanByProductId(d.product_id) : null;

  let trial: TrialInfo | null = null;
  if (d.trial && typeof d.trial === "object") {
    const t = d.trial as Record<string, unknown>;
    trial = {
      active: t.active === true,
      scans_used: typeof t.scans_used === "number" ? t.scans_used : 0,
      max_scans: typeof t.max_scans === "number" ? t.max_scans : 5,
      trial_end: typeof t.trial_end === "string" ? t.trial_end : "",
    };
  }

  return { subscribed, planKey, subscriptionEnd, trial, isAdmin };
}

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [planKey, setPlanKey] = useState<PlanKey | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [trial, setTrial] = useState<TrialInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const applyDefaults = useCallback(() => {
    setSubscribed(false);
    setPlanKey(null);
    setSubscriptionEnd(null);
    setTrial(null);
    setIsAdmin(false);
    // Only mark loading done if auth is already resolved
    if (!authLoading) setLoading(false);
  }, [authLoading]);

  const refresh = useCallback(async () => {
    // While auth is still loading, stay in loading state — don't resolve yet
    if (authLoading) return;

    if (!session) {
      applyDefaults();
      return;
    }

    // Skip if JWT is expired
    const expiresAt = session.expires_at;
    if (expiresAt && expiresAt * 1000 < Date.now()) {
      console.warn("[Subscription] session expired, skipping");
      applyDefaults();
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");

      if (error) {
        const msg = typeof error === "object" && error !== null && "message" in error
          ? (error as { message: string }).message
          : String(error);

        const isAuthIssue =
          msg.includes("Auth session missing") ||
          msg.includes("auth") ||
          msg.includes("401") ||
          msg.includes("non-2xx");

        if (isAuthIssue) {
          console.warn("[Subscription] auth expired:", msg);
        } else {
          console.error("[Subscription] check failed:", msg);
        }
        applyDefaults();
        return;
      }

      const parsed = parsePayload(data);
      setSubscribed(parsed.subscribed);
      setPlanKey(parsed.planKey);
      setSubscriptionEnd(parsed.subscriptionEnd);
      setTrial(parsed.trial);
      setIsAdmin(parsed.isAdmin);
    } catch (e) {
      console.error("[Subscription] unexpected error:", e);
      applyDefaults();
      return;
    } finally {
      setLoading(false);
    }
  }, [session, authLoading, applyDefaults]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh every 60s while session is valid
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
