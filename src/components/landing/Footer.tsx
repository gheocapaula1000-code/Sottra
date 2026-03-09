import { LEGAL_ENTITY } from "@/lib/legalEntity";
import logoS from "@/assets/logo-s-icon.png";

export default function Footer() {
  return (
    <footer className="border-t border-border px-5 py-10 sm:px-10 lg:px-20">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 text-center">
        <div className="flex items-center gap-0">
          <img
            src={logoS}
            alt="Sottra"
            className="h-7 w-auto"
            style={{ mixBlendMode: "lighten" }}
          />
          <span className="ml-[-0.3rem] text-lg font-black text-foreground leading-none">
            ottra
          </span>
        </div>
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
          <a
            href="/privacy-policy"
            className="hover:text-foreground transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href="/cookie-policy"
            className="hover:text-foreground transition-colors"
          >
            Cookie Policy
          </a>
          <a
            href="/termini-condizioni"
            className="hover:text-foreground transition-colors"
          >
            Termini e Condizioni
          </a>
          <a
            href="/note-legali"
            className="hover:text-foreground transition-colors"
          >
            Note Legali
          </a>
        </nav>
        <p className="text-[10px] text-muted-foreground sm:text-xs">
          © 2026 Sottra By {LEGAL_ENTITY.companyName} — P.IVA{" "}
          {LEGAL_ENTITY.vatNumber} — Tutti i diritti riservati
        </p>
      </div>
    </footer>
  );
}
