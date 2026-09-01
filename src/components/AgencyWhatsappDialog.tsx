import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { normalizeItalianMobile } from "@/lib/agencyWhatsapp";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Riceve il numero normalizzato E.164 e prosegue con l'invio. */
  onSaved: (e164: string) => void | Promise<void>;
  saving?: boolean;
  initialValue?: string | null;
}

const AgencyWhatsappDialog = ({ open, onOpenChange, onSaved, saving, initialValue }: Props) => {
  const [value, setValue] = useState(initialValue ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const norm = normalizeItalianMobile(value);
    if (!norm) {
      setError("Inserisci un cellulare italiano valido (es. 345 678 9012).");
      return;
    }
    setError(null);
    await onSaved(norm);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>WhatsApp dell'agenzia in cui lavori</DialogTitle>
          <DialogDescription>
            Il report viene inviato solo a questo numero. Lo salvi una volta, poi basta un tap.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="tel"
          inputMode="tel"
          autoFocus
          placeholder="345 678 9012"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
          className="text-base min-h-[48px]"
          aria-label="WhatsApp dell'agenzia"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button className="w-full min-h-[48px]" disabled={saving} onClick={() => void submit()}>
            {saving ? "Salvataggio…" : "Salva e invia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AgencyWhatsappDialog;
