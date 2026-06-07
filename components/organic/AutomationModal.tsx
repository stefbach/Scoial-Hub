"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TimePicker } from "@/components/ui/DateTimePicker";
import { TagInput } from "@/components/ui/TagInput";
import { Toggle } from "@/components/ui/Toggle";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { addAutomation, updateAutomation } from "@/lib/automation-store";
import type { Automation, OnEmptyBehavior, Platform, WeekDay } from "@/lib/types";

const DAY_ORDER: WeekDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_IDX: Record<WeekDay, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

// May 25 2026 = Monday — used to project the "Next 3 posts" preview.
const ANCHOR = new Date("2026-05-25T00:00:00");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function projectNext(days: WeekDay[], n: number, dayLabel: Record<WeekDay, string>) {
  if (!days.length) return [];
  const selectedIdx = new Set(days.map((d) => DAY_IDX[d]));
  const out: string[] = [];
  for (let offset = 0; offset < 60 && out.length < n; offset++) {
    if (selectedIdx.has(offset % 7)) {
      const d = new Date(ANCHOR.getTime() + offset * 86400000);
      out.push(`${dayLabel[DAY_ORDER[d.getDay() === 0 ? 6 : d.getDay() - 1]]} ${d.getDate()} ${MONTHS[d.getMonth()]}`);
    }
  }
  return out;
}

function daysLabel(days: WeekDay[], dayLong: Record<WeekDay, string>, noDays: string, everyDay: string) {
  if (days.length === 0) return noDays;
  if (days.length === 7) return everyDay;
  return days.map((d) => dayLong[d]).join(", ");
}

