import Link from "next/link";

/* MetricCard — palette Prune-Améthyste synchronisée avec tailwind.config.ts */
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
      <div
        className={`text-2xs font-medium ${
          active ? "text-ai-text" : "text-muted"
        }`}
      >
        {label}
      </div>

      <div
        className={`mt-1.5 text-xl leading-none text-ink ${
          active ? "font-bold" : "font-semibold"
        }`}
      >
        {value}
      </div>

      {sub && (
        <div className="mt-1 text-2xs text-muted/80">{sub}</div>
      )}

      {trend && (
        <div
          className={`mt-1 text-2xs font-semibold ${
            trend.startsWith("DN")
              ? "text-danger-600"
              : "text-success-600"
          }`}
        >
          {trend}
        </div>
      )}
    </>
  );

  /* Styles de base — hover améthyste au lieu du gris chaud précédent */
  const base = [
    "block rounded-xl px-4 py-3 transition-all duration-[150ms]",
    alert
      ? "border border-danger-200 bg-danger-50/60"
      : active
      ? "border-2 border-ai-text bg-ai-textbg shadow-xs"
      : "border border-hair bg-canvas shadow-xs",
  ].join(" ");

  /* Hover avec bordure améthyste légère #bb9fff */
  const interactive =
    "cursor-pointer hover:shadow-sm hover:border-[#bb9fff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30";

  if (href) {
    return (
      <Link href={href} className={`${base} ${interactive}`}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} ${interactive} w-full text-left`}
      >
        {content}
      </button>
    );
  }

  return <div className={base}>{content}</div>;
}
