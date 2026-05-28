"use client";

import { useState } from "react";
import { useCompany } from "@/lib/company-context";
import { COMPANIES, ORG_NAME, TEAM } from "@/lib/mock-data";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Meter } from "@/components/ui/Meter";
import { eur } from "@/lib/format";

const NAV: { group: string; items: { id: string; label: string }[] }[] = [
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

export default function SettingsPage() {
  const [section, setSection] = useState("companies");

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
                  onClick={() => setSection(it.id)}
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
          {section === "companies" && <Companies />}
          {section === "ad-safety" && <AdSafety />}
          {section === "organization" && <Organization />}
          {section === "team" && <Team />}
          {section === "profile" && <Profile />}
          {section === "notifications" && <Placeholder title="Notifications" desc="Email and in-app notification preferences." />}
          {section === "ai" && <AiPrefs />}
          {section === "audit" && <AuditLog />}
        </div>
      </div>
    </div>
  );
}

function Companies() {
  return (
    <div>
      <h2 className="text-base font-semibold text-ink">Companies</h2>
      <p className="mb-4 text-sm text-muted">
        Each company has its own social accounts, library, and campaigns.
      </p>
      <div className="space-y-2">
        {COMPANIES.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-md border-hair border-hair bg-canvas px-3 py-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-2xs font-bold text-white"
              style={{ backgroundColor: c.accent }}
            >
              {c.code}
            </span>
            <div>
              <div className="text-sm font-medium text-ink">{c.name}</div>
              <div className="text-2xs text-muted">Brand voice: {c.brandVoice}</div>
            </div>
          </div>
        ))}
      </div>
      <Button variant="secondary" className="mt-3">Add company</Button>
    </div>
  );
}

function AdSafety() {
  const { company, data } = useCompany();
  const s = data.adSafety;
  const usedPct = Math.round((s.usedThisMonth / s.monthlyCap) * 100);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-base font-semibold text-ink">Ad Safety</h2>
        <span className="text-hair">|</span>
        <span className="text-sm text-muted">Company: <span className="font-semibold text-ink">{company.code}</span></span>
      </div>
      <div className="mb-4 rounded-md border-hair border-ai-text/20 bg-ai-textbg px-3 py-2 text-2xs text-ai-text">
        These settings protect against unintended ad spend. We recommend keeping the defaults. Limits apply across all of {company.code}&apos;s campaigns.
      </div>

      <div className="section-label mb-2">Spend caps</div>
      <div className="mb-3 rounded-md border-hair border-hair p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-ink">Monthly spend cap</div>
            <div className="text-2xs text-muted">Hard ceiling across all {company.code} campaigns. New campaigns blocked once reached; active ones pause.</div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">EUR</span>
            <input
              defaultValue={s.monthlyCap}
              className="w-20 rounded-md border-hair border-hair px-2 py-1 text-right text-ink"
            />
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-2xs text-muted">
            <span>Used this month</span>
            <span>{eur(s.usedThisMonth)} / {s.monthlyCap.toLocaleString()} ({usedPct}%)</span>
          </div>
          <Meter value={s.usedThisMonth} max={s.monthlyCap} />
        </div>
      </div>
      <Row
        title="Require budget cap on every campaign"
        desc="No campaign can be created without a budget cap."
        control={<Toggle defaultOn={s.requireBudgetCap} />}
      />

      <div className="section-label mb-2 mt-4">Approval gates</div>
      <Row
        title="Confirm spend before AI actions"
        desc="AI-suggested actions involving money require explicit confirmation. AI never auto-spends."
        control={<Toggle defaultOn={s.confirmAiSpend} />}
      />
      <Row
        title="Double confirmation above threshold"
        desc="Budget changes above this daily amount require a second confirmation."
        control={
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">EUR</span>
            <input
              defaultValue={s.doubleConfirmThreshold}
              className="w-16 rounded-md border-hair border-hair px-2 py-1 text-right text-ink"
            />
            <span className="text-2xs text-muted">/ day</span>
          </div>
        }
      />

      <div className="section-label mb-2 mt-4">Alerts &amp; audit</div>
      <Row
        title="Daily spend digest + anomaly auto-pause"
        desc="Morning email of yesterday's spend. Auto-pause if a campaign exceeds its 7-day average by 50%."
        control={<Toggle defaultOn={s.dailyDigest} />}
      />
      <div className="rounded-md border-hair border-hair p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-ink">Audit log (always on)</div>
            <div className="text-2xs text-muted">Every ad change logged with who/when/what. Cannot be disabled.</div>
          </div>
          <Button variant="secondary" className="py-1 text-2xs">View log</Button>
        </div>
        <div className="mt-2 rounded bg-canvas px-2 py-1.5 text-2xs text-muted">
          Recent: {s.recentAudit}
        </div>
      </div>
    </div>
  );
}

