import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";

const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading: authLoading } = useAuth();
  const { loading: subLoading, accessResolved, isAdmin, isOwner } = useSubscription();

  if (authLoading || subLoading || !accessResolved) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin && !isOwner) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};

export default ProtectedAdminRoute;
