export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm rounded-lg border-hair border-hair bg-card p-6 shadow-sm">
        <div className="mb-5 text-center">
          <div className="text-lg font-bold tracking-tight text-ink">Social Hub</div>
        </div>
        <div className="mb-4">
          <h1 className="text-base font-semibold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-2xs text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
