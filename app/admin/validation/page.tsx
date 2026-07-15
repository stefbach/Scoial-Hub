"use client";

// ── Admin générale / pilotage — Validation des comptes ───────────────────────
// L'opérateur de la plateforme valide (ou suspend) les organisations « comptes
// clients ». Une org « pending » est en attente d'activation ; « approved » est
// active ; « suspended » est bloquée (accès refusé côté app).

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

interface OrgRow {
  id: string;
  name: string;
  status: "pending" | "approved" | "suspended";
  plan: string;
  members: number;
  companies: number;
  createdAt: string | null;
  adminEmail: string | null;
}

export default function AdminValidationPage() {
  const t = useT();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orgs");
      const d = await res.json();
      setOrgs(d.orgs ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(orgId: string, action: "approve" | "suspend" | "reactivate") {
    setBusy(orgId);
    try {
      await fetch("/api/admin/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, action }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  const badge = (s: OrgRow["status"]) => {
    const map = {
      approved: "text-success-600 border-success-500/40 bg-success-50",
      pending: "text-warning-700 border-warning-500/40 bg-warning-50",
      suspended: "text-danger-600 border-danger-500/40 bg-danger-50",
    } as const;
    const label = { approved: t("Validé", "Approved"), pending: t("En attente", "Pending"), suspended: t("Suspendu", "Suspended") };
    return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-semibold ${map[s]}`}>{label[s]}</span>;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t("Validation des comptes", "Account validation")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {t(
            "Activez ou suspendez les comptes clients (organisations). Un compte suspendu perd l'accès à l'application.",
            "Activate or suspend client accounts (organizations). A suspended account loses access to the app."
          )}
        </p>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-sm text-muted">{t("Chargement…", "Loading…")}</div>
      ) : orgs.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">{t("Aucune organisation.", "No organizations.")}</div>
      ) : (
        <div className="card divide-y divide-hair">
          {orgs.map((o) => (
            <div key={o.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-ink">{o.name}</p>
                  {badge(o.status)}
                  <span className="chip">{o.plan}</span>
                </div>
                <p className="mt-0.5 text-2xs text-muted">
                  {o.adminEmail ? <><span className="text-ink/70">{o.adminEmail}</span> · </> : null}
                  {o.members} {t("membre(s)", "member(s)")} · {o.companies} {t("société(s)", "company(ies)")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {o.status !== "approved" && (
                  <button onClick={() => act(o.id, o.status === "suspended" ? "reactivate" : "approve")} disabled={busy === o.id} className="btn-primary text-2xs">
                    {o.status === "suspended" ? t("Réactiver", "Reactivate") : t("Valider", "Approve")}
                  </button>
                )}
                {o.status !== "suspended" && (
                  <button onClick={() => act(o.id, "suspend")} disabled={busy === o.id} className="btn-ghost text-2xs text-danger-600">
                    {t("Suspendre", "Suspend")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
