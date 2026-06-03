"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Profile } from "@/components/settings/Profile";
import { Notifications } from "@/components/settings/Notifications";
import { Organization } from "@/components/settings/Organization";
import { Companies } from "@/components/settings/Companies";
import { Team } from "@/components/settings/Team";
import { AiPrefs } from "@/components/settings/AiPrefs";
import { AdSafety } from "@/components/settings/AdSafety";
import { AuditLog } from "@/components/settings/AuditLog";
import { useT } from "@/lib/i18n";

type SectionId =
  | "profile"
  | "notifications"
  | "organization"
  | "companies"
  | "team"
  | "ai"
  | "ad-safety"
  | "audit";

type NavGroup = { groupFr: string; groupEn: string; items: { id: SectionId; labelFr: string; labelEn: string }[] };

const NAV: NavGroup[] = [
  {
    groupFr: "Compte",
    groupEn: "Account",
    items: [
      { id: "profile", labelFr: "Profil", labelEn: "Profile" },
      { id: "notifications", labelFr: "Notifications", labelEn: "Notifications" },
    ],
  },
  {
    groupFr: "Organisation",
    groupEn: "Organization",
    items: [
      { id: "organization", labelFr: "Organisation", labelEn: "Organization" },
      { id: "companies", labelFr: "Entreprises", labelEn: "Companies" },
      { id: "team", labelFr: "Équipe & rôles", labelEn: "Team & roles" },
    ],
  },
  {
    groupFr: "Plateforme",
    groupEn: "Platform",
    items: [
      { id: "ai", labelFr: "Préférences IA", labelEn: "AI preferences" },
      { id: "ad-safety", labelFr: "Sécurité publicitaire", labelEn: "Ad Safety" },
      { id: "audit", labelFr: "Journal d'audit", labelEn: "Audit log" },
    ],
  },
];

const ALL_IDS = new Set<SectionId>(NAV.flatMap((g) => g.items.map((i) => i.id)));

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}

interface AuditInitial {
  filter?: string;
  user?: string;
  company?: string;
  range?: string;
}

function SettingsContent() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();

  const sectionParam = params.get("section");
  const initialSection: SectionId = sectionParam && ALL_IDS.has(sectionParam as SectionId)
    ? (sectionParam as SectionId)
    : "profile";
  const [section, setSection] = useState<SectionId>(initialSection);

  // Audit deep-link filters (action/user/company/range). Seeded from the URL
  // on first load and updated when navigating in from another sub-page.
  const [auditInitial, setAuditInitial] = useState<AuditInitial>(() => ({
    filter: params.get("filter") ?? undefined,
    user: params.get("user") ?? undefined,
    company: params.get("company") ?? undefined,
    range: params.get("range") ?? undefined,
  }));

  // Keep the URL in sync from explicit state (never from a possibly-stale
  // useSearchParams snapshot, which previously clobbered the audit filter).
  useEffect(() => {
    const qs = new URLSearchParams();
    if (section !== "profile") qs.set("section", section);
    if (section === "audit") {
      if (auditInitial.filter) qs.set("filter", auditInitial.filter);
      if (auditInitial.user) qs.set("user", auditInitial.user);
      if (auditInitial.company) qs.set("company", auditInitial.company);
      if (auditInitial.range) qs.set("range", auditInitial.range);
    }
    const s = qs.toString();
    router.replace(s ? `/settings?${s}` : "/settings");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, auditInitial]);

  const navigate = (s: string, extra?: Record<string, string>) => {
    setSection(s as SectionId);
    if (s === "audit") {
      setAuditInitial({
        filter: extra?.filter,
        user: extra?.user,
        company: extra?.company,
        range: extra?.range,
      });
    }
  };

  // Re-mount AuditLog whenever the incoming filter set changes so its
  // dropdowns pre-select the requested values.
  const auditKey = `audit-${auditInitial.filter ?? ""}-${auditInitial.user ?? ""}-${auditInitial.company ?? ""}-${auditInitial.range ?? ""}`;

  return (
    <div className="animate-fade-in">
      {/* Page heading */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-lg font-bold tracking-tight text-ink">{t("Paramètres", "Settings")}</h1>
      </div>

      <div className="card flex min-h-[480px] overflow-hidden">
        {/* Sidebar nav */}
        <nav className="w-52 shrink-0 border-r border-hair bg-canvas/40 p-3">
          {NAV.map((g) => (
            <div key={g.groupEn} className="mb-5">
              <div className="section-label px-2 pb-1.5">{t(g.groupFr, g.groupEn)}</div>
              <div className="space-y-0.5">
                {g.items.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => navigate(it.id)}
                    className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                      section === it.id
                        ? "bg-card font-semibold text-ink shadow-xs ring-1 ring-hair"
                        : "text-muted hover:bg-card/60 hover:text-ink"
                    }`}
                  >
                    {t(it.labelFr, it.labelEn)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Content area */}
        <div className="flex-1 overflow-auto p-5">
          {section === "profile" && <Profile />}
          {section === "notifications" && <Notifications />}
          {section === "organization" && <Organization onNavigate={navigate} />}
          {section === "companies" && <Companies />}
          {section === "team" && <Team />}
          {section === "ai" && <AiPrefs />}
          {section === "ad-safety" && <AdSafety onNavigate={navigate} />}
          {section === "audit" && (
            <AuditLog
              key={auditKey}
              initialFilter={auditInitial.filter}
              initialUser={auditInitial.user}
              initialCompany={auditInitial.company}
              initialRange={auditInitial.range}
            />
          )}
        </div>
      </div>
    </div>
  );
}
