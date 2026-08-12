"use client";

// Courbe multi-séries AVEC AXES CHIFFRÉS.
//
// Sans graduations, une courbe ne dit rien : on voit une forme, jamais un
// ordre de grandeur ni une date. Les libellés d'axes sont rendus en HTML et
// non en SVG, car le tracé utilise `preserveAspectRatio="none"` pour occuper
// toute la largeur — ce qui étirerait horizontalement n'importe quel <text>
// SVG et rendrait les valeurs illisibles.

import { useRef, useState } from "react";
import { niceCeil, tickIndexes } from "@/lib/charts/scale";

export interface ChartSeries {
  id: string;
  label: string;
  data: number[];
  color: string;
  dashed?: boolean;
  format?: (value: number) => string;
}

const plain = (v: number) => v.toLocaleString();

export function MultiLineChart({
  series,
  labels,
}: {
  series: ChartSeries[];
  /** Libellés d'abscisse (dates…), un par point. À défaut : le rang du point. */
  labels?: string[];
}) {
  const w = 560;
  const h = 180;
  const pad = 8;

  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; xPct: number } | null>(null);

  const allValues = series.flatMap((s) => s.data);
  const rawMax = allValues.length ? Math.max(...allValues) : 0;
  // Échelle et graduations partagent la MÊME borne : une courbe qui touche le
  // haut du cadre vaut exactement la valeur affichée en haut de l'axe.
  const max = niceCeil(rawMax);
  const days = series.length ? series[0].data.length : 0;

  const formatValue = series[0]?.format ?? plain;
  const yTicks = [max, max / 2, 0];
  const xTicks = tickIndexes(days);

  const xLabelAt = (i: number) => labels?.[i] ?? `${i + 1}`;

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
      <div className="flex">
        {/* Axe des ordonnées — aligné sur les lignes de grille du tracé. */}
        <div
          className="flex w-12 shrink-0 flex-col justify-between pr-2 text-right text-[10px] leading-none text-muted"
          style={{ height: h }}
          aria-hidden="true"
        >
          {yTicks.map((v) => (
            <span key={v}>{formatValue(v)}</span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div
            ref={containerRef}
            className="relative"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            style={{ height: h }}
          >
            <svg
              viewBox={`0 0 ${w} ${h}`}
              className="h-full w-full"
              preserveAspectRatio="none"
              role="img"
              aria-label={
                series.length
                  ? `${series.map((s) => s.label).join(", ")} — ${xLabelAt(0)} → ${xLabelAt(days - 1)}`
                  : undefined
              }
            >
              {/* Grille horizontale : repère de lecture des ordonnées. */}
              {yTicks.map((v) => {
                const y = h - pad - (v / max) * (h - pad * 2);
                return (
                  <line
                    key={v}
                    x1={0}
                    x2={w}
                    y1={y}
                    y2={y}
                    className="stroke-hair"
                    strokeWidth={1}
                    strokeDasharray={v === 0 ? undefined : "3 4"}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
              {series.map((s) => (
                <path
                  key={s.id}
                  d={toPath(s.data)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.dashed ? 1.5 : 2}
                  strokeDasharray={s.dashed ? "4 3" : undefined}
                  vectorEffect="non-scaling-stroke"
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
                  className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-hair bg-card px-2 py-1 text-2xs text-ink shadow-md"
                  style={{ left: `calc(${hover.xPct}% )`, top: -8 }}
                >
                  <div className="font-medium text-muted">{xLabelAt(hover.i)}</div>
                  {series.map((s) => {
                    const formatOne = s.format ?? plain;
                    return (
                      <div key={s.id} className="flex items-center gap-1.5 whitespace-nowrap">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        <span>{s.label}:</span>
                        <span className="font-medium">{formatOne(s.data[hover.i])}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Axe des abscisses — premier et dernier points ancrés aux bords. */}
          {days > 0 && (
            <div className="relative mt-1.5 h-4 text-[10px] leading-none text-muted" aria-hidden="true">
              {xTicks.map((i) => {
                const pct = (i / Math.max(1, days - 1)) * 100;
                const anchor =
                  i === 0 ? "translateX(0)" : i === days - 1 ? "translateX(-100%)" : "translateX(-50%)";
                return (
                  <span
                    key={i}
                    className="absolute whitespace-nowrap"
                    style={{ left: `${pct}%`, transform: anchor }}
                  >
                    {xLabelAt(i)}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {series.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-4 pl-12 text-2xs text-muted">
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
