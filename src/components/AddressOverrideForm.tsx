/* eslint-disable react-refresh/only-export-components */
import { useState, useCallback } from "react";
import { MapPin, ChevronDown, ChevronUp, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface ManualAddressInput {
  via: string;
  civico: string;
  cap: string;
  comune: string;
  provincia: string;
}

const EMPTY: ManualAddressInput = { via: "", civico: "", cap: "", comune: "", provincia: "" };

/** Returns true if at least via + comune are filled */
export function isAddressInputValid(input: ManualAddressInput): boolean {
  return input.via.trim().length >= 2 && input.comune.trim().length >= 2;
}

/** Formats a ManualAddressInput into a single address string for the API */
export function formatManualAddress(input: ManualAddressInput): string {
  const parts: string[] = [];
  if (input.via.trim()) {
    parts.push(input.civico.trim() ? `${input.via.trim()} ${input.civico.trim()}` : input.via.trim());
  }
  if (input.cap.trim()) parts.push(input.cap.trim());
  if (input.comune.trim()) parts.push(input.comune.trim());
  if (input.provincia.trim()) parts.push(`(${input.provincia.trim().toUpperCase()})`);
  return parts.join(", ");
}

interface Props {
  onSubmit: (address: ManualAddressInput) => void;
  loading?: boolean;
  className?: string;
}

export default function AddressOverrideForm({ onSubmit, loading, className }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ManualAddressInput>(EMPTY);

  const set = useCallback((field: keyof ManualAddressInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const valid = isAddressInputValid(form);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || loading) return;
    onSubmit(form);
  };

  return (
    <div className={cn(
      "rounded-2xl border border-border/60 bg-card overflow-hidden transition-all duration-300",
      className,
    )}>
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <MapPin className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">Indirizzo immobile</p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            Inserisci l'indirizzo per migliorare la precisione dei dati territoriali
          </p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Collapsible form */}
      {open && (
        <form onSubmit={handleSubmit} className="px-5 pb-5 pt-2 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Via + Civico */}
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <div className="space-y-1">
              <Label htmlFor="addr-via" className="text-[11px] text-muted-foreground">Via / Piazza *</Label>
              <Input
                id="addr-via"
                placeholder="es. Via Roma"
                value={form.via}
                onChange={(e) => set("via", e.target.value)}
                className="h-10 text-[16px] sm:text-sm"
                autoComplete="address-line1"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="addr-civico" className="text-[11px] text-muted-foreground">Civico</Label>
              <Input
                id="addr-civico"
                placeholder="12"
                value={form.civico}
                onChange={(e) => set("civico", e.target.value)}
                className="h-10 text-[16px] sm:text-sm"
              />
            </div>
          </div>

          {/* Comune + CAP + Provincia */}
          <div className="grid grid-cols-[1fr_5rem_3.5rem] gap-2">
            <div className="space-y-1">
              <Label htmlFor="addr-comune" className="text-[11px] text-muted-foreground">Comune *</Label>
              <Input
                id="addr-comune"
                placeholder="es. Padova"
                value={form.comune}
                onChange={(e) => set("comune", e.target.value)}
                className="h-10 text-[16px] sm:text-sm"
                autoComplete="address-level2"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="addr-cap" className="text-[11px] text-muted-foreground">CAP</Label>
              <Input
                id="addr-cap"
                placeholder="35100"
                value={form.cap}
                onChange={(e) => set("cap", e.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                className="h-10 text-[16px] sm:text-sm"
                autoComplete="postal-code"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="addr-prov" className="text-[11px] text-muted-foreground">Prov.</Label>
              <Input
                id="addr-prov"
                placeholder="PD"
                value={form.provincia}
                onChange={(e) => set("provincia", e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 2))}
                className="h-10 text-[16px] sm:text-sm uppercase"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={!valid || loading}
            className="w-full min-h-[48px] mt-1"
            size="lg"
          >
            {loading ? (
              <>
                <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                Aggiornamento in corso…
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4 mr-2" />
                Aggiorna dati territoriali
              </>
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground/50 text-center leading-relaxed">
            I dati verranno ricalcolati in base all'indirizzo inserito, senza consumare un nuovo credito.
          </p>
        </form>
      )}
    </div>
  );
}
