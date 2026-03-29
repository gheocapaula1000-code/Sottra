import { useState, useMemo } from "react";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  resolveAddress,
  type AddressResolutionInput,
  type AnncsuCandidate,
  type AddressResolutionResult,
} from "@/lib/addressResolutionEngine";
import {
  classifyCase,
  evaluatePromotionReadiness,
  computeAuditMetrics,
  assessSystemReadiness,
  type AuditMetrics,
  type SystemReadinessAssessment,
  type AuditCaseClass,
  type PromotionReadinessResult,
} from "@/lib/anncsuMatchAudit";

/* ── synthetic test batch ──────────────────────────────── */

function makeCand(o?: Partial<AnncsuCandidate>): AnncsuCandidate {
  return {
    street_name: "Roma", street_type: "Via", civic_normalized: null, esponente: null,
    cod_strada: "001", comune_istat_code: "015146", comune_label: "Milano",
    ingest_readiness: "ready", ambiguity_flags: [], ...o,
  };
}

function buildSyntheticBatch(): AddressResolutionResult[] {
  const results: AddressResolutionResult[] = [];
  // Strong street
  results.push(resolveAddress({ raw_address: "Via Roma 12", comune: "Milano", anncsu_street_candidates: [makeCand()] }));
  // Strong street + civic
  results.push(resolveAddress({ raw_address: "Via Roma 12", comune: "Milano", anncsu_street_candidates: [makeCand()], anncsu_civic_candidates: [makeCand({ civic_normalized: "12" })] }));
  // With coords
  results.push(resolveAddress({ raw_address: "Via Roma 12", comune: "Milano", lat: 45.46, lng: 9.19, anncsu_street_candidates: [makeCand()], anncsu_civic_candidates: [makeCand({ civic_normalized: "12" })] }));
  // Ambiguous
  results.push(resolveAddress({ raw_address: "Via Roma 12", comune: "Milano", anncsu_street_candidates: [makeCand()], anncsu_civic_candidates: [makeCand({ civic_normalized: "12", esponente: "A" }), makeCand({ civic_normalized: "12", esponente: "B" })] }));
  // No ANNCSU
  results.push(resolveAddress({ raw_address: "Via Garibaldi 45", comune: "Torino" }));
  // Unresolved
  results.push(resolveAddress({ raw_address: "" }));
  // Normalized match (different street type)
  results.push(resolveAddress({ raw_address: "Via Roma 5", comune: "Milano", anncsu_street_candidates: [makeCand({ street_type: "Viale" })] }));
  return results;
}

/* ── badge helpers ─────────────────────────────────────── */

const readinessColors: Record<string, string> = {
  not_ready: "bg-destructive text-destructive-foreground",
  partially_ready_rare_cases: "bg-muted text-muted-foreground",
  ready_but_blocked_by_policy: "bg-primary/20 text-primary",
  ready_for_evaluation: "bg-primary text-primary-foreground",
};

const caseColors: Record<AuditCaseClass, string> = {
  strong_official_street: "bg-primary/20 text-primary",
  strong_official_street_and_civic: "bg-primary/30 text-primary",
  official_but_ambiguous: "bg-muted text-muted-foreground",
  official_partial_only: "bg-muted text-muted-foreground",
  textual_match_only: "bg-secondary text-secondary-foreground",
  unresolved: "bg-destructive/20 text-destructive",
  risky_false_specificity: "bg-destructive text-destructive-foreground",
};

