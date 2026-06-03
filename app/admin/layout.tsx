"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Vue d'ensemble", exact: true },
  { href: "/admin/comptes", label: "Comptes & entités" },
  { href: "/admin/comptes/nouveau", label: "Créer un compte" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // La page de login n'a pas le shell admin.
  if (pathname === "/admin/login") return <>{children}</>;

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-hair bg-card/90 px-5 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-page text-white shadow-md">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1.5l5 2.5v3c0 3-2.2 4.8-5 5.5C4.2 11.8 2 10 2 7V4L7 1.5Z" stroke="currentColor" strokeWidth="1.1" fill="none" />
            </svg>
          </span>
          <span className="text-[0.9375rem] font-bold tracking-tight text-ink">Social Hub</span>
          <span className="rounded-md bg-page/10 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-page">Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="btn-secondary">Ouvrir l'app</Link>
          <button onClick={logout} className="btn-ghost text-sm">Se déconnecter</button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1200px]">
        <nav aria-label="Navigation admin" className="w-[14rem] shrink-0 border-r border-hair py-5 pl-3 pr-2">
          <div className="mb-1.5 px-3 section-label">Administration</div>
          <ul className="space-y-px" role="list">
            {NAV.map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "block rounded-lg px-3 py-[0.45rem] text-sm transition-all duration-[120ms]",
                      active ? "bg-[#efe7d9] font-semibold text-ink" : "text-muted hover:bg-[#f1eadd] hover:text-ink",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main className="min-w-0 flex-1 px-7 py-6">{children}</main>
      </div>
    </div>
  );
}
