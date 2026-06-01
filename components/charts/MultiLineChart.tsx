export interface ChartSeries {
  id: string;
  label: string;
  data: number[];
  color: string;
  dashed?: boolean;
}

export function MultiLineChart({ series }: { series: ChartSeries[] }) {
  const w = 560;
  const h = 180;
  const pad = 8;

  const allValues = series.flatMap((s) => s.data);
  const max = (allValues.length ? Math.max(...allValues) : 1) * 1.1 || 1;

  const toPath = (data: number[]) =>
    data
      .map((v, i) => {
        const x = pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
        const y = h - pad - (v / max) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
        {series.map((s) => (
          <path
            key={s.id}
            d={toPath(s.data)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.dashed ? 1.5 : 2}
            strokeDasharray={s.dashed ? "4 3" : undefined}
          />
        ))}
        {series.length === 0 && (
          <text x={w / 2} y={h / 2} textAnchor="middle" className="fill-muted text-xs">
            Select a metric to plot
          </text>
        )}
      </svg>
      {series.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-4 text-2xs text-muted">
          {series.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4"
                style={s.dashed ? { borderTop: `1px dashed ${s.color}` } : { backgroundColor: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
