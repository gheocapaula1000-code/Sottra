import logoS from "@/assets/logo-s-icon.png";
import { cn } from "@/lib/utils";

interface SottraMarkProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { img: "h-8 sm:h-9", text: "text-lg sm:text-xl", ml: "-0.5rem", translateY: "2.5px" },
  md: { img: "h-10 sm:h-11", text: "text-[1.4rem] sm:text-[1.6rem]", ml: "-0.55rem", translateY: "3px" },
  lg: { img: "h-14 sm:h-16", text: "text-[1.75rem] sm:text-[2rem]", ml: "-0.6rem", translateY: "3.5px" },
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
