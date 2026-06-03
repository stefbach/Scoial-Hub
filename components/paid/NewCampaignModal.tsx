"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Pills } from "@/components/ui/Tabs";
import { DatePicker } from "@/components/ui/DateTimePicker";
import { useCompany } from "@/lib/company-context";
import { updateCampaign } from "@/lib/campaign-store";
import { useT } from "@/lib/i18n";
import type { Campaign } from "@/lib/types";

function platformsToId(platforms: ("FB" | "IG")[]): string {
  if (platforms.includes("FB") && platforms.includes("IG")) return "fbig";
  if (platforms.includes("FB")) return "fb";
  return "ig";
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

  const [name, setName] = useState(campaign?.name ?? "");
  const [startDate, setStartDate] = useState<Date>(
    new Date(`${campaign?.startDate ?? "2026-05-27"}T00:00:00`)
  );
  const [endDate, setEndDate] = useState<Date | null>(
    campaign?.endDate ? new Date(`${campaign.endDate}T00:00:00`) : null
  );

  const OBJECTIVES = [
    { id: "awareness", label: t("Notoriété", "Awareness") },
    { id: "traffic", label: t("Trafic", "Traffic") },
    { id: "engagement", label: t("Engagement", "Engagement") },
    { id: "leads", label: t("Prospects", "Leads") },
    { id: "sales", label: t("Ventes", "Sales") },
    { id: "conversions", label: t("Conversions", "Conversions") },
  ];

  const save = () => {
    if (!editing || !campaign) {
      onClose();
      return;
    }
    updateCampaign(company.id, campaign.id, {
      name: name.trim() || campaign.name,
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: endDate ? format(endDate, "yyyy-MM-dd") : null,
    });
    onSaved?.();
    onClose();
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

      <div className="max-h-[70vh] overflow-y-auto p-4">
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
          <Pills options={OBJECTIVES} defaultId={(campaign?.objective ?? "leads").toLowerCase()} />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-2xs font-medium text-muted">{t("Plateformes", "Platforms")}</label>
          <Pills
            options={[
              { id: "fb", label: "Facebook" },
              { id: "ig", label: "Instagram" },
              { id: "fbig", label: "Facebook + Instagram" },
            ]}
            defaultId={campaign ? platformsToId(campaign.platforms) : "fbig"}
            tone="ai"
          />
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-2xs font-medium text-muted">{t("Type de budget", "Budget type")}</label>
            <select className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none">
              <option>{t("Budget journalier", "Daily budget")}</option>
              <option>{t("Budget total", "Lifetime budget")}</option>
            </select>
          </div>
          <div>
            <label className="text-2xs font-medium text-muted">{t("Montant", "Amount")}</label>
            <div className="mt-1 flex items-center gap-2 rounded-md border-hair border-hair bg-card px-3 py-2">
              <span className="text-2xs text-muted">EUR</span>
              <input
                defaultValue={String(campaign?.dailyBudget ?? 40)}
                className="w-full bg-transparent text-sm text-ink focus:outline-none"
              />
              <span className="text-2xs text-muted">{t("/ jour", "/ day")}</span>
            </div>
          </div>
        </div>

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
          <Button variant="secondary" onClick={onClose}>{t("Annuler", "Cancel")}</Button>
          <Button variant="primary" onClick={save}>
            {editing ? t("Enregistrer les modifications", "Save changes") : t("Créer la campagne", "Create campaign")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
