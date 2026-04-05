import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";

/**
 * Blocks access to /scan and /result when:
 * - User is authenticated
 * - Not owner/admin
 * - No active subscription
 * - Trial expired or scans exhausted
 */
const TrialProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading: authLoading } = useAuth();
  const { loading: subLoading, accessResolved, canScan, isAdmin } = useSubscription();

  if (authLoading || subLoading || !accessResolved) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Admin/owner bypass
  if (isAdmin) {
    return <>{children}</>;
  }

  // Trial expired / no subscription
  if (!canScan) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};

export default TrialProtectedRoute;
