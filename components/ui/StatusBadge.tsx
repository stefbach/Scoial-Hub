type Tone = "green" | "red" | "amber" | "gray" | "blue";

const TONES: Record<Tone, string> = {
  green: "bg-success-50 text-success-700 ring-1 ring-success-500/20",
  red:   "bg-danger-50  text-danger-700  ring-1 ring-danger-500/20",
  amber: "bg-warning-50 text-warning-700 ring-1 ring-warning-500/20",
  gray:  "bg-canvas text-muted ring-1 ring-hair",
  blue:  "bg-ai-textbg text-ai-text ring-1 ring-ai-text/20",
};

/* Petits points de couleur par tone (optionnel — toujours présent pour l'accessibilité visuelle) */
const DOTS: Record<Tone, string> = {
  green: "bg-success-500",
  red:   "bg-danger-500",
  amber: "bg-warning-500",
  gray:  "bg-muted",
  blue:  "bg-ai-text",
};

export function StatusBadge({
  children,
  tone = "gray",
  dot = false,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-semibold ${TONES[tone]}`}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOTS[tone]}`}
        />
      )}
      {children}
    </span>
  );
}
