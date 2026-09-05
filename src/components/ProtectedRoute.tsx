import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { parsePlanKey } from "@/lib/pendingCheckout";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (!session) {
    const plan = parsePlanKey(new URLSearchParams(location.search).get("plan"));
    const next = `${location.pathname}${location.search}`;
    const params = new URLSearchParams();
    params.set("next", next);
    if (plan) params.set("plan", plan);
    return <Navigate to={`/login?${params.toString()}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
