import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  buildHouseDifferentiation,
  differentiationStatusLabel,
  specificityStrengthLabel,
  specificityStrengthColor,
  separationLabel,
  narrativeModeLabel,
  type HouseDifferentiationResult,
  type HouseDifferentiationInput,
  type SignalStrength,
} from "@/lib/houseDifferentiationEngine";
import { cn } from "@/lib/utils";

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between items-start gap-2 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={cn("text-xs font-medium text-foreground text-right", className)}>{value}</span>
    </div>
  );
}

function SignalRow({ label, value }: { label: string; value: SignalStrength }) {
  const color = value === "strong" ? "text-emerald-400" : value === "medium" ? "text-primary" : value === "weak" ? "text-amber-400" : "text-muted-foreground";
  return <Field label={label} value={value} className={color} />;
}

export default function AdminHouseDifferentiation() {
  const [confidence, setConfidence] = useState("0.75");
  const [facadeVisible, setFacadeVisible] = useState(true);
  const [civicVisible, setCivicVisible] = useState(true);
  const [entranceVisible, setEntranceVisible] = useState(false);
  const [neighboringVisible, setNeighboringVisible] = useState(false);
  const [officialStreet, setOfficialStreet] = useState(true);
  const [officialCivic, setOfficialCivic] = useState(true);
  const [addressQuality, setAddressQuality] = useState("strong");
  const [result, setResult] = useState<HouseDifferentiationResult | null>(null);

  function run() {
    const input: HouseDifferentiationInput = {
      photo_present: true,
      geo_present: true,
      lat: 45.464,
      lng: 9.191,
      address_raw: "Via Roma 10, Milano",
      address_resolution: {
        street_match_status: officialStreet ? "exact_official_match" : "fuzzy_match",
        civic_match_status: officialCivic ? "official_exact_match" : "not_found",
        official_street_support: officialStreet,
        official_civic_support: officialCivic,
        building_truth_support: false,
        ambiguity_level: "low",
        overall_address_quality: addressQuality,
        false_specificity_risk: "low",
      },
      building_profile: {
        building_truth_supported: false,
        address_fact_level: "contextual",
        zone_geo_level: "microzona",
        zone_geo_code: "MI_B1",
      },
      identify_hints: {
        confidence: parseFloat(confidence) || 0.5,
        facade_visible: facadeVisible,
        entrance_visible: entranceVisible,
        civic_visible: civicVisible,
        neighboring_visible: neighboringVisible,
      },
    };
    setResult(buildHouseDifferentiation(input));
  }

  const r = result;

  return (
    <div className="flex flex-col min-h-svh bg-background">
      <AppHeader />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-lg mx-auto w-full">
        {/* Controls */}
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parametri simulazione</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground">Confidence</label>
              <Input value={confidence} onChange={e => setConfidence(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Address quality</label>
              <Input value={addressQuality} onChange={e => setAddressQuality(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ["Facciata", facadeVisible, setFacadeVisible],
              ["Civico", civicVisible, setCivicVisible],
              ["Ingresso", entranceVisible, setEntranceVisible],
              ["Adiacenti", neighboringVisible, setNeighboringVisible],
              ["ANNCSU via", officialStreet, setOfficialStreet],
              ["ANNCSU civico", officialCivic, setOfficialCivic],
            ] as [string, boolean, (v: boolean) => void][]).map(([label, val, setter]) => (
              <Badge
                key={label}
                variant={val ? "default" : "secondary"}
                className="cursor-pointer text-[10px]"
                onClick={() => setter(!val)}
              >
                {label}: {val ? "Sì" : "No"}
              </Badge>
            ))}
          </div>
          <Button size="sm" onClick={run} className="w-full">Calcola differenziazione</Button>
        </div>

        {r && (
          <>
            {/* Summary */}
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Risultato</p>
              <Field label="Status" value={differentiationStatusLabel(r.specificity.specificity_status)} />
              <Field label="Specificità" value={specificityStrengthLabel(r.specificity.specificity_strength)} className={specificityStrengthColor(r.specificity.specificity_strength)} />
              <Field label="Separazione" value={separationLabel(r.specificity.house_vs_adjacent_separation)} />
              <Field label="Narrativa" value={narrativeModeLabel(r.summary.narrative_mode)} />
              <Field label="Claim massimo sicuro" value={r.specificity.max_safe_claim_level} />
              <Field label="Falsa specificità" value={r.specificity.false_specificity_risk} />
              <Field label="Usabile per review" value={r.summary.usable_for_building_level_review ? "Sì" : "No"} />
              <Field label="Zona dominante" value={r.summary.still_zone_dominant ? "Sì" : "No"} />
            </div>

            {/* Boosted Structure Signals */}
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Segnali struttura</p>
              <SignalRow label="Facciata singola" value={r.visual_signals.structure.single_facade_likelihood} />
              <SignalRow label="Multi-facciata" value={r.visual_signals.structure.multi_facade_likelihood} />
              <SignalRow label="Schiera continua" value={r.visual_signals.structure.continuous_building_row_presence} />
              <SignalRow label="Edificio isolato" value={r.visual_signals.structure.detached_building_likelihood} />
              <SignalRow label="Ingresso prominente" value={r.visual_signals.structure.entrance_prominence} />
              <SignalRow label="Civico visibile" value={r.visual_signals.structure.civic_plate_visibility} />
              <SignalRow label="Insegna/attività" value={r.visual_signals.structure.storefront_or_signage_presence} />
              <SignalRow label="Chiarezza fronte" value={r.visual_signals.structure.frontage_clarity} />
            </div>

            {/* Context Separation */}
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Separazione contesto</p>
              <Field label="Adiacenti" value={r.visual_signals.context_separation.neighboring_buildings_count_hint} />
              <SignalRow label="Confini L/R" value={r.visual_signals.context_separation.left_right_boundary_clarity} />
              <Field label="Disordine contesto" value={r.visual_signals.context_separation.immediate_context_clutter} />
              <SignalRow label="Focus visivo" value={r.visual_signals.context_separation.visual_focus_strength} />
              <SignalRow label="Confusione adiacenti" value={r.visual_signals.context_separation.likely_adjacent_building_confusion} />
            </div>

            {/* Alignment Diagnostics */}
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Diagnostica allineamento</p>
              <Field label="Foto ↔ Geo" value={r.address_alignment.diagnostics.photo_geo_alignment} />
              <Field label="Foto ↔ Indirizzo" value={r.address_alignment.diagnostics.photo_address_alignment} />
              <Field label="Geo ↔ Indirizzo" value={r.address_alignment.diagnostics.geo_address_alignment} />
              <Field label="ANNCSU ↔ Foto" value={r.address_alignment.diagnostics.anncsu_photo_alignment} />
              <Field label="Overall" value={r.address_alignment.diagnostics.overall_alignment_status} />
              {r.address_alignment.diagnostics.alignment_conflict_flags.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] text-muted-foreground font-semibold">Conflitti:</p>
                  {r.address_alignment.diagnostics.alignment_conflict_flags.map((f, i) => (
                    <p key={i} className="text-[10px] text-amber-400">• {f}</p>
                  ))}
                </div>
              )}
              {r.address_alignment.diagnostics.alignment_notes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {r.address_alignment.diagnostics.alignment_notes.map((n, i) => (
                    <p key={i} className="text-[10px] text-muted-foreground">• {n}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Limitations */}
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Limiti</p>
              {r.summary.limitations.map((l, i) => (
                <p key={i} className="text-[11px] text-muted-foreground">• {l}</p>
              ))}
              <p className="text-[10px] text-muted-foreground/50 mt-2">{r.summary.differentiation_reasoning}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
