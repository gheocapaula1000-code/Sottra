import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAgencyWhatsapp } from "@/hooks/useAgencyWhatsapp";
import { formatAgencyWhatsapp } from "@/lib/agencyWhatsapp";

const AgencyWhatsappCard = () => {
  const { phone, save, saving } = useAgencyWhatsapp();
  const { toast } = useToast();
  const [value, setValue] = useState(phone ?? "");

  useEffect(() => {
    if (phone) setValue(phone);
  }, [phone]);

  const submit = async () => {
    const saved = await save(value);
    if (!saved) {
      toast({ title: "Numero non valido", description: "Inserisci un cellulare italiano (es. 345 678 9012).", variant: "destructive" });
      return;
    }
    setValue(saved);
    toast({ title: "WhatsApp agenzia salvato", description: formatAgencyWhatsapp(saved) });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          WhatsApp agenzia
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-xs text-muted-foreground">
          I report vengono inviati a questo numero con un tap dalla pagina risultato.
        </p>
        <Input
          type="tel"
          inputMode="tel"
          placeholder="345 678 9012"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
          className="text-base min-h-[48px]"
          aria-label="WhatsApp agenzia"
        />
        <Button className="w-full min-h-[44px]" variant="outline" disabled={saving} onClick={() => void submit()}>
          {saving ? "Salvataggio…" : phone ? "Aggiorna numero" : "Salva numero"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AgencyWhatsappCard;
