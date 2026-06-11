"use client";

// ── Primitives UI partagées des Studios (Avatar / Créatif / Affiches) ────────
// Langage visuel « ultra-moderne » cohérent : héros immersif, cartes d'étape en
// verre avec pastille dégradée, contrôle segmenté, cadre d'aperçu à halo.
// Purement présentationnel — aucune logique métier ici.

import type { ReactNode } from "react";
import { NetworkCanvas } from "@/components/visual/NetworkCanvas";

/** Héros de studio : badge icône dégradé + titre serif + sous-titre + actions,
 *  sur fond de « réseau vivant » (constellation neuronale réactive au curseur). */
export function StudioHero({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <header className="studio-hero animate-fade-in px-5 py-6 sm:px-7 sm:py-7">
      {/* Réseau neuronal animé — signature AXON (l'axone, la connexion) */}
      <NetworkCanvas density={0.9} />
      <div className="relative flex flex-wrap items-start gap-4">
        <span className="studio-hero-badge animate-float animate-breathe shrink-0" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl leading-tight tracking-tight text-ink sm:text-[1.75rem]">
            {title}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Carte d'étape numérotée (verre + pastille dégradée + survol). */
export function StudioStep({
  n,
  title,
  hint,
  action,
  children,
  className = "",
}: {
  n: number | string;
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`studio-card p-5 ${className}`}>
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="studio-badge" aria-hidden="true">{n}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-tight text-ink">{title}</h2>
          {hint && <p className="mt-0.5 text-2xs leading-snug text-muted">{hint}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** Contrôle segmenté (toggle) moderne et générique. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={`studio-seg ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          data-active={value === o.id}
          onClick={() => onChange(o.id)}
          className="studio-seg-btn"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
