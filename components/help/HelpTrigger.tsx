"use client";

import { useT } from "@/lib/i18n";

/**
 * Bouton « ? » du header : ouvre l'aide contextuelle (panneau latéral) en
 * émettant l'événement window "axon:help", écouté par <HelpButton/>.
 */
export function HelpTrigger() {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("axon:help"))}
      aria-label={t("Ouvrir l'aide de cette page", "Open help for this page")}
      title={t("Aide / Tutoriel de la page (?)", "Page help / tutorial (?)")}
      className="flex h-9 items-center gap-1.5 rounded-full bg-page px-3 text-white shadow-sm ring-2 ring-white/15 transition-all hover:brightness-110 hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
    >
      <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M6.8 6.8A2.2 2.2 0 0 1 9 4.7c1.2 0 2.2.9 2.2 2.1 0 1.1-.8 1.6-1.4 2-.5.3-.8.6-.8 1.3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="9" cy="13" r="1" fill="currentColor" />
      </svg>
      <span className="hidden text-xs font-semibold sm:inline">{t("Aide", "Help")}</span>
    </button>
  );
}
