"use client";

// Bandeau « mode démo » cohérent, à l'échelle de l'app. Interroge /api/health
// (présence des clés, aucun secret exposé) et signale, une fois, les capacités
// non configurées (IA, images, Meta, LinkedIn) afin que l'utilisateur sache que
// certains résultats peuvent être simulés. Dismissible (mémorisé par session).

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

interface Health {
  present?: Record<string, boolean>;
}

const DISMISS_KEY = "axon_demo_banner_dismissed";

export function DemoBanner() {
  const t = useT();
  const [missing, setMissing] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(true); // caché tant qu'on n'a pas vérifié

  useEffect(() => {
    let cancelled = false;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return; // déjà fermé
    } catch { /* ignore */ }

    fetch("/api/health")
      .then((r) => (r.ok ? (r.json() as Promise<Health>) : null))
      .then((h) => {
        if (cancelled || !h?.present) return;
        const p = h.present;
        const m: string[] = [];
        if (!p.ANTHROPIC_API_KEY) m.push(t("IA texte", "text AI"));
        if (!p.REPLICATE_API_TOKEN) m.push(t("génération d'images", "image generation"));
        if (!p.META_APP_ID) m.push("Meta");
        if (!p.LINKEDIN_CLIENT_ID) m.push("LinkedIn");
        if (m.length > 0) {
          setMissing(m);
          setDismissed(false);
        }
      })
      .catch(() => { /* silencieux */ });

    return () => { cancelled = true; };
  }, [t]);

  if (dismissed || missing.length === 0) return null;

  function close() {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  }

  return (
    <div
      role="status"
      className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-2.5 text-sm text-warning-700"
    >
      <span className="min-w-0">
        <span className="font-semibold">{t("Mode démo", "Demo mode")}</span>{" — "}
        {t(
          `non configuré : ${missing.join(", ")}. Les résultats correspondants peuvent être simulés.`,
          `not configured: ${missing.join(", ")}. The matching results may be simulated.`
        )}
      </span>
      <button
        type="button"
        onClick={close}
        aria-label={t("Fermer", "Dismiss")}
        className="shrink-0 text-warning-700/70 hover:text-warning-700"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
