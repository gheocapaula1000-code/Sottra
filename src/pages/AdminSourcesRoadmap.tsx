import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import {
  SOURCE_FAMILIES,
  PRIORITY_ORDER,
  summarizeEvaluationRegistry,
  type SourceFamilyEvaluation,
  type RecommendedPriority,
  type RiskLevel,
  type Relevance,
  type AntiHallucinationFit,
} from "@/lib/sourceEvaluationRegistry";

const priorityColors: Record<RecommendedPriority, string> = {
  P1: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  P2: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  P3: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  P4: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  P5: "bg-muted text-muted-foreground",
};

const riskIcon: Record<RiskLevel, string> = { low: "🟢", medium: "🟡", high: "🔴" };
const relevanceIcon: Record<Relevance, string> = { high: "🟢", medium: "🟡", low: "🔴", none: "⚫" };
const ahIcon: Record<AntiHallucinationFit, string> = { excellent: "✅", good: "✅", caution: "⚠️", poor: "❌" };

function FamilyCard({ family }: { family: SourceFamilyEvaluation }) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={priorityColors[family.recommended_priority]}>
            {family.recommended_priority}
          </Badge>
          <CardTitle className="text-base">{family.source_family_label}</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{family.notes}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-muted-foreground">Qualità attesa</span>
          <span className="font-medium">{family.likely_quality_label}</span>
          <span className="text-muted-foreground">Copertura</span>
          <span>{family.geographic_coverage}</span>
          <span className="text-muted-foreground">Ufficialità</span>
          <span className="text-xs">{family.officiality_level}</span>
        </div>

        <div className="border-t border-border pt-2">
          <p className="text-xs text-muted-foreground mb-1">Rilevanza per layer</p>
          <div className="flex gap-3 text-xs">
            <span>{relevanceIcon[family.zone_relevance]} Zona</span>
            <span>{relevanceIcon[family.building_relevance]} Edificio</span>
            <span>{relevanceIcon[family.address_relevance]} Indirizzo</span>
          </div>
        </div>

        <div className="border-t border-border pt-2">
          <p className="text-xs text-muted-foreground mb-1">Rischi</p>
          <div className="flex flex-wrap gap-3 text-xs">
            <span>{riskIcon[family.licensing_risk]} Licenza</span>
            <span>{riskIcon[family.integration_complexity]} Complessità</span>
            <span>{riskIcon[family.stability_risk]} Stabilità</span>
            <span>{ahIcon[family.anti_hallucination_fit]} Anti-allucinazione</span>
          </div>
        </div>

        <div className="border-t border-border pt-2 text-xs">
          <span className="text-muted-foreground">Azione: </span>
          <span className="font-medium">{family.recommended_action.replace(/_/g, " ")}</span>
          <span className="text-muted-foreground ml-2">· Fase: </span>
          <span>{family.recommended_phase}</span>
        </div>

        <div className="text-xs text-muted-foreground">
          Fonti: {family.source_names.join(", ")}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminSourcesRoadmap() {
  const navigate = useNavigate();
  const summary = summarizeEvaluationRegistry();

  return (
    <div className="min-h-svh bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Roadmap Sorgenti Reali</h1>
            <p className="text-sm text-muted-foreground">
              Pianificazione integrazioni future — nessuna fonte attivata
            </p>
          </div>
        </div>

        {/* Summary */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
              <div>
                <p className="text-2xl font-bold">{summary.total}</p>
                <p className="text-muted-foreground text-xs">Famiglie analizzate</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{summary.actionable}</p>
                <p className="text-muted-foreground text-xs">Azionabili</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{summary.study}</p>
                <p className="text-muted-foreground text-xs">Studio fattibilità</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{summary.deferred}</p>
                <p className="text-muted-foreground text-xs">Rinviate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Priority order */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ordine di priorità</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {PRIORITY_ORDER.map((p) => (
              <div key={p.priority} className="flex gap-3 text-sm">
                <Badge className={`${priorityColors[p.priority]} shrink-0`}>{p.priority}</Badge>
                <div>
                  <p className="font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.rationale}</p>
                  <p className="text-xs mt-0.5">
                    <span className="text-muted-foreground">Impatto report: </span>
                    {p.report_impact}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* All families */}
        <h2 className="text-lg font-semibold">Schede valutazione</h2>
        <div className="space-y-4">
          {SOURCE_FAMILIES.map((f) => (
            <FamilyCard key={f.source_family} family={f} />
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center pb-4">
          Roadmap operativa — nessuna fonte integrata in questa fase.
          Anti-hallucination compatibili: {summary.anti_hallucination_compatible}/{summary.total}
        </p>
      </div>
    </div>
  );
}
