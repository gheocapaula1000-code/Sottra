/**
 * Admin — Zone Attractors & Pressure Diagnostics
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Magnet, MapPin } from "lucide-react";
import { resolveTerritorialData } from "@/lib/territorialDataBackbone";
import { buildZoneCorrespondence } from "@/lib/zoneCorrespondenceEngine";
import {
  buildAttractorsPressure,
  pressureStatusLabel,
  attractorFamilyLabel,
  attractorProximityLabel,
  attractorRelevanceLabel,
  attractorIntensityLabel,
  type AttractorPressureResult,
  type AttractorInput,
} from "@/lib/zoneAttractorsPressure";
import AppHeader from "@/components/AppHeader";

const DEMO_ATTRACTORS: AttractorInput[] = [
  {
    signal_key: "uni_statale", signal_label: "Università Statale", signal_family: "poli_formativi",
    signal_type: "università", attractor_category: "istruzione_superiore", signal_status: "active",
    signal_direction: "supportive", geo_scope: "sub_comunale", proximity_hint: "immediate",
    intensity_hint: "strong", evidence_level: "strong", source_basis: "anagrafe_istruzione", is_official: true,
  },
  {
    signal_key: "stazione_centrale", signal_label: "Stazione Centrale", signal_family: "nodi_di_flusso",
    signal_type: "stazione_ferroviaria", attractor_category: "trasporto", signal_status: "active",
    signal_direction: "supportive", geo_scope: "sub_comunale", proximity_hint: "near",
    intensity_hint: "strong", evidence_level: "strong", source_basis: "rfi_rete", is_official: true,
  },
];

export default function AdminZoneAttractorsPressure() {
  const [istatCode, setIstatCode] = useState("015146");
  const [result, setResult] = useState<AttractorPressureResult | null>(null);

  const run = () => {
    const data = resolveTerritorialData({
      geo_input: { comune_istat_code: istatCode },
      include_placeholders: true,
    });
    const corr = buildZoneCorrespondence(data);
    setResult(buildAttractorsPressure(data, corr, DEMO_ATTRACTORS));
  };

  return (
    <div className="min-h-svh bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Magnet className="h-5 w-5" /> Attrattori & Pressione — Diagnostica
        </h1>

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
                  <MapPin className="h-4 w-4 text-muted-foreground" /> Identità Zona
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-1">
                <Row label="Codice" value={result.attractor_identity.zone_geo_code} />
                <Row label="Livello" value={result.attractor_identity.zone_geo_level} />
                <Row label="Label" value={result.attractor_identity.zone_label} />
                <Row label="Scope" value={result.attractor_identity.analysis_scope} />
                <Row label="Copertura fonti" value={result.attractor_identity.source_coverage_strength} />
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Riepilogo Pressione</CardTitle>
                  <Badge variant={result.pressure_summary.overall_pressure_signal_status === "supportive" ? "default" : "secondary"} className="text-[10px]">
                    {pressureStatusLabel(result.pressure_summary.overall_pressure_signal_status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-1">
                <Row label="Totale segnali" value={String(result.pressure_summary.total_signals)} />
                <Row label="Alta rilevanza" value={String(result.pressure_summary.high_relevance_signals)} />
                <Row label="Media rilevanza" value={String(result.pressure_summary.medium_relevance_signals)} />
                <Row label="Bassa rilevanza" value={String(result.pressure_summary.low_relevance_signals)} />
                <Row label="Attrattori forti" value={String(result.pressure_summary.strong_attractor_count)} />
                <Row label="Narrative mode" value={result.pressure_summary.narrative_mode} />
              </CardContent>
            </Card>

            {/* Signals */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold">Segnali Attrattori</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                {result.attractor_signals.map(s => (
                  <div key={s.signal_key} className="border border-border/50 rounded-md p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{s.signal_label}</span>
                      <Badge variant="outline" className="text-[9px]">{attractorFamilyLabel(s.signal_family)}</Badge>
                    </div>
                    <Row label="Categoria" value={s.attractor_category} />
                    <Row label="Rilevanza" value={attractorRelevanceLabel(s.territorial_relevance)} />
                    <Row label="Prossimità" value={attractorProximityLabel(s.proximity_relevance)} />
                    <Row label="Intensità" value={attractorIntensityLabel(s.intensity_hint)} />
                    <Row label="Evidenza" value={s.evidence_level} />
                    <Row label="Direzione" value={s.signal_direction} />
                    <Row label="Ufficiale" value={s.is_official ? "Sì" : "No"} />
                    <Row label="Geo scope" value={s.geo_validity_level} />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Limitations */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold">Limitazioni</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-1">
                <Row label="Copertura scarsa" value={result.pressure_limitations.sparse_coverage ? "Sì" : "No"} />
                <Row label="Prossimità debole" value={result.pressure_limitations.weak_proximity_mapping ? "Sì" : "No"} />
                <Row label="Bias area vasta" value={result.pressure_limitations.broader_area_bias ? "Sì" : "No"} />
                <Row label="Profondità insufficiente" value={result.pressure_limitations.insufficient_signal_depth ? "Sì" : "No"} />
                {result.pressure_limitations.transparency_notes.map((n, i) => (
                  <p key={i} className="text-xs text-muted-foreground/80">{n}</p>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
