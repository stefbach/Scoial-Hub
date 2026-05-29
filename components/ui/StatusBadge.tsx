type Tone = "green" | "red" | "amber" | "gray" | "blue";

const TONES: Record<Tone, string> = {
  green: "bg-green-50 text-green-700",
  red: "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-700",
  gray: "bg-canvas text-muted",
  blue: "bg-ai-textbg text-ai-text",
};

export function StatusBadge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
