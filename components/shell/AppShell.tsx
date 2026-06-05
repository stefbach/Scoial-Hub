"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { CompanySwitcher } from "./CompanySwitcher";
import { Sidebar } from "./Sidebar";
import { ScopeBar } from "./ScopeBar";
import { HelpButton } from "@/components/help/HelpButton";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { LanguageSwitcher } from "@/lib/i18n";
import { Logo } from "@/components/brand/Logo";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

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
    <div ref={menuRef} className="relative">
      <button
        aria-label="Menu utilisateur"
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

      {open && (
        <div className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-hair bg-card shadow-lg animate-fade-in">
          <div className="px-4 py-3 border-b border-hair">
            <p className="text-2xs text-muted section-label mb-0.5">Connecté en tant que</p>
            <p className="text-sm font-medium text-ink truncate">{email}</p>
          </div>
          <div className="p-1.5">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-canvas transition-colors text-left"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <path d="M6 2H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3M10 10l3-3-3-3M13 7H5.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Se déconnecter
            </button>
          </div>
        </div>
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

  // La barre CONTEXTE (pays + période) ne sert que sur les pages d'ANALYSE :
  // ailleurs (onboarding, réglages, composition, inbox…) elle n'a aucun effet
  // et prête à confusion. On l'affiche donc uniquement sur une liste blanche.
  const SCOPE_ROUTES = [
    "/veille",
    "/publicites",
    "/analytics",
    "/pilotage",
    "/ad-performance",
    "/dashboard",
    "/pages-meta",
  ];
  const showScope = SCOPE_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header sticky — blur + ombre au scroll via CSS */}
      <header className="app-header sticky top-0 z-30 flex items-center justify-between border-b border-hair bg-card/90 px-3 py-2.5 backdrop-blur-md sm:px-5">
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

          {/* Séparateur vertical */}
          <span className="hidden h-4 w-px bg-hair sm:block" aria-hidden="true" />

          <CompanySwitcher />
        </div>

        {/* Zone droite : aide + langue + avatar */}
        <div className="flex shrink-0 items-center gap-2">
          <HelpButton />
          <LanguageSwitcher />
          <UserMenu />
        </div>
      </header>

      {/* Barre de contexte : pays + période — uniquement sur les pages d'analyse */}
      {showScope && <ScopeBar />}

      {/* Corps : sidebar + contenu */}
      <div className="flex">
        {/* Sidebar fixe sur desktop */}
        <div className="hidden lg:block">
          <Sidebar />
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
          {children}
        </main>
      </div>
    </div>
  );
}
