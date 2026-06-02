type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary:
    "bg-page text-white shadow-sm hover:bg-[#1e3e65] active:scale-[0.975]",
  secondary:
    "border border-hair bg-card text-ink shadow-xs hover:bg-canvas hover:border-[#cac4b9] hover:shadow-sm active:scale-[0.975]",
  ghost:
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
