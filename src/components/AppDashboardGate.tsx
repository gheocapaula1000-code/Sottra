import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { TrialExpiredScreen } from "@/components/TrialExpiredScreen";
import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

const Dashboard = lazy(() => import("@/pages/Dashboard"));

const Loader = () => (
  <div className="flex min-h-svh items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
  </div>
);

/**
 * Retry UI shown when the first bootstrap of check-subscription fails
 * due to a transient error. Never shows TrialExpiredScreen in this state.
 */
const BootFailedRetry = ({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) => (
  <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
    <p className="text-muted-foreground">
      Impossibile verificare lo stato del tuo account. Potrebbe essere un problema temporaneo.
    </p>
    <Button onClick={onRetry} disabled={retrying} variant="outline" className="gap-2">
      <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
      {retrying ? "Riprovo…" : "Riprova"}
    </Button>
  </div>
);

/**
 * Unified gate for /app — single loading state, no flicker.
 * Decides between Dashboard, TrialExpiredScreen, or retry UI BEFORE mounting either.
 */
const AppDashboardGate = () => {
  const { session, loading: authLoading } = useAuth();
  const {
    loading: subLoading, accessResolved, checked, canScan,
    canManageBilling, trial, subscriptionStatus, bootFailed, refresh,
  } = useSubscription();

  // Single stable loader until everything is resolved
  if (authLoading || subLoading || (!accessResolved && !bootFailed) || (!checked && !bootFailed)) {
    return <Loader />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // First-boot transient error: show retry UI, never paywall
  if (bootFailed) {
    return <BootFailedRetry onRetry={() => void refresh()} retrying={subLoading} />;
  }

  // Trial expired / no scan access → show paywall
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
