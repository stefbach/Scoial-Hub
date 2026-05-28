"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS: { label?: string; items: { href: string; label: string }[] }[] = [
  { items: [{ href: "/", label: "Dashboard" }] },
  {
    label: "Organic",
    items: [
      { href: "/compose", label: "Compose" },
      { href: "/scheduled", label: "Scheduled" },
      { href: "/library", label: "Library" },
      { href: "/automations", label: "Automations" },
      { href: "/history", label: "History" },
    ],
  },
  {
    label: "Paid Ads",
    items: [
      { href: "/campaigns", label: "Campaigns" },
      { href: "/audiences", label: "Audiences" },
      { href: "/ad-performance", label: "Ad Performance" },
    ],
  },
  {
    label: "General",
    items: [
      { href: "/analytics", label: "Analytics" },
      { href: "/accounts", label: "Accounts" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="w-52 shrink-0 border-r-hair border-hair px-3 py-4">
      {GROUPS.map((group, i) => (
        <div key={i} className={i > 0 ? "mt-5" : ""}>
          {group.label && (
            <div className="px-3 pb-1 section-label">{group.label}</div>
          )}
          {group.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-1.5 text-sm ${
                  active
                    ? "bg-card font-medium text-ink shadow-sm ring-hair ring-1 ring-hair"
                    : "text-ink/80 hover:bg-card/60"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