export function AutomationModal({
  automation,
  onClose,
  onSaved,
}: {
  automation?: Automation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { company, data, access } = useCompany();
  const canEdit = access.canEdit;
  const t = useT();
  const editing = !!automation;

  const DAY_LABEL: Record<WeekDay, string> = {
    mon: t("Lun", "Mon"), tue: t("Mar", "Tue"), wed: t("Mer", "Wed"),
    thu: t("Jeu", "Thu"), fri: t("Ven", "Fri"), sat: t("Sam", "Sat"), sun: t("Dim", "Sun"),
  };
  const DAY_LONG: Record<WeekDay, string> = {
    mon: t("Lundi", "Monday"), tue: t("Mardi", "Tuesday"), wed: t("Mercredi", "Wednesday"),
    thu: t("Jeudi", "Thursday"), fri: t("Vendredi", "Friday"),
    sat: t("Samedi", "Saturday"), sun: t("Dimanche", "Sunday"),
  };
  const ON_EMPTY: { id: OnEmptyBehavior; label: string; disabled?: boolean; title?: string }[] = [
    { id: "pause_and_alert", label: t("Mettre en pause et m'alerter", "Pause & alert me") },
    { id: "loop", label: t("Boucle et réutiliser les publications", "Loop and reuse posts") },
    {
      id: "auto_generate",
      label: t("Générer automatiquement avec l'IA", "Auto-generate with AI"),
      disabled: true,
      title: t("La génération IA sera activée quand le backend sera connecté", "AI generation will be enabled when the backend is connected"),
    },
  ];

  const [name, setName] = useState(automation?.name ?? "");
  const [accountId, setAccountId] = useState<string>(
    automation?.socialAccountId ?? data.accounts[0]?.id ?? ""
  );
  const [days, setDays] = useState<WeekDay[]>(automation?.days ?? []);
  const [time, setTime] = useState(automation?.time ?? "09:00");
  const [library, setLibrary] = useState(automation?.libraryName ?? "");
  const [tagFilter, setTagFilter] = useState<string[]>(automation?.tagFilter ?? []);
  const [onEmpty, setOnEmpty] = useState<OnEmptyBehavior>(automation?.onEmpty ?? "pause_and_alert");
  const [activate, setActivate] = useState(automation?.enabled ?? true);

  const account = data.accounts.find((a) => a.id === accountId);

  const platformLabel = account
    ? account.platform === "facebook" ? "Facebook" : account.platform === "instagram" ? "Instagram" : "LinkedIn"
    : "";

  // When the social account changes, default the library to that account's library.
  useEffect(() => {
    if (!account) return;
    const libName = `${company.code} ${platformLabel} library`;
    if (!editing || !library) setLibrary(libName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const matchingTemplates = useMemo(() => {
    if (!account) return 0;
    return data.library.templates.filter((tpl) => {
      if (tpl.platform !== account.platform) return false;
      if (tpl.status !== "unused") return false;
      if (tagFilter.length === 0) return true;
      return tagFilter.some((tag) => tpl.tags.includes(tag));
    }).length;
  }, [data.library.templates, account, tagFilter]);

  const summary = account
    ? t(
        `Cette automatisation publiera 1 publication sur ${company.code} ${platformLabel} ` +
        `tous les ${daysLabel(days, DAY_LONG, "aucun jour pour l'instant", "chaque jour")} à ${time}, ` +
        `en puisant dans la ${tagFilter.length ? tagFilter.join(" / ") + " bibliothèque" : library || "bibliothèque"}.`,
        `This automation will publish 1 post on ${company.code} ${platformLabel} ` +
        `every ${daysLabel(days, { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" }, "no days yet", "every day")} at ${time}, pulling from the ${
          tagFilter.length ? tagFilter.join(" / ") + " library" : library || "library"
        }.`
      )
    : t("Sélectionnez un compte social pour voir le résumé.", "Pick a social account to see the summary.");

  const nextPreview = projectNext(days, 3, DAY_LABEL);

  const handleSubmit = () => {
    if (!account || !name.trim() || days.length === 0) return;
    const id = automation?.id ?? `auto-${Date.now()}`;
    const sortedDays = DAY_ORDER.filter((d) => days.includes(d));
    const platform: Platform = account.platform;
    const baseSchedule = `${sortedDays.map((d) => DAY_LABEL[d]).join(", ")} at ${time}`;
    const status: Automation["status"] = activate ? "active" : "paused";

    const next: Automation = {
      id,
      name: name.trim(),
      account: `${company.code} ${platformLabel}`,
      socialAccountId: accountId,
      platform,
      days: sortedDays,
      time,
      libraryName: library,
      tagFilter,
      onEmpty,
      schedule: baseSchedule,
      status,
      libraryNote: automation?.libraryNote ?? "",
      next: nextPreview[0],
      last: automation?.last,
      publishedCount: automation?.publishedCount ?? 0,
      lastRunAt: automation?.lastRunAt,
      pausedSince: activate ? undefined : automation?.pausedSince ?? "Paused just now",
      warning: automation?.warning,
      enabled: activate,
    };

    if (editing) updateAutomation(company.id, id, next);
    else addAutomation(company.id, next);
    onSaved();
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSubmit = !!account && !!name.trim() && days.length > 0;

  return (
    <Modal open onClose={onClose} width="max-w-xl">
      <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">
        {editing ? t("Modifier l'automatisation", "Edit automation") : t("Nouvelle automatisation", "New automation")}
      </div>

      <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
        <div>
          <label className="text-2xs font-medium text-muted">{t("Nom", "Name")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("ex. OCC Facebook — Lun/Mer/Ven conseils bien-être", "e.g. OCC Facebook — M/W/F wellness tips")}
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
          />
          <div className="mt-1 text-2xs text-muted">{t("Nom interne, non visible par les clients", "Internal name, not customer-facing")}</div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">{t("Publier sur", "Post to")}</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          >
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {company.code}{" "}
                {a.platform === "facebook" ? "Facebook" : a.platform === "instagram" ? "Instagram" : "LinkedIn"}
              </option>
            ))}
          </select>
          <div className="mt-1 text-2xs text-muted">{t("1 automatisation = 1 compte social", "One automation = one social account")}</div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">{t("Jours", "Days")}</label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {DAY_ORDER.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setDays((s) => {
                      const next = s.includes(d) ? s.filter((x) => x !== d) : [...s, d];
                      // Always keep days in Mon → Sun order.
                      return DAY_ORDER.filter((x) => next.includes(x));
                    })
                  }
                  className={`rounded-md px-2.5 py-1 text-2xs font-medium ${
                    on
                      ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30"
                      : "border-hair border-hair bg-card text-muted"
                  }`}
                >
                  {DAY_LABEL[d]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">{t("Heure", "Time")}</label>
          <div className="mt-1 w-32">
            <TimePicker value={time} onChange={setTime} />
          </div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">{t("Puiser depuis la bibliothèque", "Pull from library")}</label>
          <select
            value={library}
            onChange={(e) => setLibrary(e.target.value)}
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          >
            {account && (
              <option value={`${company.code} ${platformLabel} library`}>
                {company.code} {platformLabel} library
              </option>
            )}
          </select>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">{t("Filtre par tag (optionnel)", "Tag filter (optional)")}</label>
          <div className="mt-1">
            <TagInput tags={tagFilter} onChange={setTagFilter} placeholder={t("ex. bien-être", "e.g. wellness")} />
          </div>
          <div className="mt-1 text-2xs text-muted">
            {matchingTemplates} {matchingTemplates === 1 ? t("modèle correspond à ce filtre", "template match this filter") : t("modèles correspondent à ce filtre", "templates match this filter")}
          </div>
        </div>

        <div>
          <label className="text-2xs font-medium text-muted">{t("Quand la bibliothèque est vide", "When library is empty")}</label>
          <select
            value={onEmpty}
            onChange={(e) => setOnEmpty(e.target.value as OnEmptyBehavior)}
            className="mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
          >
            {ON_EMPTY.map((o) => (
              <option key={o.id} value={o.id} disabled={o.disabled} title={o.title}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Live summary */}
        <div className="rounded-lg border-hair border-ai-text/20 bg-ai-textbg p-3 text-xs leading-relaxed text-ai-text">
          {summary}
          {nextPreview.length > 0 && (
            <div className="mt-1 text-ink/80">
              {t("3 prochaines publications", "Next 3 posts")}: {nextPreview.join(", ")}.
            </div>
          )}
        </div>

        <label className="flex items-center justify-between rounded-md border-hair border-hair p-3">
          <div>
            <div className="text-sm font-medium text-ink">{t("Activer immédiatement ?", "Activate immediately?")}</div>
            <div className="text-2xs text-muted">{t("Sinon, l'automatisation démarre en pause.", "Otherwise the automation starts paused.")}</div>
          </div>
          <Toggle defaultOn={activate} onChange={setActivate} />
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="secondary" onClick={onClose}>{t("Annuler", "Cancel")}</Button>
        <Button variant="primary" disabled={!canSubmit || !canEdit} title={!canEdit ? t("Lecture seule", "View only") : undefined} onClick={handleSubmit}>
          {editing ? t("Enregistrer les modifications", "Save changes") : t("Créer l'automatisation", "Create automation")}
        </Button>
      </div>
    </Modal>
  );
}
