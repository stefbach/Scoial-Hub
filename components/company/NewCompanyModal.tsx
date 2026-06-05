"use client";

// Création d'une société (« compte ») côté CLIENT. L'utilisateur peut en créer
// autant qu'il veut. Après création, on bascule dessus et on l'envoie vers le
// Démarrage assisté pour le profilage (site web + Meta + LinkedIn + TikTok +
// descriptif → analyse IA).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import type { Company } from "@/lib/types";

const ACCENTS = ["#2563eb", "#5b2d8e", "#0f766e", "#b45309", "#be123c", "#1f2937"];

export function NewCompanyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const { addCompany, setCompanyId } = useCompany();

  const [name, setName] = useState("");
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setAccent(ACCENTS[0]);
    setError(null);
  }

  async function create() {
    if (!name.trim()) {
      setError(t("Donnez un nom à la société.", "Give the company a name."));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), accent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "create failed");
      const company = data as Company;
      // Ajoute au contexte, bascule dessus, puis profilage assisté.
      addCompany(company);
      setCompanyId(company.id);
      reset();
      onClose();
      router.push("/demarrage?new=1");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec de la création.", "Creation failed."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} width="max-w-md">
      <div className="border-b border-hair px-5 py-3.5">
        <h2 className="text-base font-semibold text-ink">{t("Nouvelle société", "New company")}</h2>
        <p className="mt-0.5 text-2xs text-muted">
          {t(
            "Créez un compte. Vous pourrez en gérer plusieurs. Le profil sera construit à l'étape suivante.",
            "Create an account. You can manage several. The profile is built in the next step."
          )}
        </p>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <label className="section-label">{t("Nom de la société", "Company name")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder={t("ex. Clinique du Soleil", "e.g. Sunshine Clinic")}
            className="mt-1 w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
          />
        </div>

        <div>
          <label className="section-label">{t("Couleur d'accent", "Accent color")}</label>
          <p className="mt-0.5 text-2xs text-muted">
            {t("Utilisée dans votre tableau de bord", "Used across your dashboard")}
          </p>
          <div className="mt-1.5 flex gap-2">
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAccent(c)}
                aria-label={c}
                className={`h-7 w-7 rounded-full ring-2 transition-transform ${accent === c ? "ring-ink scale-110" : "ring-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-ai-textbg/40 px-3 py-2.5 text-2xs text-ai-text">
          {t(
            "Étape suivante : on vous demandera votre site web, vos comptes Meta / LinkedIn / TikTok et un descriptif — l'IA en déduira le profil de la marque.",
            "Next step: we'll ask for your website, your Meta / LinkedIn / TikTok accounts and a description — the AI will infer the brand profile."
          )}
        </div>

        {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</p>}
      </div>

      <div className="flex justify-end gap-2 border-t border-hair px-5 py-3">
        <button onClick={onClose} className="btn-secondary text-sm">{t("Annuler", "Cancel")}</button>
        <button onClick={create} disabled={saving} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
          {saving && <Spinner size={14} />}
          {saving ? t("Création…", "Creating…") : t("Créer et profiler", "Create & profile")}
        </button>
      </div>
    </Modal>
  );
}
