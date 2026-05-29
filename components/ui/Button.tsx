type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-page text-white hover:bg-page/90",
  secondary: "border-hair border-hair bg-card text-ink hover:bg-canvas",
  ghost: "text-ink hover:bg-canvas",
  danger: "border-hair border-red-200 bg-card text-red-600 hover:bg-red-50",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: { variant?: Variant } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
