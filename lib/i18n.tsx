"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "fr" | "en";

interface LangValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Traduction inline : t("texte FR", "english text"). */
  t: (fr: string, en: string) => string;
}

const LangContext = createContext<LangValue | null>(null);
const STORAGE_KEY = "axon_lang";

export function LangProvider({ children }: { children: React.ReactNode }) {
  // SSR + 1er rendu client = "fr" (évite tout mismatch d'hydratation).
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (stored === "en" || stored === "fr") setLangState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l;
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback((fr: string, en: string) => (lang === "en" ? en : fr), [lang]);

  const value = useMemo<LangValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}

/** Hook pratique : const t = useT(); t("Bonjour","Hello"). */
export function useT() {
  return useLang().t;
}

/** Sélecteur de langue compact FR / EN. */
export function LanguageSwitcher() {
  const { lang, setLang } = useLang();
  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-hair bg-card text-2xs font-semibold shadow-xs">
      {(["fr", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2.5 py-1 uppercase transition-colors ${
            lang === l ? "bg-page text-white" : "text-muted hover:bg-canvas hover:text-ink"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
