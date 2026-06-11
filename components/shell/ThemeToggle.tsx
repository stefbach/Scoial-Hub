"use client";

// ── Bascule de thème jour / nuit ─────────────────────────────────────────────
// Le thème est appliqué via <html data-theme="light"> (sombre par défaut) et
// persisté dans localStorage. Un script inline dans le layout l'applique avant
// la première peinture (aucun flash). Ce composant ne fait que basculer.

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

const STORAGE_KEY = "axon_theme";

export function ThemeToggle() {
  const t = useT();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Synchronise l'état local avec le thème déjà appliqué par le script inline.
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  };

  const isLight = theme === "light";
  return (
    <button
      type="button"
      onClick={toggle}
      title={isLight ? t("Passer en mode sombre", "Switch to dark mode") : t("Passer en mode clair", "Switch to light mode")}
      aria-label={isLight ? t("Passer en mode sombre", "Switch to dark mode") : t("Passer en mode clair", "Switch to light mode")}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink"
    >
      {isLight ? (
        /* Lune — repasser en sombre */
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.8 6.8 0 0 0 9.8 9.8Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        /* Soleil — passer en clair */
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
