"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Toast } from "@/components/ui/Toast";
import { SubHeader, SectionLabel } from "./shared";
import { ORG_NAME } from "@/lib/mock-data";
import { useT } from "@/lib/i18n";

type NotifId = "spend_digest" | "weekly" | "library_low" | "failed_post" | "anomaly" | "team_new" | "audience_sync";
type Freq = "realtime" | "hourly" | "daily";

const NOTIF_DEFAULTS: { id: NotifId; email: boolean; inApp: boolean }[] = [
  { id: "spend_digest", email: true, inApp: false },
  { id: "weekly", email: true, inApp: false },
  { id: "library_low", email: true, inApp: true },
  { id: "failed_post", email: true, inApp: true },
  { id: "anomaly", email: true, inApp: true },
  { id: "team_new", email: false, inApp: true },
  { id: "audience_sync", email: false, inApp: false },
];

export function Notifications() {
  const t = useT();

  const NOTIF_LABELS: Record<NotifId, string> = {
    spend_digest: t("Récapitulatif quotidien des dépenses", "Daily spend digest"),
    weekly: t("Résumé hebdomadaire des performances", "Weekly performance summary"),
    library_low: t("Alertes bibliothèque faible", "Library low alerts"),
    failed_post: t("Alertes publication échouée", "Failed post alerts"),
    anomaly: t("Anomalies pub. / pauses automatiques", "Ad anomalies / auto-pauses"),
    team_new: t("Nouveau membre d'équipe ajouté", "New team member added"),
    audience_sync: t("Synchronisation d'audience terminée", "Audience sync completed"),
  };

  const [prefs, setPrefs] = useState(() =>
    Object.fromEntries(NOTIF_DEFAULTS.map((n) => [n.id, { email: n.email, inApp: n.inApp }]))
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
    setToast(t("Préférences de notifications enregistrées.", "Notification preferences saved."));
  };

  return (
    <div>
      <SubHeader title={t("Notifications", "Notifications")} scope="org" scopeLabel={ORG_NAME} />
      <p className="mb-4 text-sm text-muted">{t("Préférences de notifications email et in-app.", "Email and in-app notification preferences.")}</p>

      <SectionLabel>{t("Notifications email", "Email notifications")}</SectionLabel>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] text-sm">
          <thead>
            <tr className="section-label border-b-hair border-hair text-left">
              <th className="px-3 py-2 font-semibold">{t("ÉVÉNEMENT", "EVENT")}</th>
              <th className="px-3 py-2 font-semibold text-center">{t("EMAIL", "EMAIL")}</th>
              <th className="px-3 py-2 font-semibold text-center">{t("IN-APP", "IN-APP")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {NOTIF_DEFAULTS.map((n) => (
              <tr key={n.id}>
                <td className="px-3 py-2.5 text-ink">{NOTIF_LABELS[n.id]}</td>
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
      </div>

      <SectionLabel>{t("Fréquence des notifications", "Notification frequency")}</SectionLabel>
      <div className="space-y-2">
        {(
          [
            { id: "realtime", labelFr: "Temps réel", labelEn: "Real-time" },
            { id: "hourly", labelFr: "Récapitulatif horaire", labelEn: "Hourly digest" },
            { id: "daily", labelFr: "Récapitulatif quotidien", labelEn: "Daily digest" },
          ] as { id: Freq; labelFr: string; labelEn: string }[]
        ).map((f) => (
          <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded-md border-hair border-hair p-3 text-sm">
            <input
              type="radio"
              name="freq"
              value={f.id}
              checked={freq === f.id}
              onChange={() => { setFreq(f.id); setDirty(true); }}
            />
            <span className="text-ink">{t(f.labelFr, f.labelEn)}</span>
          </label>
        ))}
      </div>

      <SectionLabel>{t("Heures silencieuses", "Quiet hours")}</SectionLabel>
      <div className="rounded-md border-hair border-hair p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink">{t("Ne pas envoyer de notifications in-app pendant les heures silencieuses", "Don't send in-app notifications during quiet hours")}</div>
            <div className="text-2xs text-muted">{t("Utile si vous ne souhaitez pas être dérangé la nuit.", "Useful if you don't want late-night pings.")}</div>
          </div>
          <Toggle key={String(quietHours)} defaultOn={quietHours} onChange={(v) => { setQuietHours(v); setDirty(true); }} />
        </div>
        {quietHours && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-2xs text-muted">{t("De", "From")}</span>
            <input
              type="time"
              value={quietFrom}
              onChange={(e) => { setQuietFrom(e.target.value); setDirty(true); }}
              className="rounded-md border-hair border-hair bg-card px-2 py-1 text-ink focus:outline-none"
            />
            <span className="text-2xs text-muted">{t("à", "to")}</span>
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
        {dirty && <span className="text-2xs text-amber-700">● {t("Modifications non enregistrées", "Unsaved changes")}</span>}
        <Button variant="primary" disabled={!dirty} onClick={save}>{t("Enregistrer", "Save changes")}</Button>
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
