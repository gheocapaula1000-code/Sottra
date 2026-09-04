import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, User, FileText, Copy, Check, Share2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ImportOriginBadge } from "@/components/keydraft/ImportOriginBadge";
import { ImportStatusBadge } from "@/components/keydraft/ImportStatusBadge";
import { fetchImportById, updateDraftStatus } from "@/services/keydraftImport";
import type { KeyDraftImportRecord, ImportDraftStatus } from "@/types/keydraft";
import { RESULT_SAFE_BOTTOM_PAD } from "@/lib/resultChrome";
import {
  captureReportElement,
  shareOutcomeToast,
  shareReportPayload,
  tryBuildReportShareFile,
  waitForCaptureLayout,
} from "@/lib/shareReportImage";
import { buildWhatsappShareUrl } from "@/lib/agencyWhatsapp";
import { useAgencyWhatsapp } from "@/hooks/useAgencyWhatsapp";
import { buildImportedDraftShareText, buildImportedDraftShareTitle } from "@/lib/shareDraft";

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-3 ${className ?? ""}`}>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 gap-1 text-xs">
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiato" : "Copia"}
    </Button>
  );
}

function FieldRow({ label, value, origin }: { label: string; value: string | number | boolean | null | undefined; origin?: string }) {
  if (value == null || value === "") return null;
  const displayValue = typeof value === "boolean" ? (value ? "Sì" : "No") : String(value);
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-border/30 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground font-medium mt-0.5">{displayValue}</p>
      </div>
      {origin && (
        <ImportOriginBadge origin={origin as never} className="shrink-0 mt-0.5" />
      )}
    </div>
  );
}

function TextBlock({ title, text, origin }: { title: string; text: string; origin?: string }) {
  return (
    <div className="rounded-xl bg-muted/30 border border-border/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-foreground">{title}</p>
          {origin && <ImportOriginBadge origin={origin as never} />}
        </div>
        <CopyButton text={text} />
      </div>
      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  );
}

export default function ImportedDraftDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [record, setRecord] = useState<KeyDraftImportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const reportRootRef = useRef<HTMLDivElement>(null);
  const { phone: agencyPhone } = useAgencyWhatsapp();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchImportById(id)
      .then(setRecord)
      .catch(() => toast({ title: "Errore", description: "Impossibile caricare la bozza", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [id, toast]);

  const handleStatusChange = async (status: ImportDraftStatus) => {
    if (!record) return;
    setSaving(true);
    try {
      await updateDraftStatus(record.id, status);
      setRecord({ ...record, status });
      toast({ title: "Stato aggiornato" });
    } catch {
      toast({ title: "Errore", description: "Impossibile aggiornare lo stato", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!record || capturing) {
      if (!record) {
        toast({
          title: "Condivisione non disponibile",
          description: "La scheda non è ancora pronta.",
          variant: "destructive",
        });
      }
      return;
    }
    const title = buildImportedDraftShareTitle(record);
    const text = buildImportedDraftShareText(record);
    const whatsappUrl = buildWhatsappShareUrl(agencyPhone, text);
    const appUrl = typeof window !== "undefined" && /^https?:\/\//i.test(window.location.origin)
      ? window.location.origin
      : null;
    const facadeSrc = record.bridge_payload.photo_derived?.photo_urls?.[0] ?? null;

    setCapturing(true);
    document.documentElement.setAttribute("data-sottra-capture", "1");
    try {
      await waitForCaptureLayout();
      const root = reportRootRef.current;
      const file = root
        ? await tryBuildReportShareFile({
          root,
          title,
          capture: (el) => captureReportElement(el, { facadeSrc }),
        })
        : null;
      const outcome = await shareReportPayload({
        file,
        title,
        text,
        url: appUrl,
        whatsappUrl,
      });
      const feedback = shareOutcomeToast(outcome, file?.name ?? null);
      if (feedback) toast(feedback);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast({
        title: "Condivisione non riuscita",
        description: "Riprova, oppure copia il testo e invialo da WhatsApp.",
        variant: "destructive",
      });
    } finally {
      document.documentElement.removeAttribute("data-sottra-capture");
      setCapturing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-background pb-safe">
        <AppHeader />
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-dvh bg-background pb-safe">
        <AppHeader />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Bozza non trovata.</p>
          <Button variant="outline" className="mt-4 min-h-[48px]" onClick={() => navigate("/app/imports")}>
            Torna alle bozze
          </Button>
        </div>
      </div>
    );
  }

  const payload = record.bridge_payload;
  const property = payload.property;
  const agent = payload.agent_supplied;
  const _photoDerived = payload.photo_derived;
  const generatedText = payload.generated_text;
  const _originMap = record.origin_map ?? {};

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <div data-capture-hide>
        <AppHeader rightContent={
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => void handleShare()}
            disabled={capturing}
            aria-label="Invia il report"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        } />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
      <div
        ref={reportRootRef}
        data-testid="imported-draft-root"
        className="max-w-2xl mx-auto px-4 py-6 space-y-4 w-full"
        style={{ paddingBottom: RESULT_SAFE_BOTTOM_PAD }}
      >
        {/* Back + header */}
        <div data-capture-hide>
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate("/app/imports")}>
          <ArrowLeft className="h-4 w-4" /> Bozze importate
        </Button>
        </div>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {agent?.address ?? "Bozza importata"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              ID: {record.listing_id} · Importata il {new Date(record.created_at).toLocaleDateString("it-IT")}
            </p>
          </div>
          <ImportStatusBadge status={record.status} />
        </div>

        {/* Status actions */}
        <div className="flex gap-2 flex-wrap">
          {record.status === "importata" && (
            <Button size="sm" className="min-h-[44px]" disabled={saving} onClick={() => handleStatusChange("in_lavorazione")}>
              Inizia lavorazione
            </Button>
          )}
          {record.status === "in_lavorazione" && (
            <Button size="sm" className="min-h-[44px]" disabled={saving} onClick={() => handleStatusChange("completata")}>
              Segna come completata
            </Button>
          )}
          {record.status !== "archiviata" && (
            <Button variant="outline" size="sm" className="min-h-[44px]" disabled={saving} onClick={() => handleStatusChange("archiviata")}>
              Archivia
            </Button>
          )}
        </div>

        {/* Property (photo-derived) */}
        {property && (
          <Section title="Dati rilevati dalle foto">
            <div className="flex items-center gap-2 mb-2">
              <Camera className="h-4 w-4 text-blue-400" />
              <ImportOriginBadge origin="photo_derived" />
            </div>
            <FieldRow label="Tipologia" value={property.property_type} origin="photo_derived" />
            <FieldRow label="Locali stimati" value={property.rooms_estimated} origin="photo_derived" />
            <FieldRow label="Bagni stimati" value={property.bathrooms_estimated} origin="photo_derived" />
            <FieldRow label="Piani stimati" value={property.floors_estimated} origin="photo_derived" />
            <FieldRow label="Condizione stimata" value={property.condition_estimated} origin="photo_derived" />
            {property.materials_detected && property.materials_detected.length > 0 && (
              <FieldRow label="Materiali rilevati" value={property.materials_detected.join(", ")} origin="photo_derived" />
            )}
            {property.features_detected && property.features_detected.length > 0 && (
              <FieldRow label="Caratteristiche rilevate" value={property.features_detected.join(", ")} origin="photo_derived" />
            )}
            <FieldRow label="Foto analizzate" value={property.photo_count} origin="photo_derived" />
          </Section>
        )}

        {/* Agent-supplied data */}
        {agent && (
          <Section title="Dati inseriti dall'agente">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-violet-400" />
              <ImportOriginBadge origin="agent_supplied" />
            </div>
            <FieldRow label="Indirizzo" value={agent.address} origin="agent_supplied" />
            <FieldRow label="Superficie (m²)" value={agent.surface_sqm} origin="agent_supplied" />
            <FieldRow label="Piano" value={agent.floor} origin="agent_supplied" />
            <FieldRow label="Ascensore" value={agent.elevator} origin="agent_supplied" />
            <FieldRow label="Prezzo richiesto" value={agent.price_asked ? `€ ${agent.price_asked.toLocaleString("it-IT")}` : null} origin="agent_supplied" />
            <FieldRow label="Spese mensili" value={agent.expenses_monthly ? `€ ${agent.expenses_monthly.toLocaleString("it-IT")}` : null} origin="agent_supplied" />
            <FieldRow label="Classe energetica" value={agent.energy_class} origin="agent_supplied" />
            <FieldRow label="Disponibilità" value={agent.availability} origin="agent_supplied" />
            <FieldRow label="Note commerciali" value={agent.commercial_notes} origin="agent_supplied" />
            {agent.agent_notes_freeform && (
              <div className="rounded-lg bg-violet-500/5 border border-violet-500/20 p-3 mt-2">
                <p className="text-[10px] font-medium text-violet-400 uppercase mb-1">Note libere dell'agente</p>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{agent.agent_notes_freeform}</p>
              </div>
            )}
          </Section>
        )}

        {/* Generated texts */}
        {generatedText && (
          <Section title="Testi generati">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-amber-400" />
              <ImportOriginBadge origin="generated_text" />
            </div>
            <div className="space-y-3">
              {generatedText.primary_listing_text && (
                <TextBlock title="Annuncio principale" text={generatedText.primary_listing_text} origin="generated_text" />
              )}
              {generatedText.listing_text_long && (
                <TextBlock title="Annuncio esteso" text={generatedText.listing_text_long} origin="generated_text" />
              )}
              {generatedText.listing_text_short && (
                <TextBlock title="Annuncio breve" text={generatedText.listing_text_short} origin="generated_text" />
              )}
              {generatedText.whatsapp_ready_summary && (
                <TextBlock title="Riepilogo WhatsApp" text={generatedText.whatsapp_ready_summary} origin="generated_text" />
              )}
              {generatedText.listing_social_variants && generatedText.listing_social_variants.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Varianti social</p>
                  {generatedText.listing_social_variants.map((v, i) => (
                    <TextBlock key={i} title={v.platform} text={v.text} origin="generated_text" />
                  ))}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Sottra completions */}
        <Section title="Completamento in Sottra">
          <div className="flex items-center gap-2 mb-2">
            <ImportOriginBadge origin="completed_in_sottra" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            I campi seguenti possono essere completati o corretti direttamente in Sottra per finalizzare la scheda immobile.
          </p>
          <div className="mt-3 space-y-1">
            <FieldRow label="Indirizzo completo" value={record.sottra_completions?.indirizzo_completo} origin="completed_in_sottra" />
            <FieldRow label="Superficie (m²)" value={record.sottra_completions?.superficie_mq} origin="completed_in_sottra" />
            <FieldRow label="Piano" value={record.sottra_completions?.piano} origin="completed_in_sottra" />
            <FieldRow label="Ascensore" value={record.sottra_completions?.ascensore} origin="completed_in_sottra" />
            <FieldRow label="Prezzo richiesto" value={record.sottra_completions?.prezzo_richiesto} origin="completed_in_sottra" />
            <FieldRow label="Spese mensili" value={record.sottra_completions?.spese_mensili} origin="completed_in_sottra" />
            <FieldRow label="Classe energetica" value={record.sottra_completions?.classe_energetica} origin="completed_in_sottra" />
            <FieldRow label="Disponibilità" value={record.sottra_completions?.disponibilita} origin="completed_in_sottra" />
            <FieldRow label="Note commerciali" value={record.sottra_completions?.note_commerciali} origin="completed_in_sottra" />
            <FieldRow label="Note documentali" value={record.sottra_completions?.note_documentali} origin="completed_in_sottra" />
          </div>
          {!Object.values(record.sottra_completions ?? {}).some(v => v != null && v !== "") && (
            <p className="text-xs text-muted-foreground/50 italic mt-2">
              Nessun campo ancora completato in Sottra. Usa questa sezione per aggiungere o correggere i dati mancanti.
            </p>
          )}
        </Section>

        {/* Bridge metadata */}
        {payload.bridge_status && (
          <div className="rounded-xl bg-muted/20 border border-border/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
            <p>Stato bridge: <span className="font-medium text-foreground">{payload.bridge_status.status}</span></p>
            {payload.bridge_status.trace_id && <p>Trace: {payload.bridge_status.trace_id}</p>}
            {payload.bridge_status.warnings && payload.bridge_status.warnings.length > 0 && (
              <p>Avvisi: {payload.bridge_status.warnings.join("; ")}</p>
            )}
          </div>
        )}
      </div>
      </div>

      <footer
        data-capture-hide
        data-testid="imported-draft-action-bar"
        className="shrink-0 border-t border-border/50 bg-background px-4 sm:px-5 pt-3 z-40"
        style={{
          paddingBottom: RESULT_SAFE_BOTTOM_PAD,
          paddingLeft: "max(env(safe-area-inset-left, 0px), 16px)",
          paddingRight: "max(env(safe-area-inset-right, 0px), 16px)",
        }}
      >
        <Button
          className="w-full min-h-[48px] active:scale-[0.97] transition-transform"
          size="lg"
          onClick={() => void handleShare()}
          disabled={capturing}
          aria-label="Invia il report"
        >
          <Share2 className="h-4 w-4" />
          {capturing ? "Preparazione…" : "Invia il report"}
        </Button>
      </footer>
    </div>
  );
}
