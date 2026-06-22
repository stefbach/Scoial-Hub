"use client";

import { useEffect, useState } from "react";

/* Frontière d'erreur globale (App Router).
   Rendue dans le root layout en cas d'exception non capturée.
   Volontairement autonome (pas de dépendance au LangProvider, qui pourrait
   être la source de l'erreur) : la langue est lue directement du stockage. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Détection langue sans contexte (robuste même si le provider a planté).
  const [lang, setLang] = useState<"fr" | "en">("fr");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("axon_lang");
      if (stored === "en" || stored === "fr") setLang(stored);
    } catch {
      /* ignore */
    }
    // Journalise pour le diagnostic.
    console.error("[error-boundary]", error);
  }, [error]);

  const t = (fr: string, en: string) => (lang === "en" ? en : fr);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md p-8 text-center animate-fade-in">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 8v5M12 16h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-ink tracking-tight">
          {t("Une erreur est survenue", "Something went wrong")}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {t(
            "Un problème inattendu a interrompu cette page. Vous pouvez réessayer — vos données ne sont pas affectées.",
            "An unexpected problem interrupted this page. You can try again — your data is safe."
          )}
        </p>

        {error?.digest && (
          <p className="mt-3 text-2xs text-muted/70 font-mono">
            {t("Réf.", "Ref.")} {error.digest}
          </p>
        )}

        {/* Détail technique repliable — aide au diagnostic (message d'erreur client). */}
        {error?.message && (
          <details className="mt-3 text-left">
            <summary className="cursor-pointer text-2xs text-muted/70">{t("Détails techniques", "Technical details")}</summary>
            <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-canvas px-3 py-2 text-2xs text-muted ring-1 ring-hair">
              {error.message}
            </pre>
          </details>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            onClick={() => reset()}
            className="btn-primary px-4 py-2.5 text-sm font-medium rounded-lg"
          >
            {t("Réessayer", "Try again")}
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg border border-hair bg-card px-4 py-2.5 text-sm font-medium text-ink hover:bg-canvas transition-colors"
          >
            {t("Retour à l'accueil", "Back to home")}
          </a>
        </div>
      </div>
    </div>
  );
}
