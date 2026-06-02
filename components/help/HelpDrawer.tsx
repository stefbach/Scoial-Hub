"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { getHelp } from "@/lib/help/registry";

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function HelpDrawer({ open, onClose }: HelpDrawerProps) {
  const pathname = usePathname();
  const entry = getHelp(pathname);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Fermeture par touche Échap
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Focus trap : dès l'ouverture, mettre le focus sur le bouton de fermeture
  useEffect(() => {
    if (open) {
      // Léger délai pour laisser l'animation démarrer avant le focus
      const id = setTimeout(() => closeBtnRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Verrouiller le scroll du body quand le tiroir est ouvert
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* ── Overlay ──────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={[
          "fixed inset-0 z-40 bg-ink/20 backdrop-blur-[2px]",
          "transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      {/* ── Panneau latéral ──────────────────────────────────────────────── */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Aide : ${entry.title}`}
        className={[
          // Position & dimensions
          "fixed right-0 top-0 z-50 h-full w-full max-w-[420px]",
          // Apparence
          "flex flex-col bg-card shadow-2xl",
          "border-l border-hair",
          // Animation de glissement
          "transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* ── En-tête du tiroir ──────────────────────────────────────────── */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-hair px-6 py-5">
          <div className="min-w-0">
            {/* Label de section */}
            <p className="section-label mb-1 text-primary-500">Aide contextuelle</p>
            <h2 className="text-base font-semibold leading-snug text-ink">
              {entry.title}
            </h2>
            <p className="mt-0.5 text-sm text-muted">{entry.tagline}</p>
          </div>

          {/* Bouton fermeture */}
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Fermer l'aide"
            className="
              btn-ghost shrink-0 rounded-full p-1.5
              text-muted hover:text-ink
              transition-colors duration-[120ms]
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-primary-500 focus-visible:ring-offset-1
            "
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* ── Corps scrollable ───────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-7">

            {/* Section : À quoi ça sert */}
            <section aria-labelledby="help-what">
              <h3
                id="help-what"
                className="section-label mb-2 text-ink"
              >
                À quoi ça sert
              </h3>
              <p className="text-sm leading-relaxed text-muted">
                {entry.whatItDoes}
              </p>
            </section>

            {/* Section : Actions clés */}
            <section aria-labelledby="help-actions">
              <h3
                id="help-actions"
                className="section-label mb-3 text-ink"
              >
                Actions clés
              </h3>
              <ul className="flex flex-col gap-3">
                {entry.keyActions.map((action, i) => (
                  <li
                    key={i}
                    className="
                      rounded-lg border border-hair bg-canvas
                      px-4 py-3
                      text-sm leading-relaxed
                    "
                  >
                    <span className="font-semibold text-ink">{action.label}</span>
                    <span className="text-muted"> — {action.detail}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Section : Astuces (optionnelle) */}
            {entry.tips && entry.tips.length > 0 && (
              <section aria-labelledby="help-tips">
                <h3
                  id="help-tips"
                  className="section-label mb-3 text-ink"
                >
                  Astuces
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {entry.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      {/* Icône ampoule */}
                      <span
                        aria-hidden="true"
                        className="
                          mt-0.5 shrink-0
                          flex h-5 w-5 items-center justify-center
                          rounded-full bg-warning-100 text-warning-600
                        "
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 12 12"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M6 1C4.067 1 2.5 2.567 2.5 4.5c0 1.19.582 2.243 1.477 2.895L4.25 9h3.5l.273-2.105A3.5 3.5 0 0 0 9.5 4.5C9.5 2.567 7.933 1 6 1Z"
                            fill="currentColor"
                            opacity="0.85"
                          />
                          <rect
                            x="4.25"
                            y="9.5"
                            width="3.5"
                            height="1"
                            rx="0.5"
                            fill="currentColor"
                          />
                          <rect
                            x="4.75"
                            y="11"
                            width="2.5"
                            height="0.75"
                            rx="0.375"
                            fill="currentColor"
                          />
                        </svg>
                      </span>
                      <p className="text-sm leading-relaxed text-muted">{tip}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Section : Rubriques liées (optionnelle) */}
            {entry.related && entry.related.length > 0 && (
              <section aria-labelledby="help-related">
                <h3
                  id="help-related"
                  className="section-label mb-3 text-ink"
                >
                  Rubriques liées
                </h3>
                <div className="flex flex-wrap gap-2">
                  {entry.related.map((rel) => (
                    <Link
                      key={rel.href}
                      href={rel.href}
                      onClick={onClose}
                      className="chip hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200 transition-colors duration-[120ms]"
                    >
                      {rel.label}
                    </Link>
                  ))}
                </div>
              </section>
            )}

          </div>
        </div>

        {/* ── Pied du tiroir ────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-hair px-6 py-4">
          <p className="text-center text-xs text-muted">
            Social Hub · Aide contextuelle
          </p>
        </div>
      </div>
    </>
  );
}
