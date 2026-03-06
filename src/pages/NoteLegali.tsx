import { useNavigate } from "react-router-dom";
import { LEGAL_ENTITY, val } from "@/lib/legalEntity";

const NoteLegali = () => {
  const navigate = useNavigate();
  const e = LEGAL_ENTITY;

  return (
    <div className="min-h-svh bg-background px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate(-1)} className="mb-6 text-sm text-muted-foreground hover:text-foreground transition-colors">← Torna indietro</button>

        <h1 className="text-2xl font-bold text-foreground mb-6">Note Legali</h1>

        <div className="space-y-4 text-sm text-foreground/90 leading-relaxed">
          <p><strong>Titolare:</strong> {val(e.companyName)}</p>
          <p><strong>Sede legale:</strong> {val(e.address)} {val(e.cap)} {val(e.city)} ({val(e.province)})</p>
          <p><strong>P.IVA:</strong> {val(e.vatNumber)}</p>
          <p><strong>Codice Fiscale:</strong> {val(e.fiscalCode)}</p>
          <p><strong>Email:</strong> {val(e.email)}</p>
          <p><strong>PEC:</strong> {val(e.pec)}</p>
          <p><strong>Telefono:</strong> {val(e.phone)}</p>
          <p><strong>Hosting:</strong> Lovable / Supabase</p>

          <p className="text-xs text-muted-foreground pt-4">Ultimo aggiornamento: marzo 2026</p>
        </div>
      </div>
    </div>
  );
};

export default NoteLegali;
