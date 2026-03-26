import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { TrialExpiredScreen } from "@/components/TrialExpiredScreen";
import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = lazy(() => import("@/pages/Dashboard"));

const Loader = () => (
  <div className="flex min-h-svh items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
  </div>
);

/** Human-readable labels for diagnostic codes */
const DIAGNOSTIC_LABELS: Record<string, string> = {
  NETWORK_ERROR: "Backend o rete non raggiungibile — controlla la connessione.",
  INVOKE_ERROR: "Errore tecnico di invocazione del servizio.",
  CORS_ORIGIN_BLOCKED: "Richiesta bloccata dalla policy di origine consentita.",
  FUNCTION_ERROR: "Errore nel servizio di verifica abbonamento.",
  MALFORMED_RESPONSE: "Risposta non valida dal server.",
  UNEXPECTED_ERROR: "Errore imprevisto — riprova tra poco.",
  UNKNOWN_BOOT_FAILURE: "Errore di avvio sconosciuto — riprova tra poco.",
  SELF_TEST_UNAVAILABLE: "Servizio di diagnostica non raggiungibile.",
  fatal: "Errore interno del server.",
  init_error: "Errore di configurazione del server.",
  CHECK_SUBSCRIPTION_FAILED: "Impossibile verificare lo stato dell'account.",
  origin_not_allowed: "Origine non autorizzata — contatta il supporto.",
  owner_bootstrap_missing: "Account owner non configurato — contatta il supporto.",
  owner_bootstrap_failed: "Bootstrap owner non riuscito — riprova o contatta il supporto.",
  billing_not_configured: "Sistema di pagamento non ancora configurato.",
};

interface SelfTestResult {
  session_present: boolean;
  user_email: string;
  check_reachable: boolean;
  check_code: string;
  billing_configured: boolean;
  owner_match: boolean;
  admin_match: boolean;
  bypass_match: boolean;
  origin_allowed: boolean;
  owner_bootstrap_state: "matched" | "missing" | "failed" | "not_applicable";
}

/**
 * Retry UI shown when the first bootstrap of check-subscription fails
 * due to a transient error. Shows diagnostic code and self-test button.
 */
