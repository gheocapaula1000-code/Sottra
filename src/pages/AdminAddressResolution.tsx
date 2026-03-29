import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Search, AlertTriangle, ShieldCheck } from "lucide-react";
import { badgeVariantClasses } from "@/lib/badgeUtils";
import {
  resolveAddress,
  streetMatchLabel,
  civicMatchLabel,
  addressQualityLabel,
  type AddressResolutionResult,
} from "@/lib/addressResolutionEngine";

export default function AdminAddressResolution() {
  const [rawAddress, setRawAddress] = useState("");
  const [comune, setComune] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [result, setResult] = useState<AddressResolutionResult | null>(null);

  const run = () => {
    const res = resolveAddress({
      raw_address: rawAddress,
      comune: comune || undefined,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
    });
    setResult(res);
  };

  const qBadge = (v: string) => {
    if (v === "strong") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    if (v === "moderate") return "bg-sky-500/10 text-sky-700 border-sky-500/20";
    if (v === "weak") return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="min-h-svh bg-background">
      <AppHeader />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Address Resolution Engine — Diagnostica
        </h1>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Test risoluzione indirizzo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Indirizzo (es. Via Roma 12)" value={rawAddress} onChange={e => setRawAddress(e.target.value)} />
            <Input placeholder="Comune (opz.)" value={comune} onChange={e => setComune(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Lat (opz.)" value={lat} onChange={e => setLat(e.target.value)} />
              <Input placeholder="Lng (opz.)" value={lng} onChange={e => setLng(e.target.value)} />
            </div>
            <Button onClick={run} className="w-full"><Search className="h-4 w-4 mr-2" />Risolvi indirizzo</Button>
          </CardContent>
        </Card>

        {result && (
          <>
            {/* Identity */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Identità indirizzo</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                <Row label="Input" value={result.address_identity.raw_input} />
                <Row label="Normalizzato" value={result.address_identity.normalized_address_string || "—"} />
                <Row label="Tipo strada" value={result.address_identity.normalized_street_type || "—"} />
                <Row label="Nome strada" value={result.address_identity.normalized_street_name || "—"} />
                <Row label="Comune" value={result.address_identity.normalized_comune || "—"} />
              </CardContent>
            </Card>

            {/* Normalization */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Normalizzazione</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                <Row label="Civico grezzo" value={result.address_normalization.house_number_raw || "—"} />
                <Row label="Civico norm." value={result.address_normalization.house_number_normalized || "—"} />
                <Row label="Scala" value={result.address_normalization.staircase_raw || "—"} />
                <Row label="Interno" value={result.address_normalization.internal_raw || "—"} />
                {result.address_normalization.ambiguity_flags.length > 0 && (
                  <div className="flex items-start gap-1.5 pt-1">
                    <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-amber-600">{result.address_normalization.ambiguity_flags.join(", ")}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Street match */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Match strada</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                <Row label="Status" value={streetMatchLabel(result.address_resolution.matched_street_status)} />
                <Row label="Nome matched" value={result.address_resolution.matched_street_name || "—"} />
                <Row label="Confidenza" value={`${Math.round(result.address_resolution.matched_street_confidence * 100)}%`} />
                <Row label="Metodo" value={result.address_resolution.matched_by} />
                <Row label="Ambiguità" value={result.address_resolution.ambiguity_level} />
                <Row label="Candidati" value={String(result.address_resolution.candidate_count)} />
              </CardContent>
            </Card>

            {/* Civic match */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Match civico</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                <Row label="Presente" value={result.civic_resolution.civic_input_present ? "Sì" : "No"} />
                <Row label="Normalizzato" value={result.civic_resolution.civic_normalized || "—"} />
                <Row label="Status" value={civicMatchLabel(result.civic_resolution.civic_match_status)} />
                <Row label="Confidenza" value={`${Math.round(result.civic_resolution.civic_confidence * 100)}%`} />
                <Row label="Ambiguità" value={result.civic_resolution.civic_ambiguity} />
                <div className="pt-2 border-t border-border/40 space-y-1.5">
                  <Row label="Localizzazione precisa?" value={result.civic_resolution.civic_supported_as_precise_location ? "Sì" : "No"} />
                  <Row label="Verità stabile?" value={result.civic_resolution.civic_supported_as_building_truth ? "Sì" : "No"} />
                </div>
                <p className="text-[10px] text-muted-foreground/70 italic pt-1">{result.civic_resolution.civic_reasoning_summary}</p>
              </CardContent>
            </Card>

            {/* Quality */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Qualità</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Qualità complessiva</span>
                  <Badge variant="outline" className={qBadge(result.address_quality.overall_address_quality)}>
                    {addressQualityLabel(result.address_quality.overall_address_quality)}
                  </Badge>
                </div>
                <Row label="Forza match strada" value={result.address_quality.street_match_strength} />
                <Row label="Forza match civico" value={result.address_quality.civic_match_strength} />
                <Row label="Dipendenza geocoding" value={result.address_quality.geocoding_dependency_level} />
                <Row label="Rischio sovraprecisione" value={result.address_quality.overprecision_risk} />
                <Row label="Rischio falsa specificità" value={result.address_quality.false_specificity_risk} />
              </CardContent>
            </Card>

            {/* Limitations */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Limitazioni e trasparenza
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                <Row label="Registro stradario" value={result.address_limitations.missing_official_address_registry ? "Mancante" : "Disponibile"} />
                <Row label="Registro civici" value={result.address_limitations.missing_civic_registry ? "Mancante" : "Disponibile"} />
                <Row label="Link preciso edificio" value={result.address_limitations.no_precise_building_link ? "No" : "Sì"} />
                {result.address_limitations.transparency_notes.map((n, i) => (
                  <p key={i} className="text-[10px] text-muted-foreground/70 italic">{n}</p>
                ))}
              </CardContent>
            </Card>

            {/* Reportability */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Reportability</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-xs">
                {Object.entries(result.address_reportability.sections).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between py-0.5">
                    <span className="text-muted-foreground">{key}</span>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${
                      val.render_mode === "full" ? "border-emerald-500/30 text-emerald-600" :
                      val.render_mode === "partial" ? "border-amber-500/30 text-amber-600" :
                      "border-red-500/30 text-red-600"
                    }`}>
                      {val.render_mode}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardContent className="pt-4 space-y-2 text-xs">
                <p className="font-semibold text-foreground">{result.address_summary.executive_summary}</p>
                <p className="text-muted-foreground">{result.address_summary.safe_user_summary}</p>
                <p className="text-[10px] text-muted-foreground/60 italic">{result.address_summary.next_best_step}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
