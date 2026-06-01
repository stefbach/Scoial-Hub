"use client";

export function SubHeader({
  title,
  scope,
  scopeLabel,
}: {
  title: string;
  scope: "org" | "company";
  scopeLabel: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <span className="text-hair">|</span>
      <span className="text-sm text-muted">
        {scope === "org" ? "Organization:" : "Settings for"}{" "}
        <span className="font-semibold text-ink">{scopeLabel}</span>
      </span>
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="section-label mb-2 mt-4 first:mt-0">{children}</div>;
}

export function RowCard({
  title,
  desc,
  control,
}: {
  title: string;
  desc: string;
  control: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between rounded-md border-hair border-hair p-3">
      <div className="pr-4">
        <div className="text-sm font-medium text-ink">{title}</div>
        <div className="text-2xs text-muted">{desc}</div>
      </div>
      {control}
    </div>
  );
}
