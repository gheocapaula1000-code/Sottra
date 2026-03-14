import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { TrialExpiredScreen } from "@/components/TrialExpiredScreen";
import { APP_BRAND } from "@/lib/legalEntity";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useScanHistory } from "@/contexts/ScanHistoryContext";
import SottraMark from "@/components/SottraMark";
...
const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { loading, accessResolved, canScan, subscribed, trial, isAdmin, isOwner } = useSubscription();
  const { toast } = useToast();
  const { scans } = useScanHistory();
...
  if (loading || !accessResolved) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }
...
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Azioni rapide</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                <QuickAction icon={<ScanLine className="h-4 w-4" />} label="Nuova scansione" onClick={() => navigate("/scan")} />
                <QuickAction icon={<History className="h-4 w-4" />} label="Cronologia scansioni" onClick={() => navigate("/history")} />
                <QuickAction icon={<Activity className="h-4 w-4" />} label="Diagnostica Core" onClick={() => navigate("/app/diagnostics")} />
                {(isAdmin || isOwner) && (
                  <QuickAction icon={<Shield className="h-4 w-4" />} label="Diagnostica admin" onClick={() => navigate("/admin/diagnostics")} />
                )}
                {displaySubscribed && (
                  <QuickAction icon={<CreditCard className="h-4 w-4" />} label="Gestisci abbonamento" onClick={handleManageSubscription} />
                )}
              </CardContent>
            </Card>

            {/* Support */}
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">Assistenza</p>
                  <a
                    href={`mailto:${APP_BRAND.supportEmail}`}
                    className="text-xs text-primary hover:underline break-all"
                  >
                    {APP_BRAND.supportEmail}
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

/* ── Sub-components ── */

function OverviewCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
          <p className="text-lg font-bold text-foreground leading-tight mt-0.5 truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground hover:bg-secondary/50 transition-colors"
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
    </button>
  );
}

export default Dashboard;
