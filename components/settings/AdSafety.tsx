"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { Meter } from "@/components/ui/Meter";
import { Toast } from "@/components/ui/Toast";
import { useCompany } from "@/lib/company-context";
import { eur } from "@/lib/format";
import { SubHeader, SectionLabel, RowCard } from "./shared";
import { useT } from "@/lib/i18n";

export function AdSafety({ onNavigate }: { onNavigate: (section: string, params?: Record<string, string>) => void }) {
  const t = useT();
  const { company, data } = useCompany();
  const s = data.adSafety;

  const [readOnlyMode, setReadOnlyMode] = useState<boolean>(data.meta?.readOnly ?? true);
  const [monthlyCap, setMonthlyCap] = useState<number>(s.monthlyCap);
  const [requireBudget, setRequireBudget] = useState<boolean>(s.requireBudgetCap);
  const [confirmAi, setConfirmAi] = useState<boolean>(s.confirmAiSpend);
  const [doubleConfirm, setDoubleConfirm] = useState<number>(s.doubleConfirmThreshold);
  const [dailyDigest, setDailyDigest] = useState<boolean>(s.dailyDigest);

  const [dirty, setDirty] = useState(false);
  const [warnLowerCap, setWarnLowerCap] = useState(false);
  const [warnConfirmOff, setWarnConfirmOff] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const usedPct = useMemo(
    () => (monthlyCap > 0 ? Math.round((s.usedThisMonth / monthlyCap) * 100) : 0),
    [s.usedThisMonth, monthlyCap]
  );

  const safetyExpiry = useMemo(() => {
    if (!data.meta?.connectedAt) return null;
    const d = new Date(`${data.meta.connectedAt}T00:00:00`);
    d.setDate(d.getDate() + 7);
    return d;
  }, [data.meta?.connectedAt]);

  const mark = () => setDirty(true);

  const save = () => {
    setDirty(false);
    setToast(t("Paramètres de sécurité publicitaire enregistrés.", "Ad safety settings saved."));
  };

  const attemptSetCap = (v: number) => {
    if (v < s.usedThisMonth) {
      setWarnLowerCap(true);
      return;
    }
    setMonthlyCap(v);
    mark();
  };

  const attemptToggleConfirmAi = (on: boolean) => {
    if (!on) {
      setWarnConfirmOff(true);
      return;
    }
    setConfirmAi(true);
    mark();
  };

  return (
    <div>
      <SubHeader title={t("Sécurité publicitaire", "Ad Safety")} scope="company" scopeLabel={company.name} />

      <div className="mb-4 rounded-md border-hair border-ai-text/20 bg-ai-textbg px-3 py-2 text-2xs text-ai-text">
        {t(
          `Ces paramètres protègent contre les dépenses publicitaires non intentionnelles. Nous recommandons de conserver les valeurs par défaut. Les limites s'appliquent à toutes les campagnes de ${company.code}.`,
          `These settings protect against unintended ad spend. We recommend keeping the defaults. Limits apply across all of ${company.code}'s campaigns.`
        )}
      </div>

      <SectionLabel>{t("Mode de connexion", "Connection mode")}</SectionLabel>
      <div className="rounded-md border-hair border-hair p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-ink">{t("Mode lecture seule", "Read-only mode")}</div>
            <div className="text-2xs text-muted">
              {t(
                "Activé automatiquement pendant 7 jours après chaque nouvelle connexion Meta. Actuellement :",
                "Auto-enabled for 7 days after each new Meta connection. Currently:"
              )}{" "}
              {readOnlyMode ? t("lecture seule", "read-only") : t("contrôle total", "full control")}
              {safetyExpiry && readOnlyMode && (
                <> {t("jusqu'au", "until")} {format(safetyExpiry, "d MMM yyyy")}</>
              )}
              .
            </div>
          </div>
          <Toggle
            key={String(readOnlyMode)}
            defaultOn={readOnlyMode}
            onChange={(on) => { setReadOnlyMode(on); mark(); }}
          />
        </div>
      </div>

      <SectionLabel>{t("Plafonds de dépenses", "Spend caps")}</SectionLabel>
      <div className="mb-3 rounded-md border-hair border-hair p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-ink">{t("Plafond mensuel de dépenses", "Monthly spend cap")}</div>
            <div className="text-2xs text-muted">
              {t(
                `Plafond absolu sur toutes les campagnes ${company.code}. Les nouvelles campagnes sont bloquées une fois atteint ; les actives sont mises en pause.`,
                `Hard ceiling across all ${company.code} campaigns. New campaigns blocked once reached; active ones pause.`
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">EUR</span>
            <input
              type="number"
              value={monthlyCap}
              onChange={(e) => attemptSetCap(Number(e.target.value))}
              className="w-24 rounded-md border-hair border-hair bg-card px-2 py-1 text-right text-ink focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-2xs text-muted">
            <span>{t("Utilisé ce mois", "Used this month")}</span>
            <span>{eur(s.usedThisMonth)} / {monthlyCap.toLocaleString()} ({usedPct}%)</span>
          </div>
          <Meter value={s.usedThisMonth} max={monthlyCap} />
        </div>
      </div>
      <RowCard
        title={t("Exiger un plafond budgétaire sur chaque campagne", "Require budget cap on every campaign")}
        desc={t("Aucune campagne ne peut être créée sans plafond budgétaire.", "No campaign can be created without a budget cap.")}
        control={<Toggle key={String(requireBudget)} defaultOn={requireBudget} onChange={(v) => { setRequireBudget(v); mark(); }} />}
      />

      <SectionLabel>{t("Validations d'approbation", "Approval gates")}</SectionLabel>
      <RowCard
        title={t("Confirmer les dépenses avant les actions IA", "Confirm spend before AI actions")}
        desc={t("Les actions IA impliquant de l'argent nécessitent une confirmation explicite. L'IA ne dépense jamais automatiquement.", "AI-suggested actions involving money require explicit confirmation. AI never auto-spends.")}
        control={<Toggle key={String(confirmAi)} defaultOn={confirmAi} onChange={attemptToggleConfirmAi} />}
      />
      <RowCard
        title={t("Double confirmation au-dessus du seuil", "Double confirmation above threshold")}
        desc={t("Les changements de budget supérieurs à ce montant journalier nécessitent une seconde confirmation.", "Budget changes above this daily amount require a second confirmation.")}
        control={
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">EUR</span>
            <input
              type="number"
              value={doubleConfirm}
              onChange={(e) => { setDoubleConfirm(Number(e.target.value)); mark(); }}
              className="w-20 rounded-md border-hair border-hair bg-card px-2 py-1 text-right text-ink focus:outline-none"
            />
            <span className="text-2xs text-muted">/ {t("jour", "day")}</span>
          </div>
        }
      />

      <SectionLabel>{t("Alertes & audit", "Alerts & audit")}</SectionLabel>
      <RowCard
        title={t("Récapitulatif quotidien + pause automatique sur anomalie", "Daily spend digest + anomaly auto-pause")}
        desc={t("Email matinal des dépenses de la veille. Pause automatique si une campagne dépasse de 50 % sa moyenne sur 7 jours.", "Morning email of yesterday's spend. Auto-pause if a campaign exceeds its 7-day average by 50%.")}
        control={<Toggle key={String(dailyDigest)} defaultOn={dailyDigest} onChange={(v) => { setDailyDigest(v); mark(); }} />}
      />
      <div className="rounded-md border-hair border-hair p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-ink">{t("Journal d'audit (toujours actif)", "Audit log (always on)")}</div>
            <div className="text-2xs text-muted">{t("Chaque modification publicitaire est journalisée avec qui/quand/quoi. Ne peut pas être désactivé.", "Every ad change logged with who/when/what. Cannot be disabled.")}</div>
          </div>
          <Button variant="secondary" className="py-1 text-2xs" onClick={() => onNavigate("audit", { filter: "ad_safety" })}>
            {t("Voir le journal d'audit", "View audit log")}
          </Button>
        </div>
        <div className="mt-2 rounded bg-canvas px-2 py-1.5 text-2xs text-muted">
          {t("Récent :", "Recent:")} {s.recentAudit}
        </div>
      </div>

      {dirty && (
        <div className="sticky bottom-0 mt-4 flex items-center justify-end gap-3 border-t-hair border-hair bg-card py-3">
          <span className="text-2xs text-amber-700">● {t("Modifications non enregistrées", "Unsaved changes")}</span>
          <Button variant="primary" onClick={save}>{t("Enregistrer", "Save changes")}</Button>
        </div>
      )}

      {warnLowerCap && (
        <Modal open onClose={() => setWarnLowerCap(false)} width="max-w-sm">
          <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">{t("Abaisser le plafond mensuel ?", "Lower monthly cap?")}</div>
          <div className="p-4 text-sm text-ink">
            {t(
              `Les dépenses du mois en cours (${eur(s.usedThisMonth)}) dépassent ce plafond. Le définir maintenant bloquera les nouvelles campagnes et mettra en pause les actives. Continuer ?`,
              `Current month's spend (${eur(s.usedThisMonth)}) exceeds this cap. Setting it now will block new campaigns and pause active ones. Continue?`
            )}
          </div>
          <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
            <Button variant="secondary" onClick={() => setWarnLowerCap(false)}>{t("Annuler", "Cancel")}</Button>
            <Button
              variant="danger"
              onClick={() => {
                setMonthlyCap(Math.max(0, s.usedThisMonth - 1));
                mark();
                setWarnLowerCap(false);
              }}
            >
              {t("Appliquer le plafond réduit", "Apply lower cap")}
            </Button>
          </div>
        </Modal>
      )}

      {warnConfirmOff && (
        <Modal open onClose={() => setWarnConfirmOff(false)} width="max-w-sm">
          <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">{t("Désactiver la confirmation de dépense IA ?", "Disable AI spend confirmation?")}</div>
          <div className="p-4 text-sm text-ink">
            {t(
              "Désactiver cette option permet aux actions IA de dépenser de l'argent sans confirmation explicite. Nous recommandons vivement de la maintenir activée. Continuer ?",
              "Turning this off allows AI actions to spend money without explicit confirmation. We strongly recommend keeping it on. Continue?"
            )}
          </div>
          <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
            <Button variant="secondary" onClick={() => setWarnConfirmOff(false)}>{t("Annuler", "Cancel")}</Button>
            <Button
              variant="danger"
              onClick={() => { setConfirmAi(false); mark(); setWarnConfirmOff(false); }}
            >
              {t("Désactiver quand même", "Disable anyway")}
            </Button>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
