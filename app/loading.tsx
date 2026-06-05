/* Frontière de chargement globale (App Router).
   Affichée pendant la résolution des segments serveur.
   Spinner centré + libellé bilingue statique (FR par défaut côté SSR). */
export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 py-12">
      <span
        className="h-9 w-9 animate-spin rounded-full border-[3px] border-hair border-t-page"
        role="status"
        aria-label="Chargement"
      />
      <p className="text-sm text-muted">
        Chargement<span className="sr-only"> / Loading</span>…
      </p>
    </div>
  );
}
