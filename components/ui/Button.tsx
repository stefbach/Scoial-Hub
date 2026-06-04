type Variant = "primary" | "secondary" | "ghost" | "danger";

/* Variantes — palette Prune-Améthyste synchronisée avec tailwind.config.ts.
   Chaque variante déclare son bg de base ET son bg au focus/active explicitement
   pour éviter le flash blanc après un clic (état :focus sans :hover). */
const styles: Record<Variant, string> = {
  primary:
    // Prune-violet profond, stable au focus, hover/active vers améthyste
    "bg-page text-white shadow-sm hover:bg-[#6d28d9] focus:bg-page focus-visible:bg-page active:bg-[#6d28d9] active:scale-[0.975]",
  secondary:
    // Blanc + bordure lavande, fond stable au focus (pas de fond blanc flashé)
    "border border-hair bg-card text-ink shadow-xs hover:bg-canvas hover:border-[#bb9fff] hover:shadow-sm focus:bg-card focus-visible:bg-card active:bg-canvas active:scale-[0.975]",
  ghost:
    // Sans fond de base, mais fond canvas stable au focus/active
    "text-ink hover:bg-canvas focus:bg-transparent focus-visible:bg-transparent active:bg-canvas active:scale-[0.975]",
  danger:
    "border border-danger-200 bg-card text-danger-700 shadow-xs hover:bg-danger-50 hover:border-danger-300 focus:bg-card focus-visible:bg-card active:bg-danger-50 active:scale-[0.975]",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: { variant?: Variant } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={[
        // Base commune
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-[0.4rem]",
        "text-sm font-medium select-none",
        "transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        // Anneau focus-visible — accent améthyste, sans fond blanc parasite
        "focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1",
        "disabled:pointer-events-none disabled:opacity-50",
        // Variante
        styles[variant],
        // Override caller
        className,
      ].join(" ")}
      {...props}
    />
  );
}
