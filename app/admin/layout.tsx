"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { useT } from "@/lib/i18n";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();

  // La page de login n'a pas le shell admin.
  if (pathname === "/admin/login") return <>{children}</>;

  const NAV = [
    { href: "/admin", label: t("Vue d'ensemble", "Overview"), exact: true },
    { href: "/admin/validation", label: t("Validation des comptes", "Account validation") },
    { href: "/admin/comptes", label: t("Comptes & entités", "Accounts & entities") },
    { href: "/admin/comptes/nouveau", label: t("Créer un compte", "Create account") },
    { href: "/admin/utilisateurs", label: t("Utilisateurs", "Users") },
  ];

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
          <Logo size={26} />
          <span className="rounded-md bg-page/10 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-page">Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={logout} className="btn-ghost text-sm">{t("Se déconnecter", "Sign out")}</button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1200px]">
        <nav aria-label={t("Navigation admin", "Admin navigation")} className="w-[14rem] shrink-0 border-r border-hair py-5 pl-3 pr-2">
          <div className="mb-1.5 px-3 section-label">{t("Administration", "Administration")}</div>
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
                      active ? "bg-page/20 font-semibold text-ink" : "text-muted hover:bg-white/[0.06] hover:text-ink",
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
