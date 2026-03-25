import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { TrialExpiredScreen } from "@/components/TrialExpiredScreen";
import { lazy, Suspense } from "react";

const Dashboard = lazy(() => import("@/pages/Dashboard"));

const Loader = () => (
  <div className="flex min-h-svh items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
  </div>
);

/**
 * Unified gate for /app — single loading state, no flicker.
 * Decides between Dashboard and TrialExpiredScreen BEFORE mounting either.
 */
const AppDashboardGate = () => {
  const { session, loading: authLoading } = useAuth();
  const { loading: subLoading, accessResolved, checked, canScan, canManageBilling, trial, subscriptionStatus } = useSubscription();

  // Single stable loader until everything is resolved
  if (authLoading || subLoading || !accessResolved || !checked) {
    return <Loader />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Trial expired / no scan access → show paywall
  // But pass canManageBilling so past_due users can open the portal
  if (!canScan) {
    return (
      <TrialExpiredScreen
        scansUsed={trial?.scans_used ?? 0}
        canManageBilling={canManageBilling}
        subscriptionStatus={subscriptionStatus}
      />
    );
  }

  return (
    <Suspense fallback={<Loader />}>
      <Dashboard />
    </Suspense>
  );
};

export default AppDashboardGate;
