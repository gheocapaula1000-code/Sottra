/**
 * Diagonal semi-transparent watermark overlay.
 * Shows user name + date, repeated across the viewport.
 */
const Watermark = ({ userName }: { userName?: string }) => {
  const name = userName || "utente";
  const date = new Date().toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const label = `${name} — ${date}`;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden select-none"
      aria-hidden="true"
    >
      <div
        className="absolute inset-[-50%] flex flex-wrap items-center justify-center gap-x-24 gap-y-20"
        style={{ transform: "rotate(-30deg)" }}
      >
        {Array.from({ length: 36 }).map((_, i) => (
          <span
            key={i}
            className="whitespace-nowrap text-sm font-semibold text-foreground/[0.07] tracking-wide"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default Watermark;
