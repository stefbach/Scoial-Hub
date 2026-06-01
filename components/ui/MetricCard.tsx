import Link from "next/link";

export function MetricCard({
  label,
  value,
  sub,
  trend,
  alert = false,
  href,
  active = false,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  trend?: string;
  alert?: boolean;
  href?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className={`text-2xs ${active ? "font-medium text-ai-text" : "text-muted"}`}>{label}</div>
      <div className={`mt-1 text-xl text-ink ${active ? "font-bold" : "font-semibold"}`}>{value}</div>
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
    </>
  );

  const base = `block rounded-lg px-4 py-3 ${
    alert
      ? "border-hair border-red-200 bg-red-50"
      : active
      ? "border-2 border-ai-text bg-ai-textbg"
      : "border-hair border-hair bg-canvas"
  }`;

  if (href) {
    return (
      <Link
        href={href}
        className={`${base} cursor-pointer transition-shadow hover:border-muted/40 hover:shadow-sm`}
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} cursor-pointer text-left transition-shadow hover:border-muted/40 hover:shadow-sm`}
      >
        {content}
      </button>
    );
  }

  return <div className={base}>{content}</div>;
}
