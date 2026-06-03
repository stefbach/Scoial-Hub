"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useLang } from "@/lib/i18n";
import { getHelp } from "@/lib/help/registry";

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
}

// ── Micro-icônes inline ────────────────────────────────────────────────────────

function IconBulb() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M6 1C4.067 1 2.5 2.567 2.5 4.5c0 1.19.582 2.243 1.477 2.895L4.25 9h3.5l.273-2.105A3.5 3.5 0 0 0 9.5 4.5C9.5 2.567 7.933 1 6 1Z"
        fill="currentColor"
        opacity="0.85"
      />
      <rect x="4.25" y="9.5" width="3.5" height="1" rx="0.5" fill="currentColor" />
      <rect x="4.75" y="11" width="2.5" height="0.75" rx="0.375" fill="currentColor" />
    </svg>
  );
}

function IconQuestion() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path
        d="M4.5 4.5C4.5 3.672 5.172 3 6 3s1.5.672 1.5 1.5c0 .828-.5 1.2-1 1.5S6 6.5 6 7"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="6" cy="9" r="0.6" fill="currentColor" />
    </svg>
  );
}

function IconAction() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2 6h8M7 3l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLink() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M5 3H3a2 2 0 0 0 0 4h2M7 9h2a2 2 0 0 0 0-4H7M4 6h4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconShortcut() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="1" y="2" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.1" fill="none" />
      <path d="M4 7.5 6 5l2 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────

export function HelpDrawer({ open, onClose }: HelpDrawerProps) {
  const pathname = usePathname();
  const { lang } = useLang();
  const entry = getHelp(pathname, lang);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Labels d'interface selon la langue
  const ui = {
    contextualHelp: lang === "en" ? "Contextual help" : "Aide contextuelle",
    whatFor: lang === "en" ? "What it's for" : "À quoi ça sert",
    actions: lang === "en" ? "Key actions" : "Actions clés",
    tips: lang === "en" ? "Tips" : "Astuces",
    faq: lang === "en" ? "FAQ" : "FAQ",
    shortcuts: lang === "en" ? "Shortcuts & navigation" : "Raccourcis & navigation",
    related: lang === "en" ? "Related sections" : "Rubriques liées",
    close: lang === "en" ? "Close help" : "Fermer l'aide",
    footer: lang === "en" ? "AXON-AI · Contextual help" : "AXON-AI · Aide contextuelle",
    aria: lang === "en" ? `Help: ${entry.title}` : `Aide : ${entry.title}`,
  };

  // Fermeture par touche Échap
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Focus trap : focus sur le bouton de fermeture à l'ouverture
  useEffect(() => {
    if (open) {
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
        aria-label={ui.aria}
        className={[
          "fixed right-0 top-0 z-50 h-full w-full max-w-[440px]",
          "flex flex-col bg-card shadow-2xl",
          "border-l border-hair",
          "transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* ── En-tête ────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-hair px-6 py-5">
          <div className="min-w-0">
            <p className="section-label mb-1 text-primary-500">{ui.contextualHelp}</p>
            <h2 className="text-base font-semibold leading-snug text-ink">
              {entry.title}
            </h2>
            <p className="mt-0.5 text-sm text-muted">{entry.tagline}</p>
          </div>

          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label={ui.close}
            className="
              btn-ghost shrink-0 rounded-full p-1.5
              text-muted hover:text-ink
              transition-colors duration-[120ms]
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-primary-500 focus-visible:ring-offset-1
            "
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
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

            {/* ── À quoi ça sert ─────────────────────────────────────────── */}
            <section aria-labelledby="help-what">
              <h3 id="help-what" className="section-label mb-2 text-ink">
                {ui.whatFor}
              </h3>
              <p className="text-sm leading-relaxed text-muted">
                {entry.whatFor}
              </p>
            </section>

            {/* ── Actions clés ───────────────────────────────────────────── */}
            {entry.actions.length > 0 && (
              <section aria-labelledby="help-actions">
                <h3 id="help-actions" className="section-label mb-3 text-ink">
                  {ui.actions}
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {entry.actions.map((action, i) => (
                    <li
                      key={i}
                      className="
                        rounded-lg border border-hair bg-canvas
                        px-4 py-3 text-sm leading-relaxed
                      "
                    >
                      <div className="mb-1 flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary-100 text-primary-600"
                        >
                          <IconAction />
                        </span>
                        <span className="font-semibold text-ink">{action.label}</span>
                      </div>
                      <p className="text-muted">{action.detail}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Astuces ────────────────────────────────────────────────── */}
            {entry.tips.length > 0 && (
              <section aria-labelledby="help-tips">
                <h3 id="help-tips" className="section-label mb-3 text-ink">
                  {ui.tips}
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {entry.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span
                        aria-hidden="true"
                        className="
                          mt-0.5 shrink-0
                          flex h-5 w-5 items-center justify-center
                          rounded-full bg-warning-100 text-warning-600
                        "
                      >
                        <IconBulb />
                      </span>
                      <p className="text-sm leading-relaxed text-muted">{tip}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── FAQ ────────────────────────────────────────────────────── */}
            {entry.faq.length > 0 && (
              <section aria-labelledby="help-faq">
                <h3 id="help-faq" className="section-label mb-3 text-ink">
                  {ui.faq}
                </h3>
                <div className="flex flex-col gap-3">
                  {entry.faq.map((item, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-hair bg-canvas px-4 py-3 text-sm"
                    >
                      <div className="mb-1.5 flex items-start gap-2">
                        <span
                          aria-hidden="true"
                          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600"
                        >
                          <IconQuestion />
                        </span>
                        <p className="font-semibold leading-snug text-ink">{item.q}</p>
                      </div>
                      <p className="leading-relaxed text-muted pl-6">{item.a}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Raccourcis & navigation ────────────────────────────────── */}
            {entry.shortcuts && entry.shortcuts.length > 0 && (
              <section aria-labelledby="help-shortcuts">
                <h3 id="help-shortcuts" className="section-label mb-3 text-ink">
                  {ui.shortcuts}
                </h3>
                <ul className="flex flex-col gap-2">
                  {entry.shortcuts.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span
                        aria-hidden="true"
                        className="
                          mt-0.5 shrink-0
                          flex h-5 w-5 items-center justify-center
                          rounded-full bg-canvas ring-1 ring-hair text-muted
                        "
                      >
                        <IconShortcut />
                      </span>
                      <p className="text-sm leading-relaxed text-muted">{s}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Rubriques liées ───────────────────────────────────────── */}
            {entry.related.length > 0 && (
              <section aria-labelledby="help-related">
                <h3 id="help-related" className="section-label mb-3 text-ink">
                  {ui.related}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {entry.related.map((rel) => (
                    <Link
                      key={rel.href}
                      href={rel.href}
                      onClick={onClose}
                      className="
                        chip
                        inline-flex items-center gap-1.5
                        hover:bg-primary-50 hover:text-primary-700
                        hover:border-primary-200
                        transition-colors duration-[120ms]
                      "
                    >
                      <IconLink />
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
          <p className="text-center text-xs text-muted">{ui.footer}</p>
        </div>
      </div>
    </>
  );
}