function Row({ title, desc, control }: { title: string; desc: string; control: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between rounded-md border-hair border-hair p-3">
      <div className="pr-4">
        <div className="text-sm font-medium text-ink">{title}</div>
        <div className="text-2xs text-muted">{desc}</div>
      </div>
      {control}
    </div>
  );
}

function Organization() {
  return (
    <div>
      <h2 className="mb-4 text-base font-semibold text-ink">Organization</h2>
      <label className="text-2xs font-medium text-muted">Organization name</label>
      <input defaultValue={ORG_NAME} className="mt-1 mb-3 block w-72 rounded-md border-hair border-hair px-3 py-2 text-sm text-ink" />
      <div className="text-2xs text-muted">3 companies · 3 team members</div>
    </div>
  );
}

function Team() {
  return (
    <div>
      <h2 className="mb-4 text-base font-semibold text-ink">Team &amp; roles</h2>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-hair">
            {TEAM.map((m) => (
              <tr key={m.email}>
                <td className="px-3 py-2.5 font-medium text-ink">{m.name}</td>
                <td className="px-3 py-2.5 text-muted">{m.email}</td>
                <td className="px-3 py-2.5 text-right">
                  <StatusBadge tone={m.role === "admin" ? "blue" : "gray"}>{m.role}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Profile() {
  return (
    <div>
      <h2 className="mb-4 text-base font-semibold text-ink">Profile</h2>
      <label className="text-2xs font-medium text-muted">Full name</label>
      <input defaultValue="Younes O." className="mt-1 mb-3 block w-72 rounded-md border-hair border-hair px-3 py-2 text-sm text-ink" />
      <label className="text-2xs font-medium text-muted">Email</label>
      <input defaultValue="younes@ddsgroup.mu" className="mt-1 block w-72 rounded-md border-hair border-hair px-3 py-2 text-sm text-ink" />
    </div>
  );
}

function AiPrefs() {
  return (
    <div>
      <h2 className="mb-1 text-base font-semibold text-ink">AI preferences</h2>
      <p className="mb-4 text-sm text-muted">Default models and monthly spend caps for AI generation.</p>
      <Row title="AI text (Anthropic)" desc="Used for captions, ad copy, rewrites." control={<span className="text-2xs text-muted">EUR 10/mo cap</span>} />
      <Row title="AI images (Fal.ai)" desc="Flux 2 Pro / Ideogram v3 / GPT Image Mini." control={<span className="text-2xs text-muted">EUR 25/mo cap</span>} />
      <Row title="AI video (Fal.ai)" desc="Kling 3.0 / Veo 3.1 Fast." control={<span className="text-2xs text-muted">EUR 40/mo cap</span>} />
    </div>
  );
}

function AuditLog() {
  const { data } = useCompany();
  return (
    <div>
      <h2 className="mb-4 text-base font-semibold text-ink">Audit log</h2>
      <div className="rounded bg-canvas px-3 py-2 text-2xs text-muted">{data.adSafety.recentAudit}</div>
    </div>
  );
}

function Placeholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h2 className="mb-1 text-base font-semibold text-ink">{title}</h2>
      <p className="text-sm text-muted">{desc}</p>
    </div>
  );
}
