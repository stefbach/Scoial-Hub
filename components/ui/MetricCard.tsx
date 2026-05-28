export function MetricCard({
  label,
  value,
  sub,
  trend,
  alert = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  trend?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border-hair px-4 py-3 ${
        alert ? "border-red-200 bg-red-50" : "border-hair bg-canvas"
      }`}
    >
      <div className="text-2xs text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold text-ink">{value}</div>
      {sub && <div className="text-2xs text-muted">{sub}</div>}
      {trend && (
        <div
          className={`text-2xs font-medium ${
            trend.startsWith("DN") ? "text-red-500" : "text-green-600"
          }`}
        >
          {trend}
        </div>
      )}
    </div>
  );
}
