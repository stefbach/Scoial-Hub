"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DateTimePicker";
import { Toggle } from "@/components/ui/Toggle";
import { useCompany } from "@/lib/company-context";
import { addAdSet, updateAdSet } from "@/lib/campaign-store";
import { useT } from "@/lib/i18n";
import { NewAudienceModal } from "./NewAudienceModal";
import type { AdSet, Audience } from "@/lib/types";

const PLACEMENT_OPTIONS = [
  { id: "fb_feed", label: "FB Feed" },
  { id: "ig_feed", label: "IG Feed" },
  { id: "ig_stories", label: "IG Stories" },
  { id: "ig_reels", label: "IG Reels" },
  { id: "fb_reels", label: "FB Reels" },
];

export function AdSetModal({
  campaignId,
  adSet,
  onClose,
  onSaved,
}: {
  campaignId: string;
  adSet?: AdSet;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { company, data } = useCompany();
  const t = useT();
  const editing = !!adSet;

  const [name, setName] = useState(adSet?.name ?? "");
  const [audienceId, setAudienceId] = useState<string>(
    adSet?.audienceId ?? data.audiences.list[0]?.id ?? ""
  );
  const [placementMode, setPlacementMode] = useState<"automatic" | "advanced">(
    adSet?.placementMode ?? "automatic"
  );
  const [placements, setPlacements] = useState<string[]>(
    adSet?.placements ?? ["fb_feed", "ig_feed"]
  );
  const [budgetType, setBudgetType] = useState<"daily" | "lifetime">(
    adSet?.budgetType ?? "daily"
  );
  const [amount, setAmount] = useState<number>(
    (budgetType === "lifetime" ? adSet?.lifetimeBudget : adSet?.dailyBudget) ?? 40
  );
  const [startDate, setStartDate] = useState<Date>(
    new Date(`${adSet?.startDate ?? new Date().toISOString().slice(0, 10)}T00:00:00`)
  );
  const [endDate, setEndDate] = useState<Date | null>(
    adSet?.endDate ? new Date(`${adSet.endDate}T00:00:00`) : null
  );
  const [goal, setGoal] = useState<AdSet["optimizationGoal"]>(
    adSet?.optimizationGoal ?? "conversions"
  );
  const [newAudienceOpen, setNewAudienceOpen] = useState(false);

  const GOALS = [
    { id: "conversions", label: t("Conversions", "Conversions"), help: t("Meta optimise pour les utilisateurs les plus susceptibles de convertir.", "Meta will optimize for users most likely to convert.") },
    { id: "link_clicks", label: t("Clics sur le lien", "Link clicks"), help: t("Optimise pour les clics vers votre URL de destination.", "Optimize for clicks to your destination URL.") },
    { id: "reach", label: t("Portée", "Reach"), help: t("Montrez vos publicités au plus grand nombre d'utilisateurs uniques possible.", "Show your ads to the largest unique audience possible.") },
    { id: "impressions", label: t("Impressions", "Impressions"), help: t("Maximise le nombre de fois où vos publicités sont affichées.", "Maximize the number of times your ads are displayed.") },
  ] as const;

  const audience = data.audiences.list.find((a) => a.id === audienceId);
  const currentGoalHelp = GOALS.find((g) => g.id === goal)?.help ?? "";

  const togglePlacement = (id: string) =>
    setPlacements((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    );

  const handleAudienceCreated = (a: Audience) => {
    setAudienceId(a.id);
  };

  const buildPlacementSummary = () =>
    placementMode === "automatic"
      ? t("Automatique", "Automatic")
      : placements
          .map((id) => PLACEMENT_OPTIONS.find((p) => p.id === id)?.label ?? id)
          .join(" + ");

  const save = () => {
    if (!name.trim() || !audience) return;
    const placementSummary = buildPlacementSummary();
    const base: AdSet = {
      id: adSet?.id ?? `aset-${Date.now()}`,
      name: name.trim(),
      placement: placementSummary,
      targeting: audience.name,
      ads: adSet?.ads ?? 0,
      dailyBudget: budgetType === "daily" ? amount : adSet?.dailyBudget ?? 0,
      lifetimeBudget: budgetType === "lifetime" ? amount : adSet?.lifetimeBudget,
      budgetType,
      enabled: editing ? adSet?.enabled ?? false : false,
      status: editing ? adSet?.status ?? "paused" : "paused",
      audienceId: audience.id,
      audienceName: audience.name,
      audienceReach: audience.reach,
      placementMode,
      placements: placementMode === "advanced" ? placements : undefined,
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: endDate ? format(endDate, "yyyy-MM-dd") : null,
      optimizationGoal: goal,
      spend: adSet?.spend ?? 0,
      impressions: adSet?.impressions ?? 0,
      clicks: adSet?.clicks ?? 0,
      conversions: adSet?.conversions ?? 0,
      series: adSet?.series,
    };

    if (editing) updateAdSet(company.id, base.id, base);
    else addAdSet(company.id, campaignId, base);
    onSaved?.();
    onClose();
  };

  return (
    <Modal open onClose={onClose} width="max-w-xl">
      <div className="border-b-hair border-hair px-4 py-3">
        <div className="text-sm font-semibold text-ink">
          {editing ? t("Modifier l'ensemble de publicités", "Edit ad set") : t("Nouvel ensemble de publicités", "New ad set")}
        </div>
        <div className="text-2xs text-muted">
          {t("Entreprise", "Company")}: <span className="font-medium text-ink">{company.code}</span>
        </div>
      </div>

      <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
        <div>
          <label className="text-2xs font-medium text-muted">{t("Nom de l'ensemble", "Ad set name")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Women 35-55 Mauritius"
            className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
          />
          <div className="mt-1 text-2xs text-muted">{t("Nom interne, non visible par les clients.", "Internal name, not customer-facing.")}</div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">{t("Audience", "Audience")}</label>
          <select
            value={audienceId}
            onChange={(e) => setAudienceId(e.target.value)}
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          >
            {data.audiences.list.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.reach}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setNewAudienceOpen(true)}
            className="mt-1 text-2xs text-ai-text underline hover:text-ai-text/80"
          >
            + {t("Créer une nouvelle audience", "Create new audience")}
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-2xs font-medium text-muted">{t("Emplacements", "Placements")}</label>
            <label className="flex items-center gap-1.5 text-2xs text-muted">
              {t("Avancé", "Advanced")}
              <Toggle
                key={placementMode}
                defaultOn={placementMode === "advanced"}
                onChange={(on) => setPlacementMode(on ? "advanced" : "automatic")}
              />
            </label>
          </div>
          {placementMode === "automatic" ? (
            <div className="mt-1 flex items-start gap-2 rounded-md border-hair border-ai-visual/20 bg-ai-visualbg p-3">
              <SparkleIcon />
              <div>
                <div className="text-xs font-medium text-ai-visual">{t("Emplacements automatiques", "Automatic placements")}</div>
                <div className="text-2xs text-muted">
                  {t("Meta choisit la meilleure combinaison sur Facebook et Instagram. Recommandé pour la plupart des campagnes.", "Meta chooses the best mix across Facebook and Instagram surfaces. Recommended for most campaigns.")}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-1 grid grid-cols-2 gap-2 rounded-md border-hair border-hair bg-canvas p-3 text-sm text-ink sm:grid-cols-3">
              {PLACEMENT_OPTIONS.map((p) => (
                <label key={p.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={placements.includes(p.id)}
                    onChange={() => togglePlacement(p.id)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
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
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-transparent text-sm text-ink focus:outline-none"
              />
              <span className="text-2xs text-muted">
                {budgetType === "daily" ? t("/ jour", "/ day") : t("total", "total")}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
                  {t("Diffusion continue", "Run continuously")}
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">{t("Objectif d'optimisation", "Optimization goal")}</label>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as AdSet["optimizationGoal"])}
            className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          >
            {GOALS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <div className="mt-1 text-2xs text-muted">{currentGoalHelp}</div>
        </div>

        {!editing && (
          <div className="rounded-md border-hair border-amber-200 bg-amber-50 px-3 py-2 text-2xs text-amber-700">
            {t(
              "L'ensemble de publicités sera créé en pause. Activez-le depuis la page de détail de la campagne quand vous êtes prêt à dépenser.",
              "Ad set will be created paused. Activate it from the Campaign detail page when you're ready to spend."
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="secondary" onClick={onClose}>{t("Annuler", "Cancel")}</Button>
        <Button variant="primary" disabled={!name.trim() || !audience} onClick={save}>
          {editing ? t("Enregistrer les modifications", "Save changes") : t("Créer l'ensemble", "Create ad set")}
        </Button>
      </div>

      {newAudienceOpen && (
        <NewAudienceModal
          companyId={company.id}
          onClose={() => setNewAudienceOpen(false)}
          onCreated={handleAudienceCreated}
        />
      )}
    </Modal>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-ai-visual">
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M19 14l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
