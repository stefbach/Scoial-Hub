"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { CompanySwitcher } from "./CompanySwitcher";
import { Sidebar } from "./Sidebar";
import { HelpButton } from "@/components/help/HelpButton";
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
          group relative flex h-8 w-8 items-center justify-center rounded-full
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
          group relative flex h-8 w-8 items-center justify-center rounded-full
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // La landing page (/) est plein écran, sans le shell applicatif.
  if (pathname === "/") return <>{children}</>;

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header sticky — blur + ombre au scroll via CSS */}
      <header className="app-header sticky top-0 z-30 flex items-center justify-between border-b border-hair bg-card/90 px-5 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Logo / wordmark */}
          <Link href="/" className="flex items-center gap-2.5" aria-label="Accueil Social Hub">
            {/* Icône Social Hub */}
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-page text-white shadow-md">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="3.8" r="2" fill="currentColor" opacity="0.95"/>
                <circle cx="2.8" cy="10.2" r="1.65" fill="currentColor" opacity="0.75"/>
                <circle cx="11.2" cy="10.2" r="1.65" fill="currentColor" opacity="0.75"/>
                <line x1="7" y1="5.7" x2="3.3" y2="8.7" stroke="currentColor" strokeWidth="0.85" opacity="0.45"/>
                <line x1="7" y1="5.7" x2="10.7" y2="8.7" stroke="currentColor" strokeWidth="0.85" opacity="0.45"/>
              </svg>
            </span>
            <span className="text-[0.9375rem] font-bold tracking-tight text-ink">
              Social Hub
            </span>
          </Link>

          {/* Séparateur vertical */}
          <span className="h-4 w-px bg-hair" aria-hidden="true" />

          <CompanySwitcher />
        </div>

        {/* Zone droite : aide + avatar */}
        <div className="flex items-center gap-2">
          <HelpButton />
          <UserMenu />
        </div>
      </header>

      {/* Corps : sidebar + contenu */}
      <div className="mx-auto flex max-w-[1200px]">
        <Sidebar />
        <main className="min-w-0 flex-1 px-7 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
