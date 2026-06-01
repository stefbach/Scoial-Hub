"use client";

import { useRef, useState } from "react";

export interface ChartSeries {
  id: string;
  label: string;
  data: number[];
  color: string;
  dashed?: boolean;
  format?: (value: number) => string;
}

export function MultiLineChart({ series }: { series: ChartSeries[] }) {
  const w = 560;
  const h = 180;
  const pad = 8;

  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; xPct: number } | null>(null);

  const allValues = series.flatMap((s) => s.data);
  const max = (allValues.length ? Math.max(...allValues) : 1) * 1.1 || 1;
  const days = series.length ? series[0].data.length : 0;

  const toPath = (data: number[]) =>
    data
      .map((v, i) => {
        const x = pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
        const y = h - pad - (v / max) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || days === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.min(1, Math.max(0, x / rect.width));
    const i = Math.min(days - 1, Math.round(ratio * (days - 1)));
    setHover({ i, xPct: (i / Math.max(1, days - 1)) * 100 });
  };

  return (
    <div>
      <div
        ref={containerRef}
        className="relative"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
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

        {hover && series.length > 0 && (
          <>
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-hair"
              style={{ left: `calc(${hover.xPct}% )` }}
            />
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border-hair border-hair bg-card px-2 py-1 text-2xs text-ink shadow-md"
              style={{
                left: `calc(${hover.xPct}% )`,
                top: -8,
              }}
            >
              <div className="font-medium text-muted">Day {hover.i + 1}</div>
              {series.map((s) => {
                const v = s.data[hover.i];
                return (
                  <div key={s.id} className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span>{s.label}:</span>
                    <span className="font-medium">{s.format ? s.format(v) : v.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

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
