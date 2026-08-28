"use client";

// Infobulle partagée du banc de montage — remplace les attributs `title`
// natifs sur les éléments interactifs les plus manipulés (aperçu, timeline,
// poignées). L'audit de l'itération 3 relevait des zones quasi muettes
// (Timeline : 1 infobulle, Preview : 1) et un `title` natif dont le délai
// d'apparition est long et le style hors de notre contrôle (chapitre 6).
//
// Purement CSS (`group-hover`/`group-focus-within`) : pas de mesure de
// position, donc aucun risque de repositionnement erratique — le prix est un
// alignement toujours centré sur l'élément, ce qui suffit pour des boutons et
// poignées de petite taille.

export function Tooltip({
  label,
  children,
  side = "top",
  block = false,
}: {
  /** Formulation orientée usage : ce que l'action fait, raccourci inclus. */
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  /** `true` pour un enfant en pleine largeur (ex. bouton `w-full`). */
  block?: boolean;
}) {
  const pos =
    side === "top"
      ? "bottom-full left-1/2 mb-1.5 -translate-x-1/2"
      : side === "bottom"
      ? "top-full left-1/2 mt-1.5 -translate-x-1/2"
      : side === "left"
      ? "right-full top-1/2 mr-1.5 -translate-y-1/2"
      : "left-full top-1/2 ml-1.5 -translate-y-1/2";

  return (
    <span className={`group/tip relative ${block ? "block" : "inline-flex"}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute ${pos} z-50 max-w-[16rem] whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium leading-tight text-canvas opacity-0 shadow-lg transition-opacity delay-300 duration-100 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 motion-reduce:delay-0 motion-reduce:transition-none`}
      >
        {label}
      </span>
    </span>
  );
}
