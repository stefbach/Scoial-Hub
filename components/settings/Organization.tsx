"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { ImageUpload, type UploadedImage } from "@/components/ui/ImageUpload";
import { SubHeader, SectionLabel } from "./shared";
import { useCompany } from "@/lib/company-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { useT } from "@/lib/i18n";

const INDUSTRIES = ["Healthcare", "Marketing", "Retail", "Education", "Other"];

export function Organization({ onNavigate }: { onNavigate: (section: string) => void }) {
  const t = useT();
  // UAT #14 — sociétés RÉELLES de l'utilisateur (jamais les marques de démo).
  const { companies } = useCompany();
  // Nom d'organisation : vide tant qu'on n'a pas la vraie valeur de session,
  // puis hydraté depuis sh_organizations (jamais un nom d'org fictif).
  const [name, setName] = useState("");
  const [teamCount, setTeamCount] = useState<number | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [industry, setIndustry] = useState("Healthcare");
  const [logo, setLogo] = useState<UploadedImage | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // Hydrate le nom réel de l'organisation depuis la session Supabase.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: membership } = await supabase
        .from("sh_memberships")
        .select("org_id")
        .eq("user_id", auth.user.id)
        .limit(1)
        .maybeSingle();
      const orgId = membership?.org_id as string | undefined;
      if (!orgId) return;
      const { data: org } = await supabase
        .from("sh_organizations")
        .select("name")
        .eq("id", orgId)
        .maybeSingle();
      if (!cancelled && typeof org?.name === "string") setName(org.name);
    })();
    return () => { cancelled = true; };
  }, []);

  // Nombre de membres réel (route admin) — silencieux si non autorisé/non configuré.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/team")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d || !Array.isArray(d.members)) return;
        setTeamCount(d.members.length + (Array.isArray(d.invitations) ? d.invitations.length : 0));
      })
      .catch(() => { /* garde null : on n'affiche pas de compte fictif */ });
    return () => { cancelled = true; };
  }, []);

  const orgInitials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div>
      <SubHeader title={t("Organisation", "Organization")} scope="org" scopeLabel={name} />

      {/* Logo */}
      <div className="mb-5">
        <ImageUpload value={logo} onChange={setLogo} variant="logo" fallback={orgInitials} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="text-2xs font-medium text-muted">{t("Nom de l'organisation", "Organization name")}</label>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <input
              value={pendingName ?? name}
              onChange={(e) => setPendingName(e.target.value)}
              placeholder={t("Nom de votre organisation", "Your organization name")}
              className="block min-w-0 flex-1 rounded-md border border-hair bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
            />
            <Button
              variant="secondary"
              className="shrink-0"
              disabled={!pendingName || pendingName === name}
              onClick={() => {
                if (!pendingName) return;
                if (confirm(t("Renommer mettra à jour le nom de l'organisation partout (journaux d'audit, exports, factures). Continuer ?", "Renaming will update the organization name everywhere (audit logs, exports, invoices). Continue?"))) {
                  setName(pendingName);
                  setPendingName(null);
                  setToast(t("Organisation renommée.", "Organization renamed."));
                }
              }}
            >
              {t("Renommer", "Rename")}
            </Button>
          </div>
        </div>
        <div className="min-w-0">
          <label className="text-2xs font-medium text-muted">{t("Secteur d'activité", "Industry")}</label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="mt-1 block w-full rounded-md border border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          >
            {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
          </select>
        </div>
      </div>

      <SectionLabel>{t("Composition", "Composition")}</SectionLabel>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={() => onNavigate("companies")}
          className="cursor-pointer rounded-md border border-hair bg-canvas p-3 text-left hover:bg-canvas/60"
        >
          <div className="text-sm font-medium text-ink">{t("Entreprises", "Companies")} ({companies.length})</div>
          <div className="text-2xs text-muted">
            {companies.length ? companies.map((c) => c.code).join(", ") : t("Aucune entreprise pour le moment.", "No companies yet.")}
          </div>
        </button>
        <button
          onClick={() => onNavigate("team")}
          className="cursor-pointer rounded-md border border-hair bg-canvas p-3 text-left hover:bg-canvas/60"
        >
          <div className="text-sm font-medium text-ink">
            {t("Membres de l'équipe", "Team members")}{teamCount != null ? ` (${teamCount})` : ""}
          </div>
          <div className="text-2xs text-muted">{t("Gérer les rôles et les accès", "Manage roles and access")}</div>
        </button>
      </div>

      <SectionLabel>{t("Abonnement & facturation", "Subscription & billing")}</SectionLabel>
      <div className="rounded-md border border-hair p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink">{t("Offre actuelle : Essai gratuit", "Current plan: Free trial")}</div>
            <div className="text-2xs text-muted">{t("30 jours restants", "30 days remaining")}</div>
          </div>
          <Button variant="primary" className="shrink-0" disabled title={t("La facturation sera activée dans la prochaine phase.", "Billing will be enabled in the next phase.")}>{t("Changer d'offre", "Upgrade plan")}</Button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3 text-2xs text-muted">
          <div>{t("Prochaine date de facturation :", "Next billing date:")} —</div>
          <div>{t("Moyen de paiement :", "Payment method:")} {t("non défini", "not set")}</div>
        </div>
      </div>

      <SectionLabel>{t("Zone de danger", "Danger zone")}</SectionLabel>
      <div className="rounded-md border border-red-200 bg-red-50/40 p-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-red-700">{t("Supprimer l'organisation", "Delete organization")}</div>
            <div className="mt-0.5 text-2xs text-muted">{t("Supprime l'organisation et chaque entreprise, publication, audience et membre d'équipe.", "Removes the organization and every company, post, audience, and team member.")}</div>
          </div>
          <Button variant="danger" className="shrink-0" onClick={() => setDeleteOpen(true)}>{t("Supprimer l'organisation", "Delete organization")}</Button>
        </div>
      </div>

      {deleteOpen && (
        <Modal open onClose={() => setDeleteOpen(false)} width="max-w-md">
          <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">
            {t("Supprimer l'organisation", "Delete organization")}
          </div>
          <div className="space-y-3 p-4 text-sm text-ink">
            <p>{t("Cela supprimera définitivement l'organisation et toutes ses données.", "This will permanently delete the organization and all its data.")}</p>
            <p>
              {t("Tapez", "Type")} <span className="font-semibold">&apos;{name}&apos;</span> {t("pour confirmer.", "to confirm.")}
            </p>
            <input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder={name}
              className="w-full rounded-md border border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>{t("Annuler", "Cancel")}</Button>
            <Button
              variant="danger"
              disabled={deleteText !== name}
              onClick={() => {
                setDeleteOpen(false);
                setDeleteText("");
                setToast(t("La suppression de l'organisation est une action fictive — rien n'a été supprimé.", "Organization deletion is a mock action — nothing was actually deleted."));
              }}
            >
              {t("Supprimer définitivement", "Delete forever")}
            </Button>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
