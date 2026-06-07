// Identité de marque — AXON-AI · Social Media (module de la suite AXON-AI).
// Logo "axone" : un noyau central + connexions synaptiques rayonnantes.

export function LogoMark({ size = 28, onDark = false }: { size?: number; onDark?: boolean }) {
  const id = onDark ? "axon-grad-d" : "axon-grad-l";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl shadow-sm"
      style={{ width: size, height: size, background: `url(#none)` }}
    >
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#9b6eff" />
            <stop offset="1" stopColor="#5b2d8e" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill={`url(#${id})`} />
        {/* connexions synaptiques */}
        <g stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.85">
          <line x1="16" y1="16" x2="8" y2="9" />
          <line x1="16" y1="16" x2="24" y2="9" />
          <line x1="16" y1="16" x2="9" y2="24" />
          <line x1="16" y1="16" x2="23" y2="23" />
        </g>
        {/* terminaisons */}
        <g fill="#ffffff">
          <circle cx="8" cy="9" r="2" opacity="0.95" />
          <circle cx="24" cy="9" r="2" opacity="0.95" />
          <circle cx="9" cy="24" r="1.7" opacity="0.8" />
          <circle cx="23" cy="23" r="1.7" opacity="0.8" />
        </g>
        {/* noyau */}
        <circle cx="16" cy="16" r="3.4" fill="#ffffff" />
        <circle cx="16" cy="16" r="1.6" fill="#5b2d8e" />
      </svg>
    </span>
  );
}

export function Logo({
  size = 28,
  onDark = false,
  showWordmark = true,
}: {
  size?: number;
  onDark?: boolean;
  showWordmark?: boolean;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} onDark={onDark} />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className="font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)", fontSize: size * 0.58, color: onDark ? "#fff" : "rgb(var(--color-ink))" }}
          >
            AXON-AI
          </span>
          <span
            className="mt-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.18em]"
            style={{ color: onDark ? "rgba(255,255,255,0.65)" : "rgb(var(--color-muted))" }}
          >
            Social Media
          </span>
        </span>
      )}
    </span>
  );
}
