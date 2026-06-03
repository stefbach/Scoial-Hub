type Variant = "primary" | "secondary" | "ghost" | "danger";

/* Variantes — palette Prune-Améthyste synchronisée avec tailwind.config.ts */
const styles: Record<Variant, string> = {
  primary:
    // Prune-violet profond, hover vers améthyste #6d28d9
    "bg-page text-white shadow-sm hover:bg-[#6d28d9] active:scale-[0.975]",
  secondary:
    // Blanc + bordure lavande, hover fond canvas + bordure améthyste légère
    "border border-hair bg-card text-ink shadow-xs hover:bg-canvas hover:border-[#bb9fff] hover:shadow-sm active:scale-[0.975]",
  ghost:
    // Sans fond, hover lavande canvas
    "text-ink hover:bg-canvas active:scale-[0.975]",
  danger:
    "border border-danger-200 bg-card text-danger-700 shadow-xs hover:bg-danger-50 hover:border-danger-300 active:scale-[0.975]",
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
        // Anneau focus — accent améthyste cohérent
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1",
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
