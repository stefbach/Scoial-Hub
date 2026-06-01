import Link from "next/link";

export interface Crumb {
  href?: string;
  label: string;
}

export function Breadcrumb({ trail }: { trail: Crumb[] }) {
  return (
    <nav className="mb-3 text-2xs text-muted">
      {trail.map((c, i) => {
        const last = i === trail.length - 1;
        return (
          <span key={i}>
            {c.href && !last ? (
              <Link href={c.href} className="hover:text-ink">
                {c.label}
              </Link>
            ) : (
              <span className={last ? "text-ink" : ""}>{c.label}</span>
            )}
            {!last && <span className="mx-1.5 text-hair">›</span>}
          </span>
        );
      })}
    </nav>
  );
}
