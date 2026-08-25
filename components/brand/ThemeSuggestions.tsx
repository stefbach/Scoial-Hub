"use client";

// Thèmes suggérés à partir de l'identité de marque ENREGISTRÉE.
//
// La Veille et les Séries de posts demandaient toutes deux un « thème » dans un
// champ vide, alors que la marque en a déjà défini lors du parcours assisté
// (thèmes éditoriaux, angles concurrentiels, mots-clés). L'utilisateur devait
// les retrouver de mémoire — ou renonçait (recette R27 #4 et #12).
//
// La liste ne REMPLACE pas la saisie libre : elle la précède. On propose, on
// n'impose pas.

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

/** Profil de marque tel que renvoyé par /api/onboarding/state. */
interface BrandProfile {
  themes?: string[];
  competitorAngles?: string[];
  keywords?: string[];
}

/** Dédoublonne en préservant l'ordre et en ignorant la casse. */
function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const clean = v.trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

/**
 * Thèmes de la marque, par ordre de pertinence éditoriale : les thèmes définis
 * d'abord, puis les angles concurrentiels, puis les mots-clés — ces derniers
 * sont les plus bruts, ils ne viennent qu'en complément.
 */
export function brandThemes(profile: BrandProfile | null | undefined, max = 8): string[] {
  if (!profile) return [];
  return dedupe([
    ...(profile.themes ?? []),
    ...(profile.competitorAngles ?? []),
    ...(profile.keywords ?? []),
  ]).slice(0, max);
}

/** Charge le profil de marque d'une société (aucun appel sans société). */
export function useBrandThemes(companyId: string | undefined, max = 8): string[] {
  const [themes, setThemes] = useState<string[]>([]);
  useEffect(() => {
    if (!companyId) { setThemes([]); return; }
    let alive = true;
    fetch(`/api/onboarding/state?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setThemes(brandThemes(d?.profile as BrandProfile, max)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [companyId, max]);
  return themes;
}

/**
 * Rangée de thèmes cliquables. Ne s'affiche pas s'il n'y a rien à proposer :
 * une liste vide serait un espace occupé pour rien.
 */
export function ThemeSuggestions({
  themes,
  value,
  onPick,
  label,
}: {
  themes: string[];
  /** Thème courant, pour marquer celui qui est retenu. */
  value: string;
  onPick: (theme: string) => void;
  label?: string;
}) {
  const t = useT();
  if (themes.length === 0) return null;
  const current = value.trim().toLowerCase();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-2xs text-muted">
        {label ?? t("Thèmes de votre marque :", "Your brand themes:")}
      </span>
      {themes.map((theme) => {
        const active = theme.toLowerCase() === current;
        return (
          <button
            key={theme}
            type="button"
            onClick={() => onPick(theme)}
            aria-pressed={active}
            className={`rounded-full px-2.5 py-1 text-2xs font-medium transition-colors ${
              active
                ? "bg-page text-white"
                : "bg-card text-muted ring-1 ring-hair hover:text-ink hover:ring-page/40"
            }`}
          >
            {theme}
          </button>
        );
      })}
    </div>
  );
}
