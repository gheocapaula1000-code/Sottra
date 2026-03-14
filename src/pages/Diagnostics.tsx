import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";

interface DiagResult {
  proxy_local: string;
  upstream_sanitized: string;
  upstream_origin: string;
  key_configured: boolean;
  key_source: string;
  is_official: boolean;
  official_host: string;
  health: string;
  health_latency_ms: number;
  routing: string;
}

export default function Diagnostics() {
  const navigate = useNavigate();
  const [data, setData] = useState<DiagResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: d, error: e } = await supabase.functions.invoke("diagnostics");
      if (e) throw e;
      setData(d as DiagResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Errore di comunicazione");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const Row = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className={`text-sm ${mono ? "font-mono" : ""} text-foreground break-all text-right`}>{value}</span>
    </div>
  );

  const healthPass = data?.health === "PASS";

  return (
    <div className="min-h-svh bg-background">
      <AppHeader rightContent={
        <>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/app")} aria-label="Indietro">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </>
      } />
      <div className="px-4 py-8">
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-lg font-semibold text-foreground">Core Diagnostics</h1>

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Errore</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {data && (
          <>
            {/* Official badge */}
            {data.is_official ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertTitle className="flex items-center gap-2">
                  Core ufficiale <Badge className="bg-green-500/15 text-green-500 border-green-500/30 hover:bg-green-500/25">ufficiale ✓</Badge>
                </AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground">
                  L'upstream corrisponde al Central Core condiviso (Wyloni / KeyDraft / Sottra).
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Core NON ufficiale</AlertTitle>
                <AlertDescription className="text-xs">
                  L'upstream non corrisponde al Central Core ufficiale. Verifica la configurazione.
                </AlertDescription>
              </Alert>
            )}

            {/* Routing */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Routing</CardTitle>
              </CardHeader>
              <CardContent>
                <Row label="Chain" value={data.routing} mono />
                <Row label="Proxy locale" value={data.proxy_local} mono />
                <Row label="Upstream (sanitized)" value={data.upstream_sanitized} mono />
                <Row label="Origine valore" value={<Badge variant="secondary">{data.upstream_origin}</Badge>} />
              </CardContent>
            </Card>

            {/* Auth */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Autenticazione Core</CardTitle>
              </CardHeader>
              <CardContent>
                <Row label="API Key configurata" value={data.key_configured ? "✓ Sì" : "✗ No"} />
                <Row label="Secret usato" value={data.key_source} mono />
              </CardContent>
            </Card>

            {/* Health */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Health Check</CardTitle>
              </CardHeader>
              <CardContent>
                <Row
                  label="Esito"
                  value={
                    <Badge className={healthPass
                      ? "bg-green-500/15 text-green-500 border-green-500/30"
                      : "bg-red-500/15 text-red-500 border-red-500/30"
                    }>
                      {data.health}
                    </Badge>
                  }
                />
                {data.health_latency_ms > 0 && (
                  <Row label="Latenza" value={`${data.health_latency_ms} ms`} mono />
                )}
              </CardContent>
            </Card>
          </>
        )}

        {loading && !data && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      </div>
      </div>
    </div>
  );
}
