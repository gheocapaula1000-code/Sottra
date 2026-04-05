/**
 * Admin Zone Urban Transformations — Sottra
 * Diagnostics page for urban transformation signals.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Construction, ArrowRight } from "lucide-react";
import { resolveTerritorialData } from "@/lib/territorialDataBackbone";
import { buildZoneCorrespondence } from "@/lib/zoneCorrespondenceEngine";
import {
  buildUrbanTransformations,
  transformationStatusLabel,
  stageLabel,
  proximityLabel,
  relevanceLabel,
  familyLabel,
  type UrbanTransformationInput,
  type UrbanTransformationResult,
} from "@/lib/zoneUrbanTransformations";
import AppHeader from "@/components/AppHeader";

// Synthetic demo signals for diagnostic purposes
const DEMO_SIGNALS: UrbanTransformationInput[] = [
  {
    signal_key: "metro_m4_ext",
    signal_label: "Prolungamento metropolitana M4",
    signal_family: "opere_pubbliche",
    signal_type: "infrastruttura_trasporto",
    signal_status: "in_progress",
    signal_stage: "in_progress",
    signal_direction: "supportive",
    geo_scope: "sub_comunale",
    evidence_level: "strong",
    source_basis: "delibera_comunale",
    is_official: true,
  },
  {
    signal_key: "regen_ex_scalo",
    signal_label: "Rigenerazione area ex-scalo ferroviario",
    signal_family: "rigenerazione_urbana",
    signal_type: "recupero_area",
    signal_status: "approved",
    signal_stage: "approved",
    signal_direction: "supportive",
    geo_scope: "sub_comunale",
    evidence_level: "medium",
    source_basis: "variante_urbanistica",
    is_official: true,
  },
  {
    signal_key: "pgt_variante",
    signal_label: "Variante PGT approvata",
    signal_family: "pianificazione_attuativa",
    signal_type: "variante_urbanistica",
    signal_status: "approved",
    signal_stage: "approved",
    signal_direction: "mixed",
    geo_scope: "comune",
    evidence_level: "medium",
    source_basis: "piano_comunale",
    is_official: true,
  },
  {
    signal_key: "polo_universitario",
    signal_label: "Nuovo polo universitario in zona",
    signal_family: "attrattori_in_arrivo",
    signal_type: "polo_istruzione",
    signal_status: "funded",
    signal_stage: "funded",
    signal_direction: "supportive",
    geo_scope: "sub_comunale",
    evidence_level: "strong",
    source_basis: "delibera_regionale",
    is_official: true,
  },
];

export default function AdminZoneUrbanTransformations() {
  const [istatCode, setIstatCode] = useState("015146");
  const [result, setResult] = useState<UrbanTransformationResult | null>(null);

  const run = () => {
    const data = resolveTerritorialData({ geo_input: { comune_istat_code: istatCode }, include_placeholders: true });
    const corr = buildZoneCorrespondence(data);
    const r = buildUrbanTransformations(data, corr, DEMO_SIGNALS);
    setResult(r);
  };

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-foreground">Admin — Trasformazioni Urbanistiche Zona</h1>

        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input value={istatCode} onChange={e => setIstatCode(e.target.value)} placeholder="Codice ISTAT" className="flex-1" />
              <Button onClick={run} size="sm">Analizza</Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <>
            {/* Identity */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Construction className="h-4 w-4 text-muted-foreground" />
                  Identità Analisi
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-1.5">
                {([
                  ["Zona", result.urban_transformation_identity.zone_label],
                  ["Livello", result.urban_transformation_identity.zone_geo_level],
                  ["Ambito analisi", result.urban_transformation_identity.analysis_radius_or_scope_label],
                  ["Copertura fonti", result.urban_transformation_identity.source_coverage_strength],
                ] as const).map(([l, v]) => (
                  <div key={l} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{l}</span>
                    <span className="font-medium text-foreground">{v}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Riepilogo</CardTitle>
                  <Badge variant={result.urban_transformation_summary.overall_transformation_signal_status === "supportive" ? "default" : "secondary"} className="text-[10px]">
                    {transformationStatusLabel(result.urban_transformation_summary.overall_transformation_signal_status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Totali: </span><span className="font-medium text-foreground">{result.urban_transformation_summary.total_signals}</span></div>
                <div><span className="text-muted-foreground">Alta rilevanza: </span><span className="font-medium text-foreground">{result.urban_transformation_summary.high_relevance_signals}</span></div>
                <div><span className="text-muted-foreground">Media: </span><span className="font-medium text-foreground">{result.urban_transformation_summary.medium_relevance_signals}</span></div>
                <div><span className="text-muted-foreground">Bassa: </span><span className="font-medium text-foreground">{result.urban_transformation_summary.low_relevance_signals}</span></div>
                <div><span className="text-muted-foreground">Ufficiali: </span><span className="font-medium text-foreground">{result.urban_transformation_summary.official_signal_count}</span></div>
                <div><span className="text-muted-foreground">Narrativa: </span><span className="font-medium text-foreground">{result.urban_transformation_summary.narrative_mode}</span></div>
              </CardContent>
            </Card>

            {/* Signals */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold">Segnali ({result.urban_transformation_signals.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                {result.urban_transformation_signals.map(s => (
                  <div key={s.signal_key} className="border border-border/50 rounded-md p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{s.signal_label}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{stageLabel(s.signal_stage)}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                      <div>Famiglia: <span className="text-foreground">{familyLabel(s.signal_family)}</span></div>
                      <div>Rilevanza: <span className="text-foreground">{relevanceLabel(s.territorial_relevance)}</span></div>
                      <div>Prossimità: <span className="text-foreground">{proximityLabel(s.proximity_relevance)}</span></div>
                      <div>Evidenza: <span className="text-foreground">{s.evidence_level}</span></div>
                      <div>Direzione: <span className="text-foreground">{s.signal_direction}</span></div>
                      <div>Ufficiale: <span className="text-foreground">{s.is_official ? "Sì" : "No"}</span></div>
                    </div>
                    {s.notes && <p className="text-xs text-muted-foreground/80">{s.notes}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Limitations */}
            {result.urban_transformation_limitations.transparency_notes.length > 0 && (
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">Limiti e trasparenza</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-1">
                  {result.urban_transformation_limitations.transparency_notes.map((n, i) => (
                    <p key={i} className="text-xs text-muted-foreground/80 leading-relaxed flex items-start gap-1.5">
                      <ArrowRight className="h-3 w-3 mt-0.5 shrink-0" />{n}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
