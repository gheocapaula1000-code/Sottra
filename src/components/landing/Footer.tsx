import { LEGAL_ENTITY, APP_BRAND } from "@/lib/legalEntity";
import SottraMark from "@/components/SottraMark";

export default function Footer() {
  return (
    <footer className="border-t border-border px-5 py-10 pb-safe sm:px-10 lg:px-20">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 text-center">
        <SottraMark size="sm" />
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
          <a href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</a>
          <a href="/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</a>
          <a href="/termini-condizioni" className="hover:text-foreground transition-colors">Termini e Condizioni</a>
          <a href="/note-legali" className="hover:text-foreground transition-colors">Note Legali</a>
        </nav>
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground sm:text-xs">
            © 2026 {LEGAL_ENTITY.companyName} · P.IVA {LEGAL_ENTITY.vatNumber}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {LEGAL_ENTITY.address}, {LEGAL_ENTITY.cap} {LEGAL_ENTITY.city} ({LEGAL_ENTITY.province})
          </p>
          <p className="text-[10px] text-muted-foreground">
            <a href={`mailto:${APP_BRAND.infoEmail}`} className="hover:text-foreground transition-colors">{APP_BRAND.infoEmail}</a>
            {" · "}
            <a href={`mailto:${APP_BRAND.supportEmail}`} className="hover:text-foreground transition-colors">{APP_BRAND.supportEmail}</a>
          </p>
        </div>
      </div>
    </footer>
  );
}