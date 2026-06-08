export function LineChart({
  spend,
  conversions,
}: {
  spend: number[];
  conversions: number[];
}) {
  const w = 560;
  const h = 180;
  const pad = 8;
  const all = [...spend, ...conversions];
  const max = Math.max(...all) * 1.1;

  const toPath = (data: number[]) =>
    data
      .map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (w - pad * 2);
        const y = h - pad - (v / max) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
        <path d={toPath(spend)} fill="none" stroke="#60a5fa" strokeWidth="2" />
        <path
          d={toPath(conversions)}
          fill="none"
          stroke="#4ade80"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      </svg>
      <div className="mt-2 flex gap-4 text-2xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-ai-text" /> Spend (EUR)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t border-dashed border-green-400" />{" "}
          Conversions
        </span>
      </div>
    </div>
  );
}
