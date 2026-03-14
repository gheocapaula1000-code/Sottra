import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from "react";
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
  accessResolved: boolean;
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
  accessResolved: false,
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

const isAuthIssueMessage = (msg: string) => {
  const lower = msg.toLowerCase();
  return (
    msg.includes("Auth session missing") ||
    lower.includes("auth") ||
    msg.includes("401") ||
    msg.includes("non-2xx")
  );
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
  const [accessResolved, setAccessResolved] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [planKey, setPlanKey] = useState<PlanKey | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [trial, setTrial] = useState<TrialInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const accessResolvedRef = useRef(false);

  const setResolved = useCallback((resolved: boolean) => {
    accessResolvedRef.current = resolved;
    setAccessResolved(resolved);
  }, []);

  const applyDefaults = useCallback((resolved: boolean) => {
    setSubscribed(false);
    setPlanKey(null);
    setSubscriptionEnd(null);
    setTrial(null);
    setIsAdmin(false);
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

    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    try {
      let responseData: unknown = null;
      let responseErrorMessage: string | null = null;
      let currentToken = accessToken;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { data, error } = await supabase.functions.invoke("check-subscription", {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });

        if (!error) {
          responseData = data;
          responseErrorMessage = null;
          break;
        }

        const msg = typeof error === "object" && error !== null && "message" in error
          ? (error as { message: string }).message
          : String(error);

        responseErrorMessage = msg;
        const isAuthIssue = isAuthIssueMessage(msg);

        if (isAuthIssue && attempt < 2) {
          console.warn(`[Subscription] auth not ready, retry ${attempt + 1}/2`);
          await wait(180);

          const { data: freshSessionData } = await supabase.auth.getSession();
          if (freshSessionData.session?.access_token) {
            currentToken = freshSessionData.session.access_token;
          }

          continue;
        }

        break;
      }

      if (responseErrorMessage) {
        if (isAuthIssueMessage(responseErrorMessage)) {
          console.warn("[Subscription] access unresolved after auth retries, keeping neutral state");
          setResolved(false);
          setLoading(false);
          return;
        }

        console.error("[Subscription] check failed:", responseErrorMessage);
        applyDefaults(false);
        return;
      }

      const parsed = parsePayload(responseData);
      setSubscribed(parsed.subscribed);
      setPlanKey(parsed.planKey);
      setSubscriptionEnd(parsed.subscriptionEnd);
      setTrial(parsed.trial);
      setIsAdmin(parsed.isAdmin);
      setResolved(true);
      setLoading(false);
    } catch (e) {
      console.error("[Subscription] unexpected error:", e);
      applyDefaults(false);
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

  const isOwner = isOwnerEmail(session?.user?.email);
  const canScan = isOwner || isAdmin || subscribed || (trial?.active ?? false);

  return (
    <SubscriptionContext.Provider value={{ loading, accessResolved, subscribed, planKey, subscriptionEnd, trial, canScan, isAdmin, isOwner, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
