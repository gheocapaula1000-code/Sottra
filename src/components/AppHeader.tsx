import { useState } from "react";
import SottraMark from "@/components/SottraMark";
import logoS from "@/assets/logo-s-icon.png";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  /** Content rendered on the right side of the header */
  rightContent?: React.ReactNode;
  /** Override link destination for the Sottra wordmark (default: /app) */
  linkTo?: string;
  /** Additional className for the outer header element */
  className?: string;
}

function CenterLogo() {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <img
      src={logoS}
      alt="Sottra logo"
      className="h-12 w-12 sm:h-14 sm:w-14 object-contain"
      fetchPriority="high"
      onError={() => setOk(false)}
    />
  );
}

/**
 * Shared 3-column header used across all internal pages.
 * Left: "Sottra" text-only wordmark
 * Center: logo icon (large, transparent, with onError fallback)
 * Right: caller-provided actions
 */
export default function AppHeader({ rightContent, linkTo = "/app", className }: AppHeaderProps) {
  return (
    <header className={cn("sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md", className)}>
      <div className="relative mx-auto grid h-16 sm:h-[72px] max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
        {/* Left — text only */}
        <SottraMark size="md" textOnly linkTo={linkTo} className="shrink-0 justify-self-start" />

        {/* Center — logo icon */}
        <CenterLogo />

        {/* Right — actions */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2.5">
          {rightContent}
        </div>
      </div>
    </header>
  );
}
