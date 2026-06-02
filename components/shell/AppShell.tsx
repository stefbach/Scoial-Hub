"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompanySwitcher } from "./CompanySwitcher";
import { Sidebar } from "./Sidebar";

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

        {/* Avatar utilisateur */}
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
          {/* Indicateur de statut actif */}
          <span
            aria-hidden="true"
            className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-white bg-success-500 shadow-xs"
          />
        </button>
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
