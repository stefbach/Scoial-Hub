"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Toast } from "@/components/ui/Toast";
import { SubHeader, SectionLabel } from "./shared";
import { ORG_NAME } from "@/lib/mock-data";

const NOTIF_TYPES: { id: string; label: string; email: boolean; inApp: boolean }[] = [
  { id: "spend_digest", label: "Daily spend digest", email: true, inApp: false },
  { id: "weekly", label: "Weekly performance summary", email: true, inApp: false },
  { id: "library_low", label: "Library low alerts", email: true, inApp: true },
  { id: "failed_post", label: "Failed post alerts", email: true, inApp: true },
  { id: "anomaly", label: "Ad anomalies / auto-pauses", email: true, inApp: true },
  { id: "team_new", label: "New team member added", email: false, inApp: true },
  { id: "audience_sync", label: "Audience sync completed", email: false, inApp: false },
];

type Freq = "realtime" | "hourly" | "daily";

export function Notifications() {
  const [prefs, setPrefs] = useState(() =>
    Object.fromEntries(NOTIF_TYPES.map((n) => [n.id, { email: n.email, inApp: n.inApp }]))
  );
  const [freq, setFreq] = useState<Freq>("realtime");
  const [quietHours, setQuietHours] = useState(false);
  const [quietFrom, setQuietFrom] = useState("22:00");
  const [quietTo, setQuietTo] = useState("08:00");
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const togglePref = (id: string, key: "email" | "inApp") => {
    setPrefs((p) => ({ ...p, [id]: { ...p[id], [key]: !p[id][key] } }));
    setDirty(true);
  };

  const save = () => {
    setDirty(false);
    setToast("Notification preferences saved.");
  };

  return (
    <div>
      <SubHeader title="Notifications" scope="org" scopeLabel={ORG_NAME} />
      <p className="mb-4 text-sm text-muted">Email and in-app notification preferences.</p>

      <SectionLabel>Email notifications</SectionLabel>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="section-label border-b-hair border-hair text-left">
              <th className="px-3 py-2 font-semibold">EVENT</th>
              <th className="px-3 py-2 font-semibold text-center">EMAIL</th>
              <th className="px-3 py-2 font-semibold text-center">IN-APP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {NOTIF_TYPES.map((n) => (
              <tr key={n.id}>
                <td className="px-3 py-2.5 text-ink">{n.label}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className="inline-block">
                    <Toggle key={`${n.id}-e-${prefs[n.id].email}`} defaultOn={prefs[n.id].email} onChange={() => togglePref(n.id, "email")} />
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className="inline-block">
                    <Toggle key={`${n.id}-i-${prefs[n.id].inApp}`} defaultOn={prefs[n.id].inApp} onChange={() => togglePref(n.id, "inApp")} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionLabel>Notification frequency</SectionLabel>
      <div className="space-y-2">
        {(
          [
            { id: "realtime", label: "Real-time" },
            { id: "hourly", label: "Hourly digest" },
            { id: "daily", label: "Daily digest" },
          ] as { id: Freq; label: string }[]
        ).map((f) => (
          <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded-md border-hair border-hair p-3 text-sm">
            <input
              type="radio"
              name="freq"
              value={f.id}
              checked={freq === f.id}
              onChange={() => { setFreq(f.id); setDirty(true); }}
            />
            <span className="text-ink">{f.label}</span>
          </label>
        ))}
      </div>

      <SectionLabel>Quiet hours</SectionLabel>
      <div className="rounded-md border-hair border-hair p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-ink">Don&apos;t send in-app notifications during quiet hours</div>
            <div className="text-2xs text-muted">Useful if you don&apos;t want late-night pings.</div>
          </div>
          <Toggle key={String(quietHours)} defaultOn={quietHours} onChange={(v) => { setQuietHours(v); setDirty(true); }} />
        </div>
        {quietHours && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-2xs text-muted">From</span>
            <input
              type="time"
              value={quietFrom}
              onChange={(e) => { setQuietFrom(e.target.value); setDirty(true); }}
              className="rounded-md border-hair border-hair bg-card px-2 py-1 text-ink focus:outline-none"
            />
            <span className="text-2xs text-muted">to</span>
            <input
              type="time"
              value={quietTo}
              onChange={(e) => { setQuietTo(e.target.value); setDirty(true); }}
              className="rounded-md border-hair border-hair bg-card px-2 py-1 text-ink focus:outline-none"
            />
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        {dirty && <span className="text-2xs text-amber-700">● Unsaved changes</span>}
        <Button variant="primary" disabled={!dirty} onClick={save}>Save changes</Button>
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
