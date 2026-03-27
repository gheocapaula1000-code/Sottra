import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import AppHeader from "@/components/AppHeader";
import { ArrowLeft, Database, MapPin, Layers, AlertTriangle, CheckCircle2, XCircle, Search } from "lucide-react";
import { fetchSubMunicipalStats } from "@/lib/subMunicipalImporter";
import { findSubMunicipalArea, type SubMunicipalMatch } from "@/lib/pointInPolygon";

type Stats = NonNullable<Awaited<ReturnType<typeof fetchSubMunicipalStats>>>;

const AdminSubMunicipal = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Test tool state
  const [testLat, setTestLat] = useState("45.4064");
  const [testLng, setTestLng] = useState("11.8768");
  const [testResult, setTestResult] = useState<SubMunicipalMatch | null | "no_match" | "error">(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchSubMunicipalStats().then((s) => {
      setStats(s);
      setLoading(false);
    });
  }, []);

  const runTest = async () => {
    const lat = parseFloat(testLat);
    const lng = parseFloat(testLng);
    if (isNaN(lat) || isNaN(lng)) return;
    setTesting(true);
    setTestResult(null);
    try {
      const match = await findSubMunicipalArea(lat, lng);
      setTestResult(match ?? "no_match");
    } catch {
      setTestResult("error");
    }
    setTesting(false);
  };

  const isLayerActive = stats && stats.totalRecords > 0 && stats.withGeometry > 0;

  return (
    <div className="min-h-svh bg-background">
      <AppHeader />
      <main className="container max-w-4xl py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Aree Sub-Comunali 2021 — Admin</h1>
        </div>

        {/* Wiring status */}
        <Card className={isLayerActive ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20"}>
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              {isLayerActive ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              )}
              <div className="text-sm">
                <p className={`font-medium ${isLayerActive ? "text-emerald-800 dark:text-emerald-200" : "text-amber-800 dark:text-amber-200"}`}>
                  {isLayerActive ? "Layer ASC attivo — collegato al resolver territoriale" : "Layer ASC non attivo — nessun dato caricato"}
                </p>
                <p className={`mt-1 ${isLayerActive ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                  {isLayerActive
                    ? "Il resolver pro-sources include il match ASC in ogni scansione. Il report mostra la micro-info solo quando il match poligonale è affidabile."
                    : "Il motore pubblico di Sottra continua a funzionare normalmente senza ASC. Caricare i dataset ISTAT per attivare."}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ${isLayerActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                    <Database className="h-3 w-3" /> pro-sources: {isLayerActive ? "collegato" : "bypass"}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ${isLayerActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                    <MapPin className="h-3 w-3" /> point-in-polygon: {isLayerActive ? "attivo" : "pronto"}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ${isLayerActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                    <Layers className="h-3 w-3" /> report pubblico: {isLayerActive ? "micro-info ASC" : "invariato"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : !stats || stats.totalRecords === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">Nessun dato caricato</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                La tabella <code>sub_municipal_areas_2021</code> è vuota.
                Per popolarla servono i dataset reali ISTAT (ASC_21, R03_21).
              </p>
              <div className="mt-6 text-left max-w-lg mx-auto space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Dataset attesi:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>ASC_21</strong> — Aree Sub Comunali nazionali (3 livelli: Liv1, Liv2, Liv3)</li>
                  <li><strong>R03_21</strong> — Sezioni censuarie Lombardia (shapefile + tabelle CSV)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" /> Record Totali
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalRecords.toLocaleString("it-IT")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.comuniDistinti} comuni distinti
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Copertura Geometrica
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {stats.withGeometry.toLocaleString("it-IT")}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    ({Math.round((stats.withGeometry / stats.totalRecords) * 100)}%)
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.withCentroid} con centroide, {stats.withPopolazione} con popolazione
                </p>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Distribuzione per Dataset / Livello
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium mb-1">Per dataset:</p>
                    {Object.entries(stats.byDataset).map(([k, v]) => (
                      <p key={k} className="text-muted-foreground">{k}: {v.toLocaleString("it-IT")}</p>
                    ))}
                  </div>
                  <div>
                    <p className="font-medium mb-1">Per livello ASC:</p>
                    {Object.entries(stats.byLevel).map(([k, v]) => (
                      <p key={k} className="text-muted-foreground">Livello {k}: {v.toLocaleString("it-IT")}</p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {Object.keys(stats.byRegione).length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Distribuzione per Regione</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-sm">
                    {Object.entries(stats.byRegione)
                      .sort(([, a], [, b]) => b - a)
                      .map(([regione, count]) => (
                        <p key={regione} className="text-muted-foreground">
                          {regione}: <span className="font-medium text-foreground">{count.toLocaleString("it-IT")}</span>
                        </p>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Test tool — always visible */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Search className="h-4 w-4" /> Test Point-in-Polygon ASC
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Latitudine</label>
                <Input value={testLat} onChange={e => setTestLat(e.target.value)} placeholder="45.4064" className="h-8 text-sm" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Longitudine</label>
                <Input value={testLng} onChange={e => setTestLng(e.target.value)} placeholder="11.8768" className="h-8 text-sm" />
              </div>
              <Button size="sm" onClick={runTest} disabled={testing} className="h-8">
                {testing ? "..." : "Test"}
              </Button>
            </div>
            {testResult === "no_match" && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <XCircle className="h-4 w-4" />
                <span>Nessun match ASC per queste coordinate{stats?.totalRecords === 0 ? " (tabella vuota)" : ""}</span>
              </div>
            )}
            {testResult === "error" && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                <span>Errore durante il test</span>
              </div>
            )}
            {testResult && testResult !== "no_match" && testResult !== "error" && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-1 text-sm">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Match trovato
                </div>
                <p className="text-foreground"><strong>Area:</strong> {testResult.area_name}</p>
                <p className="text-muted-foreground"><strong>Codice:</strong> {testResult.area_code} · <strong>Tipo:</strong> {testResult.area_type}</p>
                <p className="text-muted-foreground"><strong>Comune:</strong> {testResult.comune_name} · <strong>Livello:</strong> {testResult.asc_level ?? "n/a"}</p>
                <p className="text-muted-foreground"><strong>Dataset:</strong> {testResult.source_dataset} · <strong>Metodo:</strong> {testResult.match_method}</p>
                {testResult.popolazione != null && <p className="text-muted-foreground"><strong>Popolazione:</strong> {testResult.popolazione.toLocaleString("it-IT")}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminSubMunicipal;
