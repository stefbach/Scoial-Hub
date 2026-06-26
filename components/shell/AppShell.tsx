"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ReadOnlyBanner } from "./ReadOnlyBanner";
import { Sidebar } from "./Sidebar";
import { HelpButton } from "@/components/help/HelpButton";
import { HelpTrigger } from "@/components/help/HelpTrigger";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { LanguageSwitcher, useT } from "@/lib/i18n";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "@/components/brand/Logo";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

function UserMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  // Ferme le menu au clic en dehors
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const inMenu = menuRef.current?.contains(target);
      const inPanel = panelRef.current?.contains(target);
      if (!inMenu && !inPanel) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Mode démo ou non connecté : avatar statique
  if (!isSupabaseConfigured || !email) {
    return (
      <button
        aria-label="Profil utilisateur"
        className="
          group relative flex h-9 w-9 items-center justify-center rounded-full
          bg-page text-2xs font-bold text-white
          shadow-sm ring-2 ring-transparent
          transition-all duration-[150ms]
          hover:ring-page/25 hover:shadow-md
          focus-visible:ring-primary-500 focus-visible:ring-offset-2
        "
      >
        YO
        <span
          aria-hidden="true"
          className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-white bg-success-500 shadow-xs"
        />
      </button>
    );
  }

  // Initiale de l'email pour l'avatar
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div ref={menuRef} className="relative z-[70]">
      <button
        aria-label={t("Menu utilisateur", "User menu")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="
          group relative flex h-9 w-9 items-center justify-center rounded-full
          bg-page text-2xs font-bold text-white
          shadow-sm ring-2 ring-transparent
          transition-all duration-[150ms]
          hover:ring-page/25 hover:shadow-md
          focus-visible:ring-primary-500 focus-visible:ring-offset-2
        "
      >
        {initials}
        <span
          aria-hidden="true"
          className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-white bg-success-500 shadow-xs"
        />
      </button>

      {/* Rendu via portal au-dessus de tout (le header a un backdrop-blur qui
          crée un contexte d'empilement → un z-index local ne suffit pas). */}
      {open && mounted && createPortal(
        <div
          ref={panelRef}
          className="fixed right-3 top-14 z-[2000] w-60 overflow-hidden rounded-xl border border-hair bg-card shadow-lg animate-fade-in sm:right-5"
        >
          <div className="border-b border-hair px-4 py-3">
            <p className="text-2xs text-muted section-label mb-0.5">{t("Connecté en tant que", "Signed in as")}</p>
            <p className="text-sm font-medium text-ink truncate">{email}</p>
          </div>
          <nav className="py-1 text-sm">
            <a href="/settings?section=profile" className="flex items-center gap-2 px-4 py-2 text-ink hover:bg-canvas">👤 {t("Mon compte", "My account")}</a>
            <a href="/settings" className="flex items-center gap-2 px-4 py-2 text-ink hover:bg-canvas">⚙️ {t("Paramètres", "Settings")}</a>
            <a href="/comptes" className="flex items-center gap-2 px-4 py-2 text-ink hover:bg-canvas">🏢 {t("Mes sociétés", "My companies")}</a>
            <a href="/mon-equipe" className="flex items-center gap-2 px-4 py-2 text-ink hover:bg-canvas">👥 {t("Mon équipe & membres", "My team & members")}</a>
            <a href="/parametres-connecteurs" className="flex items-center gap-2 px-4 py-2 text-ink hover:bg-canvas">🔌 {t("Connecteurs & accès", "Connectors & access")}</a>
          </nav>
          <div className="border-t border-hair p-1">
            <a href="/api/auth/logout" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-danger-600 hover:bg-danger-50">
              ⎋ {t("Se déconnecter", "Sign out")}
            </a>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Sélecteur des éléments focusables (focus-trap du tiroir mobile).
const DRAWER_FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Ferme le tiroir mobile à chaque changement de page.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Tiroir mobile : fermeture par Échap + piège à focus tant qu'il est ouvert.
  useEffect(() => {
    if (!navOpen) return;

    const drawer = drawerRef.current;
    // Focus initial dans le tiroir.
    if (drawer) {
      const first = drawer.querySelector<HTMLElement>(DRAWER_FOCUSABLE);
      (first ?? drawer).focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setNavOpen(false);
        return;
      }
      if (e.key !== "Tab") return;

      const el = drawerRef.current;
      if (!el) return;
      const focusables = Array.from(el.querySelectorAll<HTMLElement>(DRAWER_FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement
      );
      if (focusables.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !el.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !el.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navOpen]);

  // Pages SANS le shell applicatif : landing, auth, hub de comptes, console admin.
  const bare =
    pathname === "/" ||
    pathname === "/comptes" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/legal") ||
    pathname.startsWith("/admin");
  if (bare) return <>{children}</>;

  return (
    <div className="app-shell">
      {/* Décor spatial « Mission Control » — derrière tout le contenu */}
      <div className="app-mesh" aria-hidden="true" />
      <div className="app-grain" aria-hidden="true" />

      {/* Header sticky — blur + ombre au scroll via CSS */}
      <header className="app-header sticky top-0 z-[60] flex items-center justify-between border-b border-hair bg-canvas/70 px-3 py-2.5 backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/* Hamburger (mobile only) */}
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Ouvrir le menu"
            className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-canvas lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>

          {/* Logo / wordmark */}
          <Link href="/" aria-label="Accueil AXON-AI Social Media" className="shrink-0">
            <Logo size={28} />
          </Link>
        </div>

        {/* Zone droite : aide + thème + langue + avatar */}
        <div className="flex shrink-0 items-center gap-2">
          <HelpTrigger />
          <ThemeToggle />
          <LanguageSwitcher />
          <UserMenu />
        </div>
      </header>

      {/* Corps : sidebar + contenu */}
      <div className="flex">
        {/* Sidebar fixe sur desktop — repliable en rail d'icônes */}
        <div className="hidden lg:block">
          <Sidebar collapsible />
        </div>

        {/* Tiroir mobile (overlay) */}
        {navOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setNavOpen(false)} />
            <div
              ref={drawerRef}
              tabIndex={-1}
              className="absolute left-0 top-0 h-full w-[min(15rem,82vw)] overflow-y-auto bg-card shadow-xl outline-none animate-slide-up"
            >
              <Sidebar onNavigate={() => setNavOpen(false)} />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-7">
          <DemoBanner />
          <ReadOnlyBanner />
          {children}
        </main>
      </div>

      {/* Bouton d'aide : pastille violette fixe, en haut à droite sous l'avatar */}
      <HelpButton />
    </div>
  );
}
