"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";

/* ── Barre de navigation basse (mobile/tablette) ─────────────────────────
   La navigation complète (30 entrées / 6 groupes) reste dans le tiroir
   hamburger — indispensable pour tout retrouver — mais elle coûte 2 taps
   pour la moindre tâche quotidienne. Cette barre expose en 1 tap les 4
   tâches qu'un utilisateur fait tous les jours (piloter, composer,
   messagerie, médiathèque) + un accès direct au tiroir complet ("Plus").
   Cachée à partir de `lg` : la sidebar desktop prend le relais. */

const TABS: { href: string; label: [string, string]; icon: React.ReactNode }[] = [
  {
    href: "/pilotage",
    label: ["Pilotage", "Command"],
    icon: (
      <svg width="20" height="20" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <circle cx="7.5" cy="7.5" r="1.6" fill="currentColor" />
        <path d="M7.5 2v2M7.5 11v2M2 7.5h2M11 7.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/compose",
    label: ["Composer", "Compose"],
    icon: (
      <svg width="20" height="20" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <path d="M10.5 4.5l2 2-3.5 3.5H7V8.5l3.5-4Z" fill="currentColor" opacity="0.9" />
      </svg>
    ),
  },
  {
    href: "/inbox",
    label: ["Messagerie", "Inbox"],
    icon: (
      <svg width="20" height="20" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <path
          d="M2 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13 4v5a1.5 1.5 0 0 1-1.5 1.5H6l-2.5 2v-2H3.5A1.5 1.5 0 0 1 2 9V4Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    href: "/media",
    label: ["Médiathèque", "Media"],
    icon: (
      <svg width="20" height="20" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <rect x="2" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <circle cx="5.3" cy="5.8" r="1.1" stroke="currentColor" strokeWidth="1.1" fill="none" />
        <path d="M2.5 11l3.2-3 2.3 2 2-1.8 2.5 2.3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
];

export function MobileTabBar({ onMore, moreActive }: { onMore: () => void; moreActive: boolean }) {
  const pathname = usePathname();
  const t = useT();
  const isActive = (href: string) => pathname.startsWith(href);

  const itemClass = (active: boolean) =>
    [
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-2xs font-medium transition-colors",
      active ? "text-page" : "text-muted",
    ].join(" ");

  return (
    <nav
      aria-label={t("Navigation rapide", "Quick navigation")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-hair bg-canvas/85 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-lg items-stretch px-1 py-1.5">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
              <span className={active ? "opacity-100" : "opacity-70"}>{tab.icon}</span>
              <span className="truncate">{t(tab.label[0], tab.label[1])}</span>
            </Link>
          );
        })}
        <button type="button" onClick={onMore} aria-expanded={moreActive} className={itemClass(moreActive)}>
          <svg width="20" height="20" viewBox="0 0 15 15" fill="none" aria-hidden="true" className={moreActive ? "opacity-100" : "opacity-70"}>
            <circle cx="3.2" cy="7.5" r="1.15" fill="currentColor" />
            <circle cx="7.5" cy="7.5" r="1.15" fill="currentColor" />
            <circle cx="11.8" cy="7.5" r="1.15" fill="currentColor" />
          </svg>
          <span className="truncate">{t("Plus", "More")}</span>
        </button>
      </div>
    </nav>
  );
}
