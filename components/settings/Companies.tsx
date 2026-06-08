"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { ImageUpload, type UploadedImage } from "@/components/ui/ImageUpload";
import { SubHeader } from "./shared";
import { ORG_NAME } from "@/lib/mock-data";
import { useCompany } from "@/lib/company-context";
import type { Company } from "@/lib/types";
import { useT } from "@/lib/i18n";

const ACCENTS = ["#60a5fa", "#d62976", "#16a34a", "#7c3aed", "#ea580c", "#0a66c2"];

function deriveCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "NEW";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).slice(0, 3).join("").toUpperCase();
}

function deriveId(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "company"}-${Date.now().toString(36)}`;
}

export function Companies() {
  const t = useT();
  const { companies, addCompany, updateCompany } = useCompany();
  const [open, setOpen] = useState<{ mode: "new" | "edit"; company?: Company } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  return (
    <div>
      <SubHeader title={t("Entreprises", "Companies")} scope="org" scopeLabel={ORG_NAME} />
      <p className="mb-4 text-sm text-muted">{t("Chaque entreprise a ses propres comptes sociaux, bibliothèque et campagnes.", "Each company has its own social accounts, library, and campaigns.")}</p>

      <div className="space-y-2">
        {companies.map((c) => (
          <button
            key={c.id}
            onClick={() => setOpen({ mode: "edit", company: c })}
            className="flex w-full cursor-pointer items-center gap-3 rounded-md border-hair border-hair bg-canvas px-3 py-2.5 text-left transition-colors hover:bg-canvas/60"
          >
            <span
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-2xs font-bold text-white"
              style={{ backgroundColor: c.accent }}
            >
              {c.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.logoUrl} alt={c.name} className="h-full w-full object-cover" />
              ) : (
                c.code
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink">{c.name}</div>
              <div className="truncate text-2xs text-muted">{t("Voix de marque :", "Brand voice:")} {c.brandVoice}</div>
            </div>
            <span className="text-muted">›</span>
          </button>
        ))}
      </div>

      <Button variant="secondary" className="mt-3" onClick={() => setOpen({ mode: "new" })}>
        {t("+ Ajouter une entreprise", "+ Add company")}
      </Button>

      {open && (
        <CompanyModal
          mode={open.mode}
          company={open.company}
          onClose={() => setOpen(null)}
          onCreate={(payload) => {
            const id = deriveId(payload.name);
            const newCompany: Company = {
              id,
              code: deriveCode(payload.name),
              name: payload.name.trim(),
              brandVoice: payload.brandVoice.trim(),
              accent: ACCENTS[companies.length % ACCENTS.length],
              logoUrl: payload.logoUrl,
              defaultPlatforms: payload.defaultPlatforms,
              defaultPostingTime: payload.defaultPostingTime,
              defaultNeedsReview: payload.defaultNeedsReview,
            };
            addCompany(newCompany);
            setToast(t(`Entreprise ${newCompany.name} créée.`, `Created company ${newCompany.name}.`));
            setOpen(null);
          }}
          onSave={(id, payload) => {
            updateCompany(id, {
              name: payload.name.trim(),
              brandVoice: payload.brandVoice.trim(),
              logoUrl: payload.logoUrl,
              defaultPlatforms: payload.defaultPlatforms,
              defaultPostingTime: payload.defaultPostingTime,
              defaultNeedsReview: payload.defaultNeedsReview,
            });
            setToast(t(`Modifications enregistrées pour ${payload.name}.`, `Saved changes to ${payload.name}.`));
            setOpen(null);
          }}
          onDelete={(name) => {
            setToast(t(`Suppression fictive — ${name} est conservée.`, `Company deletion is a mock action — ${name} is preserved.`));
            setOpen(null);
          }}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

interface CompanyPayload {
  name: string;
  brandVoice: string;
  logoUrl?: string;
  defaultPlatforms: ("facebook" | "instagram" | "linkedin")[];
  defaultPostingTime: string;
  defaultNeedsReview: boolean;
}

function CompanyModal({
  mode,
  company,
  onClose,
  onCreate,
  onSave,
  onDelete,
}: {
  mode: "new" | "edit";
  company?: Company;
  onClose: () => void;
  onCreate: (payload: CompanyPayload) => void;
  onSave: (id: string, payload: CompanyPayload) => void;
  onDelete: (name: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState(company?.name ?? "");
  const [brandVoice, setBrandVoice] = useState(company?.brandVoice ?? "");
  const [logo, setLogo] = useState<UploadedImage | null>(
    company?.logoUrl ? { url: company.logoUrl, name: "Current logo", size: 0 } : null
  );
  const [platforms, setPlatforms] = useState<{ facebook: boolean; instagram: boolean; linkedin: boolean }>({
    facebook: company?.defaultPlatforms?.includes("facebook") ?? true,
    instagram: company?.defaultPlatforms?.includes("instagram") ?? true,
    linkedin: company?.defaultPlatforms?.includes("linkedin") ?? false,
  });
  const [defaultTime, setDefaultTime] = useState(company?.defaultPostingTime ?? "09:00");
  const [needsReviewDefault, setNeedsReviewDefault] = useState(company?.defaultNeedsReview ?? false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  const editing = mode === "edit";
  const canSave = !!name.trim();

  const collectPayload = (): CompanyPayload => ({
    name,
    brandVoice,
    logoUrl: logo?.url,
    defaultPlatforms: (Object.keys(platforms) as (keyof typeof platforms)[]).filter((k) => platforms[k]),
    defaultPostingTime: defaultTime,
    defaultNeedsReview: needsReviewDefault,
  });

  return (
    <Modal open onClose={onClose} width="max-w-lg">
      <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">
        {editing ? t("Modifier l'entreprise", "Edit company") : t("Nouvelle entreprise", "New company")}
      </div>

      <div className="space-y-3 p-4">
        <div>
          <label className="text-2xs font-medium text-muted">{t("Nom de l'entreprise", "Company name")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          />
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">{t("Logo", "Logo")}</label>
          <div className="mt-1">
            <ImageUpload value={logo} onChange={setLogo} variant="zone" />
          </div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">{t("Voix de marque", "Brand voice")}</label>
          <textarea
            value={brandVoice}
            onChange={(e) => setBrandVoice(e.target.value)}
            className="mt-1 h-20 w-full resize-none rounded-md border-hair border-hair bg-card p-2 text-sm text-ink focus:outline-none"
          />
          <div className="mt-1 text-2xs text-muted">
            {t(
              "Utilisé par l'IA pour écrire dans la voix de cette entreprise. Soyez précis : « Chaleureux, professionnel, factuel, encourageant » fonctionne mieux que « sympathique ».",
              "Used by AI to write in this company's voice. Be specific: \"Warm, professional, evidence-based, encouraging\" works better than \"friendly\"."
            )}
          </div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">{t("Plateformes par défaut", "Default platforms")}</label>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-ink">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={platforms.facebook} onChange={() => setPlatforms((p) => ({ ...p, facebook: !p.facebook }))} />
              Facebook
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={platforms.instagram} onChange={() => setPlatforms((p) => ({ ...p, instagram: !p.instagram }))} />
              Instagram
            </label>
            <label
              className="flex cursor-not-allowed items-center gap-1.5 text-muted"
              title={t("LinkedIn pas encore connecté pour cette entreprise", "LinkedIn not yet connected for this company")}
            >
              <input type="checkbox" disabled />
              LinkedIn
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-2xs font-medium text-muted">{t("Heure de publication par défaut", "Default posting time")}</label>
            <input
              type="time"
              value={defaultTime}
              onChange={(e) => setDefaultTime(e.target.value)}
              className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
            />
          </div>
          <label className="flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              checked={needsReviewDefault}
              onChange={() => setNeedsReviewDefault((x) => !x)}
            />
            <span className="text-sm text-ink">{t("Les nouveaux posts sont en « à réviser » par défaut", "New posts default to 'needs review'")}</span>
          </label>
        </div>

        {editing && (
          <div className="mt-2 rounded-md border-hair border-red-200 bg-red-50/40 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-red-700">{t("Supprimer l'entreprise", "Delete company")}</div>
                <div className="text-2xs text-muted">
                  {t(`Supprime ${company?.name} ainsi que ses publications, audiences et campagnes.`, `Removes ${company?.name} including its posts, audiences, and campaigns.`)}
                </div>
              </div>
              <Button variant="danger" className="shrink-0" onClick={() => setDeleteOpen(true)}>{t("Supprimer l'entreprise", "Delete company")}</Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="secondary" onClick={onClose}>{t("Annuler", "Cancel")}</Button>
        <Button
          variant="primary"
          disabled={!canSave}
          onClick={() => {
            if (editing && company) onSave(company.id, collectPayload());
            else onCreate(collectPayload());
          }}
        >
          {editing ? t("Enregistrer", "Save changes") : t("Créer l'entreprise", "Create company")}
        </Button>
      </div>

      {editing && deleteOpen && company && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/20 p-6">
          <div className="w-full max-w-sm rounded-lg border-hair border-hair bg-card p-4 shadow-xl">
            <p className="text-sm text-ink">{t(`Cela supprimera définitivement ${company.name}.`, `This will permanently delete ${company.name}.`)}</p>
            <p className="mt-1 text-2xs text-muted">
              {t("Tapez", "Type")} <span className="font-semibold">&apos;{company.name}&apos;</span> {t("pour confirmer.", "to confirm.")}
            </p>
            <input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder={company.name}
              className="mt-2 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteOpen(false)}>{t("Annuler", "Cancel")}</Button>
              <Button
                variant="danger"
                disabled={deleteText !== company.name}
                onClick={() => onDelete(company.name)}
              >
                {t("Supprimer définitivement", "Delete forever")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