export default function AdminAnncsuMatchAudit() {
  const [results, setResults] = useState<AddressResolutionResult[] | null>(null);
  const [metrics, setMetrics] = useState<AuditMetrics | null>(null);
  const [assessment, setAssessment] = useState<SystemReadinessAssessment | null>(null);

  const runAudit = () => {
    const batch = buildSyntheticBatch();
    setResults(batch);
    const m = computeAuditMetrics(batch);
    setMetrics(m);
    setAssessment(assessSystemReadiness(m));
  };

  return (
    <div className="min-h-svh bg-background">
      <AppHeader />
      <main className="container max-w-4xl py-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">ANNCSU Match Quality Audit</h1>
        <p className="text-sm text-muted-foreground">
          Audit interno della qualità dei match ANNCSU. Nessuna modifica alla semantica utente.
        </p>

        <Button onClick={runAudit}>Esegui Audit (batch sintetico)</Button>

        {/* System Readiness */}
        {assessment && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Valutazione Sistema
                <Badge className={readinessColors[assessment.level] || ""}>{assessment.level}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{assessment.summary}</p>
              <p className="font-medium">{assessment.recommendation}</p>
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <span>Match forti: {(assessment.strong_case_ratio * 100).toFixed(1)}%</span>
                <span>Ambiguità: {(assessment.ambiguity_ratio * 100).toFixed(1)}%</span>
                <span>Overprecision: {(assessment.overprecision_ratio * 100).toFixed(1)}%</span>
              </div>
              {assessment.building_truth_ever_promoted && (
                <p className="text-destructive font-bold">⚠ building_truth_support è stato promosso — anomalia!</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Aggregate Metrics */}
        {metrics && (
          <Card>
            <CardHeader><CardTitle>Metriche Aggregate</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <Metric label="Totale valutati" value={metrics.total_evaluated} />
                <Metric label="Street match esatto" value={metrics.exact_official_street_match_count} />
                <Metric label="Street match normalizzato" value={metrics.normalized_official_street_match_count} />
                <Metric label="Solo strada ufficiale" value={metrics.official_street_only_count} />
                <Metric label="Supporto civico ufficiale" value={metrics.official_civic_support_count} />
                <Metric label="Civico ambiguo" value={metrics.official_civic_ambiguous_count} />
                <Metric label="Precise location" value={metrics.precise_location_support_count} />
                <Metric label="Nessun match ufficiale" value={metrics.no_official_match_count} />
                <Metric label="Building truth promosso" value={metrics.building_truth_promoted_count} highlight={metrics.building_truth_promoted_count > 0} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Case Distribution */}
        {metrics && (
          <Card>
            <CardHeader><CardTitle>Distribuzione Casi</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(metrics.case_distribution) as [AuditCaseClass, number][]).map(([k, v]) => (
                  <Badge key={k} className={caseColors[k] || ""}>
                    {k}: {v}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Promotion Distribution */}
        {metrics && (
          <Card>
            <CardHeader><CardTitle>Promotion Readiness Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(metrics.promotion_distribution).map(([k, v]) => (
                  <Badge key={k} variant="outline">{k}: {v}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sample Results */}
        {results && (
          <Card>
            <CardHeader><CardTitle>Campioni Dettagliati</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {results.map((r, i) => {
                const cc = classifyCase(r);
                const pr = evaluatePromotionReadiness(r);
                return (
                  <div key={i} className="border border-border rounded p-3 space-y-1 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-foreground">{r.address_identity.raw_input || "(vuoto)"}</span>
                      <Badge className={caseColors[cc]}>{cc}</Badge>
                      <Badge variant="outline">{pr.readiness}</Badge>
                    </div>
                    <div className="text-muted-foreground space-y-0.5">
                      <div>Street: {r.address_resolution.matched_street_status} | ANNCSU: {r.address_resolution.anncsu_match_status}</div>
                      <div>Official street: {String(r.address_resolution.official_street_support)} | Official civic: {String(r.address_resolution.official_civic_support)}</div>
                      <div>Precise location: {String(r.address_resolution.precise_location_support)} | Building truth: {String(r.address_resolution.building_truth_support)}</div>
                      <div>Confidence: {r.address_resolution.matched_street_confidence.toFixed(2)}</div>
                      {pr.blocking_reasons.length > 0 && <div className="text-destructive">Blocking: {pr.blocking_reasons.join(", ")}</div>}
                      {pr.missing_signals.length > 0 && <div>Missing: {pr.missing_signals.join(", ")}</div>}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded border border-border p-2 ${highlight ? "border-destructive bg-destructive/10" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold text-foreground">{value}</div>
    </div>
  );
}
