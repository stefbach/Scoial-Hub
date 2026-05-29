export function BarRow({
  label,
  value,
  max,
  color,
  caption,
  muted = false,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  caption: string;
  muted?: boolean;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className={muted ? "text-muted" : "text-ink"}>{label}</span>
        <span className={muted ? "text-muted" : "text-ink"}>{caption}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-hair">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
