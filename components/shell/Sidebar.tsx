"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* ── Icônes SVG inline ─────────────────────────────────────────────── */
const ICONS: Record<string, React.ReactNode> = {
  "/": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 1.5L1.5 7H3v6h3.5v-4h2v4H12V7h1.5L7.5 1.5Z" fill="currentColor"/>
    </svg>
  ),
  "/compose": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M10.5 4.5l2 2-3.5 3.5H7V8.5l3.5-4Z" fill="currentColor" opacity="0.9"/>
    </svg>
  ),
  "/scheduled": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M7.5 4v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  "/library": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="2"   y="3" width="3"   height="9" rx="0.75" fill="currentColor" opacity="0.6"/>
      <rect x="6.5" y="3" width="3"   height="9" rx="0.75" fill="currentColor" opacity="0.9"/>
      <rect x="11"  y="3" width="2"   height="9" rx="0.75" fill="currentColor" opacity="0.5"/>
    </svg>
  ),
  "/automations": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M4 7.5A3.5 3.5 0 0 1 7.5 4"   stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M11 7.5A3.5 3.5 0 0 1 7.5 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/>
      <path d="M5.5 2.5l-1.5 2h3L5.5 2.5Z"  fill="currentColor" opacity="0.75"/>
      <path d="M9.5 12.5l1.5-2H7.8l1.7 2Z"  fill="currentColor" opacity="0.75"/>
    </svg>
  ),
  "/history": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2 7.5A5.5 5.5 0 1 0 7.5 2" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      <path d="M2 2v5.5H7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  "/campaigns": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2 10.5L5 5l3 4 2.5-5 2.5 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  "/audiences": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="5.5" cy="5" r="2"   stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <circle cx="10"  cy="5" r="1.5" stroke="currentColor" strokeWidth="1.1" fill="none" opacity="0.7"/>
      <path d="M1 12.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      <path d="M11.5 9.5c1.5.3 2.5 1.5 2.5 3"         stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.7"/>
    </svg>
  ),
  "/ad-performance": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="2"    y="9" width="2.5" height="4"  rx="0.5" fill="currentColor" opacity="0.55"/>
      <rect x="6.25" y="6" width="2.5" height="7"  rx="0.5" fill="currentColor" opacity="0.8"/>
      <rect x="10.5" y="3" width="2.5" height="10" rx="0.5" fill="currentColor"/>
    </svg>
  ),
  "/analytics": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M7.5 7.5L7.5 3.5"  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M7.5 7.5L11 9.5"   stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.65"/>
    </svg>
  ),
  "/accounts": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <circle cx="7.5" cy="6.5" r="1.8" stroke="currentColor" strokeWidth="1.1" fill="none"/>
      <path d="M3.5 12c0-2 1.8-3.2 4-3.2s4 1.2 4 3.2" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
    </svg>
  ),
  "/settings": (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M7.5 1.5v1M7.5 12.5v1M1.5 7.5h1M12.5 7.5h1M3.1 3.1l.7.7M11.2 11.2l.7.7M11.2 3.1l-.7.7M3.8 10.5l-.7.7"
            stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
};

/* ── Groupes de navigation ─────────────────────────────────────────── */
const GROUPS: { label?: string; items: { href: string; label: string }[] }[] = [
  { items: [{ href: "/", label: "Dashboard" }] },
  {
    label: "Organic",
    items: [
      { href: "/compose",     label: "Compose" },
      { href: "/scheduled",   label: "Scheduled" },
      { href: "/library",     label: "Library" },
      { href: "/automations", label: "Automations" },
      { href: "/history",     label: "History" },
    ],
  },
  {
    label: "Paid Ads",
    items: [
      { href: "/campaigns",      label: "Campaigns" },
      { href: "/audiences",      label: "Audiences" },
      { href: "/ad-performance", label: "Ad Performance" },
    ],
  },
  {
    label: "General",
    items: [
      { href: "/analytics", label: "Analytics" },
      { href: "/accounts",  label: "Accounts" },
      { href: "/settings",  label: "Settings" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Navigation principale"
      className="w-[13.5rem] shrink-0 border-r border-hair py-5 pl-3 pr-2"
    >
      {GROUPS.map((group, i) => (
        <div key={i} className={i > 0 ? "mt-5" : ""}>
          {group.label && (
            <div className="mb-1.5 px-3 section-label">
              {group.label}
            </div>
          )}
          <ul className="space-y-px" role="list">
            {group.items.map((item) => {
              const active = isActive(item.href);
              const icon   = ICONS[item.href];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "group relative flex items-center gap-2.5 rounded-lg px-3 py-[0.4rem] text-sm",
                      "transition-all duration-[120ms]",
                      active
                        ? "bg-page text-white shadow-sm"
                        : "text-ink/70 hover:bg-white hover:text-ink hover:shadow-xs",
                    ].join(" ")}
                  >
                    {/* Barre latérale active */}
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-white/40"
                      />
                    )}

                    {/* Icône */}
                    <span
                      className={[
                        "shrink-0 transition-opacity duration-[120ms]",
                        active
                          ? "opacity-100"
                          : "opacity-45 group-hover:opacity-65",
                      ].join(" ")}
                    >
                      {icon}
                    </span>

                    {/* Label */}
                    <span className={active ? "font-semibold" : "font-medium"}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
