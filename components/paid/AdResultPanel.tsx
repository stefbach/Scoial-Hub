"use client";

// Panneau « Résultat + activation » de la création de pub Meta — purement
// présentationnel : affiche la pub créée (en pause), permet de l'activer, d'ouvrir
// le Gestionnaire de pubs et de récupérer les prospects. Extrait de
// app/(paid)/campaigns/new pour alléger la page (cf. audit / CLAUDE.md).

import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";

export interface AdPublishResult {
  campaignId: string;
  adSetId: string;
  adIds?: string[];
  leadFormId?: string;
}
export interface AdLead { createdTime: string; fields: Record<string, string> }

export function AdResultPanel({
  result,
  isLive,
  adAccountId,
  activating,
  onActivate,
  loadingLeads,
  onFetchLeads,
  liveMsg,
  leads,
}: {
  result: AdPublishResult;
  isLive: boolean;
  adAccountId?: string;
  activating: boolean;
  onActivate: () => void;
  loadingLeads: boolean;
  onFetchLeads: (formId: string) => void;
  liveMsg: string | null;
  leads: AdLead[] | null;
}) {
  const t = useT();
  return (
    <section className="card mt-5 border-l-4 border-success-400 p-5">
      <div className="flex items-center gap-2">
        <span className="section-label text-success-700">{t("Publicité créée sur Meta", "Ad created on Meta")}</span>
        <span className="rounded-full bg-canvas px-2 py-0.5 text-2xs font-semibold text-muted ring-1 ring-hair">{isLive ? "ACTIVE" : "PAUSED"}</span>
      </div>
      <p className="mt-2 text-sm text-ink">
        {t(
          "Elle est en pause sur votre compte Meta — aucune dépense pour l'instant. Vous pouvez l'activer ici ou depuis le Gestionnaire de publicités.",
          "It is paused on your Meta account — no spend yet. You can activate it here or from Ads Manager."
        )}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-2xs text-muted sm:grid-cols-4">
        <span>Campaign: {result.campaignId}</span>
        <span>Ad set: {result.adSetId}</span>
        <span>{t("Annonces", "Ads")}: {result.adIds?.length ?? 1}</span>
        {result.leadFormId && <span>{t("Formulaire", "Form")}: {result.leadFormId}</span>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={onActivate} disabled={activating || isLive} className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-50">
          {activating && <Spinner size={14} className="text-white" />}
          {isLive ? t("En ligne ✓", "Live ✓") : activating ? t("Activation…", "Activating…") : t("Activer (dépense réelle)", "Activate (real spend)")}
        </button>
        <a
          href={adAccountId ? `https://business.facebook.com/adsmanager/manage/campaigns?act=${adAccountId}` : "https://www.facebook.com/adsmanager"}
          target="_blank" rel="noreferrer" className="btn-secondary text-sm"
        >
          {t("Ouvrir le Gestionnaire de pubs", "Open Ads Manager")}
        </a>
        <Link href="/ad-performance" className="text-xs text-primary-600 hover:underline">{t("Voir la performance →", "View performance →")}</Link>
        {result.leadFormId && (
          <button onClick={() => onFetchLeads(result.leadFormId!)} disabled={loadingLeads} className="btn-secondary inline-flex items-center gap-1.5 text-sm disabled:opacity-50">
            {loadingLeads && <Spinner size={14} className="text-current" />}
            {t("Voir les prospects", "View leads")}
          </button>
        )}
      </div>
      {liveMsg && <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-xs text-ink">{liveMsg}</p>}

      {/* Prospects récupérés du formulaire */}
      {leads && (
        <div className="mt-4 border-t border-hair pt-3">
          <span className="section-label">{t("Prospects reçus", "Leads received")} ({leads.length})</span>
          {leads.length === 0 ? (
            <p className="mt-1 text-2xs text-muted">{t("Aucun prospect pour l'instant (le formulaire doit être actif et avoir reçu des soumissions). La récupération exige la permission « leads_retrieval » sur la Page.", "No leads yet (the form must be active and have submissions). Retrieval requires the Page 'leads_retrieval' permission.")}</p>
          ) : (
            <div className="mt-2 space-y-2">
              {leads.slice(0, 20).map((ld, i) => (
                <div key={i} className="rounded-lg border border-hair bg-canvas p-2 text-xs">
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                    {Object.entries(ld.fields).map(([k, v]) => (
                      <span key={k} className="text-ink"><span className="text-muted">{k}:</span> {v}</span>
                    ))}
                  </div>
                  {ld.createdTime && <span className="text-2xs text-muted">{new Date(ld.createdTime).toLocaleString("fr-FR")}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
