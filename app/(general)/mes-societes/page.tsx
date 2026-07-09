"use client";

// ── Mes sociétés ─────────────────────────────────────────────────────────────
// Surface de sélection (verrouillée, plus de menu déroulant volatil) ET de
// gestion des sociétés : choisir la société active, créer, éditer, gérer les
// connexions, supprimer. La création/édition/suppression est réservée à
// l'admin du compte.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCompany } from "@/lib/company-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { NewCompanyModal } from "@/components/company/NewCompanyModal";
import { useT } from "@/lib/i18n";
import type { Company } from "@/lib/types";

export default function MesSocietesPage() {
  const { companies, company, setCompanyId, updateCompany, access } = useCompany();
  const router = useRouter();
  const t = useT();
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  // #9 — la suppression passe par une modale de confirmation stylée (plus de confirm() natif).
  const [deleting, setDeleting] = useState<Company | null>(null);

  const isAdmin = access.isAccountAdmin;

  function open(id: string) {
    setCompanyId(id);
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={t("Mes sociétés", "My companies")}
        scoped={false}
        actions={
          isAdmin ? (
            <button onClick={() => setOpenNew(true)} className="btn-primary text-sm">
              + {t("Nouvelle société", "New company")}
            </button>
          ) : undefined
        }
      />
      <p className="-mt-3 max-w-3xl text-sm text-muted">
        {t(
          "Choisissez la société sur laquelle travailler — c'est ici que se verrouille votre périmètre. Gérez aussi leurs connexions et leur identité.",
          "Pick the company you work on — this is where your scope is locked. Also manage their connections and identity."
        )}
      </p>

      {companies.filter((c) => c.id).length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted">
            {t("Aucune société pour le moment.", "No company yet.")}
          </p>
          {isAdmin && (
            <button onClick={() => setOpenNew(true)} className="btn-primary mt-3 text-sm">
              + {t("Créer ma première société", "Create my first company")}
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {companies.filter((c) => c.id).map((c) => {
            const active = c.id === company.id;
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                aria-pressed={active}
                onClick={() => setCompanyId(c.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCompanyId(c.id); } }}
                className={`card cursor-pointer p-4 transition-all hover:border-page/50 ${active ? "ring-2 ring-page/60 border-page/50" : ""}`}
                title={t("Cliquer pour choisir cette société", "Click to select this company")}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                    style={{ background: c.accent || "#7c3aed" }}
                  >
                    {(c.code || "—").slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                      {active && <span className="chip text-success-600">{t("active", "active")}</span>}
                    </div>
                    {c.brandVoice && <p className="mt-0.5 line-clamp-2 text-2xs text-muted">{c.brandVoice}</p>}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); open(c.id); }} className="btn-primary text-2xs">
                    {active ? t("Ouvrir →", "Open →") : t("Choisir & ouvrir", "Select & open")}
                  </button>
                  <Link href="/accounts" onClick={(e) => { e.stopPropagation(); setCompanyId(c.id); }} className="btn-secondary text-2xs">
                    {t("Connexions", "Connections")}
                  </Link>
                  {isAdmin && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setEditing(c); }} className="btn-ghost text-2xs text-muted">
                        {t("Modifier", "Edit")}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleting(c); }} className="btn-ghost text-2xs text-danger-600">
                        {t("Supprimer", "Delete")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewCompanyModal open={openNew} onClose={() => setOpenNew(false)} />
      {deleting && <ConfirmDeleteModal company={deleting} onClose={() => setDeleting(null)} />}
      {editing && (
        <EditCompanyModal
          company={editing}
          onClose={() => setEditing(null)}
          onSaved={(patch) => {
            updateCompany(editing.id, patch);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// #9 — Confirmation de suppression stylée (overlay + carte, Échap/overlay pour
// fermer via <Modal>, bouton danger). Remplace le confirm() natif du navigateur.
function ConfirmDeleteModal({ company, onClose }: { company: Company; onClose: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/companies/${encodeURIComponent(company.id)}`, { method: "DELETE" });
    if (res.ok) {
      window.location.reload();
    } else {
      setError(t("Suppression impossible.", "Could not delete."));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} width="max-w-sm">
      <div className="p-5">
        <h2 className="text-base font-semibold text-ink">{t("Supprimer la société", "Delete company")}</h2>
        <p className="mt-2 text-sm text-muted">
          {t(
            `Supprimer « ${company.name} » ? Cette action est définitive.`,
            `Delete "${company.name}"? This is permanent.`
          )}
        </p>
        {error && <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">{t("Annuler", "Cancel")}</button>
          <button onClick={confirmDelete} disabled={busy} className="btn-danger text-sm">
            {busy ? t("Suppression…", "Deleting…") : t("Supprimer", "Delete")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditCompanyModal({
  company,
  onClose,
  onSaved,
}: {
  company: Company;
  onClose: () => void;
  onSaved: (patch: Partial<Company>) => void;
}) {
  const t = useT();
  const [name, setName] = useState(company.name);
  const [brandVoice, setBrandVoice] = useState(company.brandVoice);
  const [accent, setAccent] = useState(company.accent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(company.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, brandVoice, accent }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "fail");
      onSaved({ name, brandVoice, accent });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec.", "Failed."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-ink">{t("Modifier la société", "Edit company")}</h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="section-label">{t("Nom", "Name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1" />
          </div>
          <div>
            <label className="section-label">{t("Voix de marque", "Brand voice")}</label>
            <input value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)} className="input mt-1" />
          </div>
          <div>
            <label className="section-label">{t("Couleur d'accent", "Accent color")}</label>
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="mt-1 h-9 w-16 cursor-pointer rounded border border-hair bg-card" />
          </div>
          {error && <p className="text-2xs text-danger-600">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">{t("Annuler", "Cancel")}</button>
          <button onClick={save} disabled={saving} className="btn-primary text-sm">
            {saving ? t("Enregistrement…", "Saving…") : t("Enregistrer", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
