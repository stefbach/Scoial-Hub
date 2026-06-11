// ── Icônes maison — trait fin, style cohérent (24×24, stroke 1.8, currentColor)
// Remplacent les emojis (rendu inégal selon les OS, ton enfantin) sur toutes
// les surfaces premium : héros de studios, constellation, états vides.

interface IconProps { size?: number; className?: string }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
});

/** Masque de théâtre — Studio Avatar */
export function IconMask({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 4.5c2.6 1 5.3 1.5 8 1.5s5.4-.5 8-1.5v7c0 5.2-3.4 9-8 10.5C7.4 20.5 4 16.7 4 11.5v-7Z" />
      <path d="M8.5 10.5c.5-.6 1.5-.6 2 0M13.5 10.5c.5-.6 1.5-.6 2 0" />
      <path d="M9 15c.8 1 2 1.6 3 1.6s2.2-.6 3-1.6" />
    </svg>
  );
}

/** Pellicule — Studio Créatif */
export function IconFilm({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M8 4v16M16 4v16M3 9h5M3 15h5M16 9h5M16 15h5" />
    </svg>
  );
}

/** Cadre image — Studio Affiches */
export function IconFrame({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <circle cx="9" cy="9" r="1.8" />
      <path d="M4.5 17.5 10 12l4 4 2.5-2.5 3 3" />
    </svg>
  );
}

/** Mégaphone — création de pub / Media Buyer */
export function IconMegaphone({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 10.5v3a1.5 1.5 0 0 0 1.5 1.5H6l1 5h2.5l-1-5H10l9 3.5v-15L10 7H4.5A1.5 1.5 0 0 0 3 8.5v2Z" />
      <path d="M21.5 10v4" />
    </svg>
  );
}

/** Courbe de croissance — Campagnes */
export function IconTrend({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 19.5h18" />
      <path d="M4.5 15 9.5 10l3.5 3.5L20 6.5" />
      <path d="M15.5 6.5H20V11" />
    </svg>
  );
}

/** Barres d'analyse — Performance / Analyste */
export function IconBars({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5 20V12M11 20V5.5M17 20v-9.5" strokeWidth="2.4" />
      <path d="M3 20h18" />
    </svg>
  );
}

/** Loupe d'observation — Publicités concurrentes / veille */
export function IconScout({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
      <path d="M8 10.5a2.5 2.5 0 0 1 2.5-2.5" />
    </svg>
  );
}

/** Clap de cinéma — état vide vidéo */
export function IconClapper({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="9" width="18" height="11" rx="2" />
      <path d="m3.5 9 1.8-4.6a2 2 0 0 1 2.6-1.1l12.3 4.4" />
      <path d="m8 8 2-4.5M13 8.8l2-4.5" />
    </svg>
  );
}
