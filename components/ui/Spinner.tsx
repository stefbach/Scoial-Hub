"use client";

// Indicateurs de chargement réutilisables — pour donner un FEEDBACK VISUEL clair
// sur toute action longue (analyses IA, génération d'images : 10–60 s).

export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Chargement"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current/25 border-t-current ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Bandeau de progression à afficher pendant une opération longue : spinner +
 * libellé + durée estimée (« peut prendre ~20 s »), pour éviter le double-clic
 * et l'impression que « ça a planté ».
 */
export function BusyHint({ label, eta, className = "" }: { label: string; eta?: string; className?: string }) {
  return (
    <div
      role="status"
      className={`flex items-center gap-2.5 rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink ${className}`}
    >
      <Spinner size={16} className="text-primary-600" />
      <span>{label}</span>
      {eta && <span className="text-2xs text-muted">· {eta}</span>}
    </div>
  );
}
