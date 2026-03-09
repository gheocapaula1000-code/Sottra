import logoS from "@/assets/logo-s-icon.png";
import { cn } from "@/lib/utils";

interface SottraMarkProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { img: "h-7 sm:h-8", text: "text-lg sm:text-xl", ml: "-0.25rem", translateY: "1px" },
  md: { img: "h-9 sm:h-10", text: "text-[1.4rem] sm:text-[1.6rem]", ml: "-0.3rem", translateY: "1.5px" },
  lg: { img: "h-12 sm:h-14", text: "text-[1.75rem] sm:text-[2rem]", ml: "-0.35rem", translateY: "2px" },
};

export default function SottraMark({ size = "md", className }: SottraMarkProps) {
  const s = sizes[size];

  return (
    <div className={cn("flex items-center", className)}>
      <img
        src={logoS}
        alt="Sottra"
        className={cn(s.img, "w-auto")}
        style={{
          mixBlendMode: "lighten",
          transform: `translateY(${s.translateY})`,
        }}
        fetchPriority="high"
      />
      <span
        className={cn(s.text, "font-black text-foreground tracking-tight leading-none")}
        style={{ marginLeft: s.ml }}
      >
        ottra
      </span>
    </div>
  );
}
