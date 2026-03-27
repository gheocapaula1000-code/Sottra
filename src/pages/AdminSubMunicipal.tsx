import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import AppHeader from "@/components/AppHeader";
import { ArrowLeft, Database, MapPin, Layers, AlertTriangle, CheckCircle2, XCircle, Search, BarChart3, GitCompare } from "lucide-react";
import { fetchSubMunicipalStats } from "@/lib/subMunicipalImporter";
import { findSubMunicipalArea, type SubMunicipalMatch } from "@/lib/pointInPolygon";
import { fetchR03Stats, validateAscSectionCoherence, type AscValidationReport } from "@/lib/r03Importer";

type Stats = NonNullable<Awaited<ReturnType<typeof fetchSubMunicipalStats>>>;
type R03Stats = NonNullable<Awaited<ReturnType<typeof fetchR03Stats>>>;

const AdminSubMunicipal = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // R03 state
  const [r03Stats, setR03Stats] = useState<R03Stats | null>(null);
  const [r03Loading, setR03Loading] = useState(true);
  const [ascValidation, setAscValidation] = useState<AscValidationReport | null>(null);
  const [validating, setValidating] = useState(false);

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
    fetchR03Stats().then((s) => {
      setR03Stats(s);
      setR03Loading(false);
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

  const runAscValidation = async () => {
    setValidating(true);
    setAscValidation(null);
    try {
      const result = await validateAscSectionCoherence();
      setAscValidation(result);
    } catch {
      setAscValidation(null);
    }
    setValidating(false);
  };

  const isLayerActive = stats && stats.totalRecords > 0 && stats.withGeometry > 0;
  const isR03Present = r03Stats && r03Stats.totalSections > 0;

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
                    ? "Il resolver pro-sources include il match ASC in ogni scansione."
                    : "Il motore pubblico continua a funzionare normalmente senza ASC."}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ${isLayerActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                    <Database className="h-3 w-3" /> pro-sources: {isLayerActive ? "collegato" : "bypass"}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ${isLayerActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                    <MapPin className="h-3 w-3" /> PIP: {isLayerActive ? "attivo" : "pronto"}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ${isR03Present ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" : "bg-muted text-muted-foreground"}`}>
                    <BarChart3 className="h-3 w-3" /> R03 Lombardia: {isR03Present ? "caricato" : "non disponibile"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ASC Stats */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : !stats || stats.totalRecords === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">Nessun dato ASC caricato</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                La tabella <code>sub_municipal_areas_2021</code> è vuota.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" /> Record ASC Totali
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalRecords.toLocaleString("it-IT")}</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.comuniDistinti} comuni distinti</p>
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
                    ({stats.totalRecords > 0 ? Math.round((stats.withGeometry / stats.totalRecords) * 100) : 0}%)
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

        {/* R03 Lombardia Pilot Section */}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Pilota R03 — Sezioni Censuarie Lombardia
          </h2>
          <p className="text-xs text-muted-foreground">Dataset pilota per validazione ASC ↔ sezioni di censimento 2021</p>
        </div>

        {r03Loading ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : !r03Stats || r03Stats.totalSections === 0 ? (
          <Card className="border-muted">
            <CardContent className="py-8 text-center">
              <Database className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-base font-semibold text-foreground mb-1">Dataset R03 non importato</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                La tabella <code>census_sections_r03_2021</code> è vuota. Per popolarla serve il dataset ISTAT R03_21 (sezioni censuarie Lombardia 2021).
              </p>
              <div className="mt-4 text-left max-w-lg mx-auto space-y-1 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">File attesi dal pacchetto R03_21:</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  <li><strong>SEZ_R03_21.csv</strong> — sezioni con variabili P1 (pop), P14 (famiglie), A2 (abitazioni), E3 (edifici)</li>
                  <li><strong>ASC1_R03_21.csv</strong> — mapping sezioni → ASC livello 1</li>
                  <li><strong>ASC2_R03_21.csv</strong> — mapping sezioni → ASC livello 2</li>
                  <li><strong>Shapefile (.shp/.dbf/.prj)</strong> — geometrie sezioni</li>
                </ul>
                <p className="mt-2 text-foreground font-medium">Stato: <span className="text-amber-600">ready but not executed</span></p>
                <p>L'importer è pronto. Manca il caricamento del dataset reale.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" /> Sezioni Caricate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{r03Stats.totalSections.toLocaleString("it-IT")}</p>
                <p className="text-xs text-muted-foreground mt-1">{r03Stats.comuniDistinti} comuni coperti</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Codici ASC
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">ASC1: <span className="font-medium text-foreground">{r03Stats.asc1Distinti}</span> distinti ({r03Stats.sectionsWithAsc1} sezioni)</p>
                  <p className="text-muted-foreground">ASC2: <span className="font-medium text-foreground">{r03Stats.asc2Distinti}</span> distinti ({r03Stats.sectionsWithAsc2} sezioni)</p>
                  {r03Stats.asc3Distinti > 0 && <p className="text-muted-foreground">ASC3: <span className="font-medium text-foreground">{r03Stats.asc3Distinti}</span> distinti</p>}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Popolazione</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{r03Stats.totalPopulation.toLocaleString("it-IT")}</p>
                <p className="text-xs text-muted-foreground mt-1">{r03Stats.withPopulation} sezioni con dato popolazione</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Geometrie</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Con geometria: <span className="font-medium text-foreground">{r03Stats.withGeometry}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Con centroide: <span className="font-medium text-foreground">{r03Stats.withCentroid}</span>
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ASC ↔ Sections Validation */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GitCompare className="h-4 w-4" /> Validazione ASC ↔ Sezioni R03
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Confronta i codici ASC presenti nelle sezioni R03 con quelli nel layer ASC (<code>sub_municipal_areas_2021</code>).
            </p>
            <Button size="sm" onClick={runAscValidation} disabled={validating} className="h-8">
              {validating ? "Validazione in corso..." : "Esegui validazione"}
            </Button>

            {ascValidation && (
              <div className="mt-3 space-y-3">
                {ascValidation.warnings.length > 0 && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-1">
                    {ascValidation.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Sezioni totali</p>
                    <p className="font-bold text-foreground">{ascValidation.totalSections.toLocaleString("it-IT")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Comuni coperti</p>
                    <p className="font-bold text-foreground">{ascValidation.comuniCovered}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Match codici ASC</p>
                    <p className={`font-bold ${ascValidation.matchPercentage > 50 ? "text-emerald-600" : ascValidation.matchPercentage > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                      {ascValidation.matchPercentage.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Codici ASC in sezioni</p>
                    <p className="font-bold text-foreground">{ascValidation.ascCodesInSections.size}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Codici ASC nel layer</p>
                    <p className="font-bold text-foreground">{ascValidation.ascCodesInLayer.size}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Codici matchati</p>
                    <p className="font-bold text-foreground">{ascValidation.matchedCodes.length}</p>
                  </div>
                </div>

                {ascValidation.unmatchedInSections.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      {ascValidation.unmatchedInSections.length} codici ASC in sezioni non nel layer (mostra primi 20)
                    </summary>
                    <pre className="mt-1 bg-muted/50 rounded p-2 overflow-x-auto text-muted-foreground">
                      {ascValidation.unmatchedInSections.slice(0, 20).join(", ")}
                    </pre>
                  </details>
                )}

                {ascValidation.unmatchedInLayer.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      {ascValidation.unmatchedInLayer.length} codici ASC nel layer non referenziati da R03 (mostra primi 20)
                    </summary>
                    <pre className="mt-1 bg-muted/50 rounded p-2 overflow-x-auto text-muted-foreground">
                      {ascValidation.unmatchedInLayer.slice(0, 20).join(", ")}
                    </pre>
                  </details>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <p className="text-muted-foreground">Sezioni con ASC1:</p>
                  <span className="font-medium text-foreground">{ascValidation.sectionsWithAsc1}</span>
                  <span className="text-muted-foreground mx-1">|</span>
                  <p className="text-muted-foreground">ASC2:</p>
                  <span className="font-medium text-foreground">{ascValidation.sectionsWithAsc2}</span>
                  <span className="text-muted-foreground mx-1">|</span>
                  <p className="text-muted-foreground">ASC3:</p>
                  <span className="font-medium text-foreground">{ascValidation.sectionsWithAsc3}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test tool */}
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
                <span>Nessun match ASC{stats?.totalRecords === 0 ? " (tabella vuota)" : ""}</span>
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
