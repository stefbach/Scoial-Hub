export function Meter({
  value,
  max,
  tone = "page",
}: {
  value: number;
  max: number;
  tone?: "page" | "ai";
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color = tone === "ai" ? "bg-ai-visual" : "bg-page";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-hair">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
