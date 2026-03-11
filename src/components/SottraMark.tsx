import logoS from "@/assets/logo-s-icon.png";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface SottraMarkProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Hide the icon, show only text wordmark */
  textOnly?: boolean;
}

const sizes = {
  sm: { icon: "h-5 w-5", text: "text-lg", gap: "gap-1.5" },
  md: { icon: "h-6 w-6", text: "text-xl", gap: "gap-1.5" },
  lg: { icon: "h-8 w-8", text: "text-2xl", gap: "gap-2" },
};

export default function SottraMark({ size = "md", className, textOnly }: SottraMarkProps) {
  const s = sizes[size];
  const [imgOk, setImgOk] = useState(true);

  return (
    <div className={cn("flex items-center", s.gap, className)}>
      {!textOnly && imgOk && (
        <img
          src={logoS}
          alt=""
          aria-hidden="true"
          className={cn(s.icon, "object-contain flex-shrink-0")}
          fetchPriority="high"
          onError={() => setImgOk(false)}
        />
      )}
      <span className={cn(s.text, "font-black text-foreground tracking-tight leading-none select-none")}>
        Sottra
      </span>
    </div>
  );
}
