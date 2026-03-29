import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  normalizeAnncsuRecord,
  summarizeAnncsuBatch,
  type AnncsuRawRecord,
  type AnncsuNormalizedRecord,
  type AnncsuBatchSummary,
} from "@/lib/anncsuSchema";

const readinessBadge = (status: string) => {
  switch (status) {
    case "ready": return <Badge className="bg-emerald-600 text-white">Pronto</Badge>;
    case "ready_with_warnings": return <Badge className="bg-amber-500 text-white">Pronto con avvisi</Badge>;
    case "blocked": return <Badge variant="destructive">Bloccato</Badge>;
    case "review_needed": return <Badge className="bg-orange-500 text-white">Revisione necessaria</Badge>;
    case "partial_only": return <Badge variant="secondary">Solo parziale</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

export default function AdminAnncsuReadiness() {
  const [singleResult, setSingleResult] = useState<AnncsuNormalizedRecord | null>(null);
  const [batchSummary, setBatchSummary] = useState<AnncsuBatchSummary | null>(null);
  const [batchSample, setBatchSample] = useState<AnncsuNormalizedRecord[]>([]);

  // Single record inspection
  const [codReg, setCodReg] = useState("03");
  const [codProv, setCodProv] = useState("015");
  const [codCom, setCodCom] = useState("015146");
  const [denomCom, setDenomCom] = useState("Milano");
  const [specie, setSpecie] = useState("Via");
  const [denomStrada, setDenomStrada] = useState("Roma");
  const [codStrada, setCodStrada] = useState("");
  const [civico, setCivico] = useState("42");
  const [esponente, setEsponente] = useState("");

  const handleNormalize = () => {
    const raw: AnncsuRawRecord = {};
    if (codReg) raw.COD_REG = codReg;
    if (codProv) raw.COD_PROV = codProv;
    if (codCom) raw.COD_COM = codCom;
    if (denomCom) raw.DENOM_COM = denomCom;
    if (specie) raw.SPECIE = specie;
    if (denomStrada) raw.DENOM_STRADA = denomStrada;
    if (codStrada) raw.COD_STRADA = codStrada;
    if (civico) raw.CIVICO = civico;
    if (esponente) raw.ESPONENTE = esponente;
    setSingleResult(normalizeAnncsuRecord(raw));
  };

  const handleDemoBatch = () => {
    const samples: AnncsuRawRecord[] = [
      { COD_REG: "03", COD_PROV: "015", COD_COM: "015146", DENOM_COM: "Milano", SPECIE: "Via", DENOM_STRADA: "Roma", CIVICO: "1", COD_STRADA: "001" },
      { COD_REG: "03", COD_PROV: "015", COD_COM: "015146", DENOM_COM: "Milano", SPECIE: "Corso", DENOM_STRADA: "Buenos Aires", CIVICO: "33", ESPONENTE: "A" },
      { COD_REG: "12", COD_PROV: "058", COD_COM: "058091", DENOM_COM: "Roma", SPECIE: "P.zza", DENOM_STRADA: "Venezia", CIVICO: "11" },
      { COD_REG: "07", COD_PROV: "037", COD_COM: "037006", DENOM_COM: "Bologna", DENOM_STRADA: "Indipendenza" },
      { DENOM_STRADA: "Sconosciuta", CIVICO: "1" }, // blocked — no geo
      { COD_COM: "015146", COD_REG: "03", COD_PROV: "015" }, // street+civic missing
    ];
    const normalized = samples.map((r) => normalizeAnncsuRecord(r));
    setBatchSample(normalized);
    setBatchSummary(summarizeAnncsuBatch(normalized));
  };

  return (
    <div className="min-h-svh bg-background">
      <AppHeader />
      <main className="container mx-auto max-w-4xl px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ANNCSU Readiness</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ispezione del contract canonico ANNCSU, normalizzazione raw → normalized, quality gates e policy di promozione.
            Nessun dato viene persistito in questa fase.
          </p>
        </div>

        {/* Promotion Policy Banner */}
        <Card className="border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              ⚠️ Policy di promozione P1: tutti i flag di promozione sono bloccati a <code>false</code>.
              La presenza ANNCSU da sola NON qualifica per building truth né per precise location.
            </p>
          </CardContent>
        </Card>

        {/* Single Record */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ispezione singolo record</CardTitle>
            <CardDescription>Inserisci i campi grezzi di un record ANNCSU per ispezionare normalizzazione e quality gates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div><Label className="text-xs">COD_REG</Label><Input value={codReg} onChange={e => setCodReg(e.target.value)} /></div>
              <div><Label className="text-xs">COD_PROV</Label><Input value={codProv} onChange={e => setCodProv(e.target.value)} /></div>
              <div><Label className="text-xs">COD_COM</Label><Input value={codCom} onChange={e => setCodCom(e.target.value)} /></div>
              <div><Label className="text-xs">DENOM_COM</Label><Input value={denomCom} onChange={e => setDenomCom(e.target.value)} /></div>
              <div><Label className="text-xs">SPECIE</Label><Input value={specie} onChange={e => setSpecie(e.target.value)} /></div>
              <div><Label className="text-xs">DENOM_STRADA</Label><Input value={denomStrada} onChange={e => setDenomStrada(e.target.value)} /></div>
              <div><Label className="text-xs">COD_STRADA</Label><Input value={codStrada} onChange={e => setCodStrada(e.target.value)} /></div>
              <div><Label className="text-xs">CIVICO</Label><Input value={civico} onChange={e => setCivico(e.target.value)} /></div>
              <div><Label className="text-xs">ESPONENTE</Label><Input value={esponente} onChange={e => setEsponente(e.target.value)} /></div>
            </div>
            <Button onClick={handleNormalize}>Normalizza</Button>

            {singleResult && (
              <div className="space-y-3 mt-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">Readiness:</span>
                  {readinessBadge(singleResult.quality.ingest_readiness)}
                  <span className="text-sm font-medium ml-2">Geo link:</span>
                  <Badge variant="outline">{singleResult.quality.geo_link_status}</Badge>
                  <span className="text-sm font-medium ml-2">Strada:</span>
                  <Badge variant="outline">{singleResult.street.street_status}</Badge>
                  <span className="text-sm font-medium ml-2">Civico:</span>
                  <Badge variant="outline">{singleResult.civic.civic_status}</Badge>
                </div>

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Geo normalizzato</h4>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(singleResult.geo, null, 2)}</pre>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Strada normalizzata</h4>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(singleResult.street, null, 2)}</pre>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Civico normalizzato</h4>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(singleResult.civic, null, 2)}</pre>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Quality</h4>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(singleResult.quality, null, 2)}</pre>
                  </div>
                </div>

                {singleResult.normalization_trace.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Trace normalizzazione</h4>
                    <ul className="text-xs text-muted-foreground list-disc pl-4">
                      {singleResult.normalization_trace.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold mb-1">Policy promozione</h4>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(singleResult.promotion_policy, null, 2)}</pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Batch Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Simulazione batch</CardTitle>
            <CardDescription>Normalizza un batch di esempio e visualizza il riepilogo qualità</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" onClick={handleDemoBatch}>Esegui batch di esempio (6 record)</Button>

            {batchSummary && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <div>Totale: <strong>{batchSummary.total_records}</strong></div>
                  <div>Pronti: <strong className="text-emerald-600">{batchSummary.ready}</strong></div>
                  <div>Con avvisi: <strong className="text-amber-600">{batchSummary.ready_with_warnings}</strong></div>
                  <div>Bloccati: <strong className="text-red-600">{batchSummary.blocked}</strong></div>
                  <div>Revisione: <strong className="text-orange-600">{batchSummary.review_needed}</strong></div>
                  <div>Eligible: <strong>{batchSummary.ingest_eligible_pct}%</strong></div>
                  <div>Geo linked: <strong>{batchSummary.geo_linked_pct}%</strong></div>
                  <div>Strada completa: <strong>{batchSummary.street_complete_pct}%</strong></div>
                  <div>Civico presente: <strong>{batchSummary.civic_present_pct}%</strong></div>
                </div>

                {batchSummary.top_ambiguity_flags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold">Flag ambiguità principali</h4>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {batchSummary.top_ambiguity_flags.map(f => (
                        <Badge key={f.flag} variant="outline" className="text-xs">{f.flag} ({f.count})</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                <div>
                  <h4 className="text-sm font-semibold mb-2">Dettaglio record</h4>
                  <div className="space-y-2">
                    {batchSample.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 flex-wrap text-xs border rounded p-2">
                        {readinessBadge(r.quality.ingest_readiness)}
                        <span className="font-mono">{r.geo.comune_istat_code ?? "—"}</span>
                        <span>{r.street.street_full_name ?? "(strada mancante)"}</span>
                        <span>{r.civic.civic_full_label ?? "(civico mancante)"}</span>
                        {r.quality.ambiguity_flags.length > 0 && (
                          <span className="text-amber-600">⚠ {r.quality.ambiguity_flags.join(", ")}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
