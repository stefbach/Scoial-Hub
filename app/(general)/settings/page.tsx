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

type SectionId =
  | "profile"
  | "notifications"
  | "organization"
  | "companies"
  | "team"
  | "ai"
  | "ad-safety"
  | "audit";

const NAV: { group: string; items: { id: SectionId; label: string }[] }[] = [
  {
    group: "Account",
    items: [
      { id: "profile", label: "Profile" },
      { id: "notifications", label: "Notifications" },
    ],
  },
  {
    group: "Organization",
    items: [
      { id: "organization", label: "Organization" },
      { id: "companies", label: "Companies" },
      { id: "team", label: "Team & roles" },
    ],
  },
  {
    group: "Platform",
    items: [
      { id: "ai", label: "AI preferences" },
      { id: "ad-safety", label: "Ad Safety" },
      { id: "audit", label: "Audit log" },
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

function SettingsContent() {
  const router = useRouter();
  const params = useSearchParams();

  const sectionParam = params.get("section");
  const initialSection: SectionId = sectionParam && ALL_IDS.has(sectionParam as SectionId)
    ? (sectionParam as SectionId)
    : "profile";
  const [section, setSection] = useState<SectionId>(initialSection);

  const filterParam = params.get("filter") ?? undefined;

  // Keep URL in sync.
  useEffect(() => {
    const qs = new URLSearchParams(params.toString());
    if (section === "profile") qs.delete("section");
    else qs.set("section", section);
    if (section !== "audit") qs.delete("filter");
    const s = qs.toString();
    router.replace(s ? `/settings?${s}` : "/settings");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const navigate = (s: string, extra?: Record<string, string>) => {
    setSection(s as SectionId);
    if (extra) {
      const qs = new URLSearchParams();
      qs.set("section", s);
      for (const [k, v] of Object.entries(extra)) qs.set(k, v);
      router.replace(`/settings?${qs.toString()}`);
    }
  };

  return (
    <div>
      <div className="mb-5 text-lg font-semibold text-ink">Settings</div>
      <div className="card flex min-h-[460px] overflow-hidden">
        <div className="w-48 shrink-0 border-r-hair border-hair p-3">
          {NAV.map((g) => (
            <div key={g.group} className="mb-4">
              <div className="section-label px-2 pb-1">{g.group}</div>
              {g.items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => navigate(it.id)}
                  className={`block w-full rounded-md px-2 py-1.5 text-left text-sm ${
                    section === it.id ? "bg-canvas font-medium text-ink ring-1 ring-hair" : "text-ink/80 hover:bg-canvas"
                  }`}
                >
                  {it.label}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="flex-1 p-5">
          {section === "profile" && <Profile />}
          {section === "notifications" && <Notifications />}
          {section === "organization" && <Organization onNavigate={navigate} />}
          {section === "companies" && <Companies />}
          {section === "team" && <Team />}
          {section === "ai" && <AiPrefs />}
          {section === "ad-safety" && <AdSafety onNavigate={navigate} />}
          {section === "audit" && <AuditLog initialFilter={filterParam} />}
        </div>
      </div>
    </div>
  );
}
