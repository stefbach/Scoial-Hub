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

// ── Icônes « premium » de la landing (géométrie Lucide, trait 2, formes
//    natives pour un rendu net) ────────────────────────────────────────────
const base2 = (size: number) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none" as const,
  stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const, "aria-hidden": true as const,
});

/** Mallette — dirigeant·e de PME */
export function IconBriefcase({ size = 24, className }: IconProps) {
  return (
    <svg {...base2(size)} className={className}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

/** Cible — responsable marketing solo */
export function IconTarget({ size = 24, className }: IconProps) {
  return (
    <svg {...base2(size)} className={className}>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="1.6" />
    </svg>
  );
}

/** Bâtiments — agence ou freelance */
export function IconBuildings({ size = 24, className }: IconProps) {
  return (
    <svg {...base2(size)} className={className}>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4M10 10h4M10 14h4M10 18h4" strokeWidth="1.7" />
    </svg>
  );
}

/** Maillon — connexion */
export function IconLink({ size = 24, className }: IconProps) {
  return (
    <svg {...base2(size)} className={className}>
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

/** Bulle de message — décrivez */
export function IconChat({ size = 24, className }: IconProps) {
  return (
    <svg {...base2(size)} className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" strokeWidth="2.4" />
    </svg>
  );
}

/** Courbe ascendante — vous validez, on suit */
export function IconTrendingUp({ size = 24, className }: IconProps) {
  return (
    <svg {...base2(size)} className={className}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

/** Cadenas — vos données */
export function IconLock({ size = 24, className }: IconProps) {
  return (
    <svg {...base2(size)} className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/** Bouclier validé — rien ne se publie sans vous */
export function IconShieldCheck({ size = 24, className }: IconProps) {
  return (
    <svg {...base2(size)} className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/** Micro — dans votre voix */
export function IconMic({ size = 24, className }: IconProps) {
  return (
    <svg {...base2(size)} className={className}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

/** Médaille — sans engagement (qualité, liberté) */
export function IconAward({ size = 24, className }: IconProps) {
  return (
    <svg {...base2(size)} className={className}>
      <circle cx="12" cy="9" r="6" />
      <path d="m15.5 13.5 1.5 8-5-3-5 3 1.5-8" />
    </svg>
  );
}
