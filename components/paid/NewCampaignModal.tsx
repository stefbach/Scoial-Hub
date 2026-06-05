"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Pills } from "@/components/ui/Tabs";
import { DatePicker } from "@/components/ui/DateTimePicker";
import { useCompany } from "@/lib/company-context";
import { updateCampaign as updateCampaignLocal } from "@/lib/campaign-store";
import { useT } from "@/lib/i18n";
import type { Campaign } from "@/lib/types";

function platformsToId(platforms: ("FB" | "IG")[]): string {
  if (platforms.includes("FB") && platforms.includes("IG")) return "fbig";
  if (platforms.includes("FB")) return "fb";
  return "ig";
}

function idToPlatforms(id: string): ("FB" | "IG")[] {
  if (id === "fbig") return ["FB", "IG"];
  if (id === "fb") return ["FB"];
  return ["IG"];
}

export function NewCampaignModal({
  open,
  onClose,
  campaign,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  campaign?: Campaign;
  onSaved?: () => void;
}) {
  const { company, data } = useCompany();
  const t = useT();
  const editing = !!campaign;

  // Preset de création : « Simple » (champs essentiels, valeurs par défaut
  // raisonnables) ou « Avancé » (formulaire complet). Par défaut : Simple pour
  // une création. En édition, on ouvre directement le mode Avancé pour ne rien
  // masquer des réglages existants.
  const [mode, setMode] = useState<"simple" | "advanced">(
    editing ? "advanced" : "simple"
  );
  const simple = mode === "simple";

  const [name, setName] = useState(campaign?.name ?? "");
  const [objective, setObjective] = useState(
    (campaign?.objective ?? "leads").toLowerCase()
  );
  const [platformId, setPlatformId] = useState(
    campaign ? platformsToId(campaign.platforms) : "fbig"
  );
  const [budgetType, setBudgetType] = useState<"daily" | "lifetime">(
    campaign?.lifetimeBudget && !campaign?.dailyBudget ? "lifetime" : "daily"
  );
  const [budgetAmount, setBudgetAmount] = useState(
    String(
      budgetType === "lifetime"
        ? (campaign?.lifetimeBudget ?? campaign?.budget ?? 500)
        : (campaign?.dailyBudget ?? 40)
    )
  );
  const [startDate, setStartDate] = useState<Date>(
    new Date(`${campaign?.startDate ?? "2026-05-27"}T00:00:00`)
  );
  const [endDate, setEndDate] = useState<Date | null>(
    campaign?.endDate ? new Date(`${campaign.endDate}T00:00:00`) : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const OBJECTIVES = [
    { id: "awareness", label: t("Notoriété", "Awareness") },
    { id: "traffic", label: t("Trafic", "Traffic") },
    { id: "engagement", label: t("Engagement", "Engagement") },
    { id: "leads", label: t("Prospects", "Leads") },
    { id: "sales", label: t("Ventes", "Sales") },
    { id: "conversions", label: t("Conversions", "Conversions") },
  ];

  const budgetSuffix =
    budgetType === "lifetime"
      ? t("total", "total")
      : t("/ jour", "/ day");

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("Le nom de la campagne est requis.", "Campaign name is required."));
      return;
    }

    const amount = parseFloat(budgetAmount) || 0;
    // En mode Simple, le budget est toujours journalier.
    const effectiveBudgetType = simple ? "daily" : budgetType;
    const dailyBudgetVal = effectiveBudgetType === "daily" ? amount : undefined;
    const lifetimeBudgetVal = effectiveBudgetType === "lifetime" ? amount : undefined;
    const startIso = format(startDate, "yyyy-MM-dd");
    const endIso = endDate ? format(endDate, "yyyy-MM-dd") : null;
    const platforms = idToPlatforms(
      typeof platformId === "string" ? platformId : "fbig"
    );

    setSaving(true);
    setError(null);

    try {
      if (editing && campaign) {
        const res = await fetch(`/api/campaigns/${campaign.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            objective,
            platforms,
            dailyBudget: dailyBudgetVal,
            lifetimeBudget: lifetimeBudgetVal,
            budget: amount,
            startDate: startIso,
            endDate: endIso,
          }),
        });

        // Also update local store so UI reflects changes immediately
        updateCampaignLocal(company.id, campaign.id, {
          name: trimmedName,
          objective,
          platforms,
          dailyBudget: dailyBudgetVal,
          lifetimeBudget: lifetimeBudgetVal,
          budget: amount,
          startDate: startIso,
          endDate: endIso,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.warn("[NewCampaignModal] PATCH failed:", body);
          // Do not block the UI — local update already applied
        }
      } else {
        const res = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: company.id,
            name: trimmedName,
            objective,
            platforms,
            status: "paused",
            enabled: false,
            budget: amount,
            dailyBudget: dailyBudgetVal,
            lifetimeBudget: lifetimeBudgetVal,
            startDate: startIso,
            endDate: endIso,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.warn("[NewCampaignModal] POST failed:", body);
          // Continue — the parent's onSaved + re-fetch will reconcile
        }
      }

      onSaved?.();
      onClose();
    } catch (err) {
      console.error("[NewCampaignModal] save error:", err);
      // Don't block close on network errors
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} width="max-w-xl">
      <div className="border-b-hair border-hair px-4 py-3">
        <div className="text-sm font-semibold text-ink">
          {editing ? t("Modifier la campagne", "Edit campaign") : t("Nouvelle campagne", "New campaign")}
        </div>
        <div className="text-2xs text-muted">
          {t("Entreprise", "Company")}: <span className="font-medium text-ink">{company.code}</span>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto p-4 pb-40">
        {error && (
          <div className="mb-3 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-2xs text-danger-700">
            {error}
          </div>
        )}

        {/* Preset de création : Simple / Avancé */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-2xs font-medium text-muted">{t("Mode de création", "Creation mode")}</label>
            <span className="text-2xs text-muted">
              {simple
                ? t("L'essentiel, prêt en 30 s", "Just the essentials, ready in 30s")
                : t("Tous les réglages", "All settings")}
            </span>
          </div>
          <Pills
            key={mode}
            options={[
              { id: "simple", label: t("Simple", "Simple") },
              { id: "advanced", label: t("Avancé", "Advanced") },
            ]}
            defaultId={mode}
            onChange={(id) => setMode(id as "simple" | "advanced")}
          />
        </div>

        <div className="mb-3">
          <label className="text-2xs font-medium text-muted">{t("Nom de la campagne", "Campaign name")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. January Detox Program — Lead Gen"
            className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-2xs font-medium text-muted">{t("Objectif", "Objective")}</label>
          <Pills
            options={OBJECTIVES}
            defaultId={objective}
            onChange={(id) => setObjective(id)}
          />
        </div>

        {!simple && (
          <div className="mb-3">
            <label className="mb-1 block text-2xs font-medium text-muted">{t("Plateformes", "Platforms")}</label>
            <Pills
              options={[
                { id: "fb", label: "Facebook" },
                { id: "ig", label: "Instagram" },
                { id: "fbig", label: "Facebook + Instagram" },
              ]}
              defaultId={typeof platformId === "string" ? platformId : "fbig"}
              tone="ai"
              onChange={(id) => setPlatformId(id)}
            />
          </div>
        )}

        {simple ? (
          // Mode Simple : budget journalier uniquement (valeur par défaut 40 €/j)
          <div className="mb-3">
            <label className="text-2xs font-medium text-muted">{t("Budget par jour", "Budget per day")}</label>
            <div className="mt-1 flex items-center gap-2 rounded-md border-hair border-hair bg-card px-3 py-2">
              <span className="text-2xs text-muted">EUR</span>
              <input
                inputMode="decimal"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                className="w-full bg-transparent text-sm text-ink focus:outline-none"
              />
              <span className="shrink-0 text-2xs text-muted">{t("/ jour", "/ day")}</span>
            </div>
          </div>
        ) : (
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-2xs font-medium text-muted">{t("Type de budget", "Budget type")}</label>
              <select
                value={budgetType}
                onChange={(e) => setBudgetType(e.target.value as "daily" | "lifetime")}
                className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
              >
                <option value="daily">{t("Budget journalier", "Daily budget")}</option>
                <option value="lifetime">{t("Budget total", "Lifetime budget")}</option>
              </select>
            </div>
            <div>
              <label className="text-2xs font-medium text-muted">{t("Montant", "Amount")}</label>
              <div className="mt-1 flex items-center gap-2 rounded-md border-hair border-hair bg-card px-3 py-2">
                <span className="text-2xs text-muted">EUR</span>
                <input
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="w-full bg-transparent text-sm text-ink focus:outline-none"
                />
                <span className="shrink-0 text-2xs text-muted">{budgetSuffix}</span>
              </div>
            </div>
          </div>
        )}

        {!simple && (
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-2xs font-medium text-muted">{t("Date de début", "Start date")}</label>
              <div className="mt-1">
                <DatePicker value={startDate} onChange={setStartDate} />
              </div>
            </div>
            <div>
              <label className="text-2xs font-medium text-muted">{t("Date de fin", "End date")}</label>
              <div className="mt-1 flex items-center gap-2">
                {endDate ? (
                  <>
                    <div className="flex-1">
                      <DatePicker value={endDate} onChange={setEndDate} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setEndDate(null)}
                      className="rounded-md px-2 py-2 text-2xs text-muted hover:bg-canvas hover:text-ink"
                    >
                      {t("Effacer", "Clear")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEndDate(startDate)}
                    className="w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-left text-sm text-muted hover:bg-canvas"
                  >
                    {t("Pas de date de fin", "No end date")}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {simple && (
          <div className="mb-3 rounded-md border border-hair bg-canvas px-3 py-2 text-2xs text-muted">
            {t(
              "Mode Simple : Facebook + Instagram, démarrage aujourd'hui, sans date de fin. Passez en « Avancé » pour tout personnaliser.",
              "Simple mode: Facebook + Instagram, starts today, no end date. Switch to “Advanced” to customize everything."
            )}
          </div>
        )}

        <div className="rounded-md border-hair border-amber-200 bg-amber-50 px-3 py-2 text-2xs text-amber-700">
          {t(
            `Un plafond budgétaire est requis pour chaque campagne. Les dépenses s'arrêtent au plafond mensuel de ${company.code} : EUR ${data.adSafety.monthlyCap.toLocaleString()}.`,
            `A budget cap is required on every campaign. Spend stops at ${company.code}'s monthly cap of EUR ${data.adSafety.monthlyCap.toLocaleString()}.`
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t-hair border-hair px-4 py-3">
        <span className="text-2xs text-muted">
          {t(
            `Protections actives · Lecture seule désactivée · Confirmation double EUR ${data.adSafety.doubleConfirmThreshold}/jour`,
            `Safeguards active · Read-only off · EUR ${data.adSafety.doubleConfirmThreshold}/day double-confirm`
          )}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t("Annuler", "Cancel")}</Button>
          <Button variant="primary" onClick={save} disabled={saving || !name.trim()}>
            {saving ? (
              <span className="flex items-center gap-2">
                <Spinner size={14} />
                {t("Enregistrement…", "Saving…")}
              </span>
            ) : editing ? (
              t("Enregistrer les modifications", "Save changes")
            ) : (
              t("Créer la campagne", "Create campaign")
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