const BootFailedRetry = ({
  onRetry,
  retrying,
  errorCode,
}: {
  onRetry: () => void;
  retrying: boolean;
  errorCode: string | null;
}) => {
  const [selfTest, setSelfTest] = useState<SelfTestResult | null>(null);
  const [selfTestFailed, setSelfTestFailed] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: "local" });
  };

  const handleSelfTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("diagnostics", {
        body: { action: "self-test" },
      });
      if (!error && data && typeof data === "object") {
        setSelfTest(data as SelfTestResult);
      } else {
        // Server responded but with an error — show client-side fallback
        setSelfTestFailed(true);
      }
    } catch {
      // Backend completely unreachable — show client-side fallback diagnostics
      setSelfTestFailed(true);
    } finally {
      setTesting(false);
    }
  };

  const displayCode = errorCode || "UNKNOWN_BOOT_FAILURE";
  const label = DIAGNOSTIC_LABELS[displayCode] ?? displayCode;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="text-muted-foreground">
        Impossibile verificare lo stato del tuo account. Potrebbe essere un problema temporaneo.
      </p>
      <p className="rounded-md bg-muted px-3 py-1.5 font-mono text-xs text-muted-foreground">
        {displayCode}: {label}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={onRetry} disabled={retrying} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
          {retrying ? "Riprovo…" : "Riprova"}
        </Button>
        <Button onClick={handleSelfTest} disabled={testing} variant="outline" className="gap-2">
          <ShieldCheck className="h-4 w-4" />
          {testing ? "Verifico…" : "Verifica accesso"}
        </Button>
        <Button onClick={handleSignOut} variant="ghost" className="gap-2">
          <LogOut className="h-4 w-4" />
          Esci e rientra
        </Button>
      </div>

      {selfTestFailed && !selfTest && (
        <div className="mt-4 w-full max-w-sm rounded-lg border border-border bg-card p-4 text-left text-sm">
          <h4 className="mb-2 font-semibold text-foreground">Diagnostica locale</h4>
          <p className="mb-2 rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
            SELF_TEST_UNAVAILABLE: {DIAGNOSTIC_LABELS.SELF_TEST_UNAVAILABLE}
          </p>
          <dl className="space-y-1 text-muted-foreground">
            <div className="flex justify-between">
              <dt>Origin corrente</dt>
              <dd className="font-mono text-xs">{typeof window !== "undefined" ? window.location.origin : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Codice bootstrap</dt>
              <dd className="font-mono text-xs">{displayCode}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Backend raggiungibile</dt>
              <dd className="text-destructive">✗ no</dd>
            </div>
          </dl>
        </div>
      )}

      {selfTest && (
        <div className="mt-4 w-full max-w-sm rounded-lg border border-border bg-card p-4 text-left text-sm">
          <h4 className="mb-2 font-semibold text-foreground">Diagnostica accesso</h4>
          <dl className="space-y-1 text-muted-foreground">
            <div className="flex justify-between">
              <dt>Sessione</dt>
              <dd className={selfTest.session_present ? "text-green-600" : "text-destructive"}>
                {selfTest.session_present ? "✓ presente" : "✗ assente"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Email</dt>
              <dd className="font-mono text-xs">{selfTest.user_email}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Origine autorizzata</dt>
              <dd className={selfTest.origin_allowed ? "text-green-600" : "text-destructive"}>
                {selfTest.origin_allowed ? "✓ sì" : "✗ no"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Billing configurato</dt>
              <dd className={selfTest.billing_configured ? "text-green-600" : "text-amber-600"}>
                {selfTest.billing_configured ? "✓ sì" : "✗ no"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Owner bootstrap</dt>
              <dd className={selfTest.owner_match ? "text-green-600" : "text-muted-foreground"}>
                {selfTest.owner_match ? "✓ match" : "— no match"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Admin</dt>
              <dd className={selfTest.admin_match ? "text-green-600" : "text-muted-foreground"}>
                {selfTest.admin_match ? "✓ sì" : "— no"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Bypass accesso</dt>
              <dd className={selfTest.bypass_match ? "text-green-600" : "text-muted-foreground"}>
                {selfTest.bypass_match ? "✓ sì" : "— no"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Servizio raggiungibile</dt>
              <dd className={selfTest.check_reachable ? "text-green-600" : "text-destructive"}>
                {selfTest.check_reachable ? "✓ sì" : "✗ no"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Codice risposta</dt>
              <dd className="font-mono text-xs">{selfTest.check_code}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Owner bootstrap state</dt>
              <dd className={
                selfTest.owner_bootstrap_state === "matched" ? "text-green-600" :
                selfTest.owner_bootstrap_state === "failed" ? "text-destructive" :
                "text-muted-foreground"
              }>
                {selfTest.owner_bootstrap_state}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
};

/**
 * Unified gate for /app — single loading state, no flicker.
 * Decides between Dashboard, TrialExpiredScreen, or retry UI BEFORE mounting either.
 */
const AppDashboardGate = () => {
  const { session, loading: authLoading } = useAuth();
  const {
    loading: subLoading, accessResolved, checked, canScan,
    canManageBilling, trial, subscriptionStatus, bootFailed, lastErrorCode, refresh,
  } = useSubscription();

  // Single stable loader until everything is resolved
  if (authLoading || subLoading || (!accessResolved && !bootFailed) || (!checked && !bootFailed)) {
    return <Loader />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // First-boot transient error: show retry UI with diagnostics, never paywall
  if (bootFailed) {
    return (
      <BootFailedRetry
        onRetry={() => void refresh()}
        retrying={subLoading}
        errorCode={lastErrorCode}
      />
    );
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
