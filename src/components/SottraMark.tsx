import logoS from "@/assets/logo-s-icon.png";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Link } from "react-router-dom";

interface SottraMarkProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Hide the icon, show only text wordmark */
  textOnly?: boolean;
  /** Make the mark a link to this path */
  linkTo?: string;
}

const sizes = {
  sm: { icon: 20, text: "text-lg", gap: "gap-1.5" },
  md: { icon: 24, text: "text-xl", gap: "gap-1.5" },
  lg: { icon: 32, text: "text-2xl", gap: "gap-2" },
};

export default function SottraMark({ size = "md", className, textOnly, linkTo }: SottraMarkProps) {
  const s = sizes[size];
  const [imgOk, setImgOk] = useState(true);

  const content = (
    <div className={cn("flex items-center", s.gap, className)}>
      {!textOnly && imgOk && (
        <img
          src={logoS}
          alt=""
          aria-hidden="true"
          width={s.icon}
          height={s.icon}
          className="object-contain flex-shrink-0"
          style={{ width: s.icon, height: s.icon }}
          fetchPriority="high"
          onError={() => setImgOk(false)}
        />
      )}
      <span className={cn(s.text, "font-black text-foreground tracking-tight leading-none select-none")}>
        Sottra
      </span>
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
        {content}
      </Link>
    );
  }

  return content;
}
