import Link from "next/link";

/* Frontière 404 globale (App Router).
   Server component statique — libellés bilingues présentés ensemble. */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md p-8 text-center animate-fade-in">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-page/10 text-page">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>

        <p className="text-3xl font-bold text-ink tracking-tight">404</p>
        <h1 className="mt-1 text-lg font-semibold text-ink">
          Page introuvable
          <span className="block text-sm font-normal text-muted">Page not found</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          La page que vous cherchez n'existe pas ou a été déplacée.
          <span className="block">The page you are looking for doesn't exist or has moved.</span>
        </p>

        <div className="mt-6">
          <Link
            href="/dashboard"
            className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 3 5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Retour à l'accueil · Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
