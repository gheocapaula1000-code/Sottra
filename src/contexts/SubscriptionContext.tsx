/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPlanByProductId, getPlanByPriceId, PlanKey } from "@/lib/plans";
import { setBillingReady } from "@/lib/billing";

interface TrialInfo {
  active: boolean;
  scans_used: number;
  max_scans: number;
  trial_end: string;
}

interface SubscriptionState {
  loading: boolean;
  accessResolved: boolean;
  /** True only after at least one successful check-subscription response was parsed. */
  checked: boolean;
  subscribed: boolean;
  planKey: PlanKey | null;
  subscriptionEnd: string | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  trial: TrialInfo | null;
  canScan: boolean;
  canManageBilling: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionState>({
  loading: true,
  accessResolved: false,
  checked: false,
  subscribed: false,
  planKey: null,
  subscriptionEnd: null,
  subscriptionStatus: null,
  cancelAtPeriodEnd: false,
  trial: null,
  canScan: false,
  canManageBilling: false,
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
  subscriptionStatus: null as string | null,
  cancelAtPeriodEnd: false,
  trial: null as TrialInfo | null,
  isAdmin: false,
  isOwner: false,
};

/** Validate that payload is a non-null object with expected shape */
function parsePayload(data: unknown): typeof SAFE_DEFAULTS {
  if (!data || typeof data !== "object") {
    console.warn("[Subscription] malformed payload — not an object");
    return { ...SAFE_DEFAULTS };
  }

  const d = data as Record<string, unknown>;

  const subscribed = d.subscribed === true;
  const isAdmin = d.is_admin === true;
  const isOwner = d.is_owner === true;
  const subscriptionEnd = typeof d.subscription_end === "string" ? d.subscription_end : null;
  const subscriptionStatus = typeof d.subscription_status === "string" ? d.subscription_status : null;
  const cancelAtPeriodEnd = d.cancel_at_period_end === true;

  // Resolve plan from product_id or price_id
  let planKey: PlanKey | null = null;
  if (typeof d.product_id === "string") planKey = getPlanByProductId(d.product_id);
  if (!planKey && typeof d.price_id === "string") planKey = getPlanByPriceId(d.price_id);

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

  return { subscribed, planKey, subscriptionEnd, subscriptionStatus, cancelAtPeriodEnd, trial, isAdmin, isOwner };
}

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accessResolved, setAccessResolved] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [planKey, setPlanKey] = useState<PlanKey | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [trial, setTrial] = useState<TrialInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [checked, setChecked] = useState(false);
  const accessResolvedRef = useRef(false);

  const setResolved = useCallback((resolved: boolean) => {
    accessResolvedRef.current = resolved;
    setAccessResolved(resolved);
  }, []);

  const applyDefaults = useCallback((resolved: boolean) => {
    setSubscribed(false);
    setPlanKey(null);
    setSubscriptionEnd(null);
    setSubscriptionStatus(null);
    setCancelAtPeriodEnd(false);
    setTrial(null);
    setIsAdmin(false);
    setIsOwner(false);
    setChecked(true);
    setBillingReady(false);
    setResolved(resolved);
    if (!authLoading) setLoading(false);
  }, [authLoading, setResolved]);

  const refresh = useCallback(async () => {
    if (authLoading) return;

    if (!session) {
      applyDefaults(true);
      return;
    }

    let activeSession = session;
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) activeSession = data.session;
    } catch {
      // Ignore and fallback to context session
    }

    const expiresAt = activeSession.expires_at;
    if (expiresAt && expiresAt * 1000 < Date.now()) {
      console.warn("[Subscription] session expired, skipping");
      applyDefaults(true);
      return;
    }

    const accessToken = activeSession.access_token;
    if (!accessToken) {
      console.warn("[Subscription] missing access token, skipping");
      applyDefaults(true);
      return;
    }

    const isBootstrap = !accessResolvedRef.current;
    if (isBootstrap) {
      setLoading(true);
      setResolved(false);
    }

    try {
      let responseData: unknown = null;

      try {
        const result = await supabase.functions.invoke("check-subscription");
        responseData = result.data;

        if (result.error) {
          const msg = typeof result.error === "object" && "message" in result.error
            ? (result.error as { message: string }).message
            : String(result.error);
          console.warn("[Subscription] invoke error (non-fatal):", msg);
          applyDefaults(true);
          return;
        }
      } catch (invokeError) {
        console.warn("[Subscription] invoke exception (non-fatal):", invokeError);
        applyDefaults(true);
        return;
      }

      const body = responseData as Record<string, unknown> | null;
      if (body && typeof body.error === "string" && body.error) {
        console.warn("[Subscription] function error (non-fatal):", body.error);
        applyDefaults(true);
        return;
      }

      const parsed = parsePayload(responseData);
      setSubscribed(parsed.subscribed);
      setPlanKey(parsed.planKey);
      setSubscriptionEnd(parsed.subscriptionEnd);
      setSubscriptionStatus(parsed.subscriptionStatus);
      setCancelAtPeriodEnd(parsed.cancelAtPeriodEnd);
      setTrial(parsed.trial);
      setIsAdmin(parsed.isAdmin);
      setIsOwner(parsed.isOwner);
      setChecked(true);
      setResolved(true);
      setLoading(false);

      // Sync billing readiness from server response
      const body2 = responseData as Record<string, unknown> | null;
      setBillingReady(body2?.billing_active === true);
    } catch (e) {
      console.error("[Subscription] unexpected error (non-fatal):", e);
      applyDefaults(true);
    }
  }, [session, authLoading, applyDefaults, setResolved]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      const expiresAt = session.expires_at;
      if (expiresAt && expiresAt * 1000 < Date.now()) {
        clearInterval(interval);
        return;
      }
      void refresh();
    }, 60000);
    return () => clearInterval(interval);
  }, [session, refresh]);

  // Auto-refresh on checkout return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.pathname);
      // Delay refresh to let webhook process
      const timer = setTimeout(() => void refresh(), 2000);
      return () => clearTimeout(timer);
    }
  }, [refresh]);

  // canScan: only active/trialing subscriptions or active trial
  const canScan = isOwner || isAdmin || subscribed || (trial?.active ?? false);
  // canManageBilling: also includes past_due (so user can fix payment)
  const canManageBilling = isOwner || isAdmin || subscribed || subscriptionStatus === "past_due";

  return (
    <SubscriptionContext.Provider value={{
      loading, accessResolved, checked, subscribed, planKey, subscriptionEnd,
      subscriptionStatus, cancelAtPeriodEnd, trial, canScan, canManageBilling, isAdmin, isOwner, refresh,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
