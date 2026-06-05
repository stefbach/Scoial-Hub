"use client";

// Panneau « Comptes publicitaires Meta » : liste les comptes pub réellement
// présents sur le compte Meta connecté, permet d'en choisir un, et affiche ses
// VRAIES campagnes (dépense / impressions / clics, Marketing API). Réutilisé
// dans la section Publicité (Campagnes, Performance Ads).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { Spinner } from "@/components/ui/Spinner";

interface AdAccount { id: string; name: string; currency: string; active: boolean; amountSpent: number; }
interface AdCampaignRow { name: string; status: string; objective: string; spend: number; impressions: number; clicks: number; currency: string; }
interface AccountData { account?: { id: string; name: string; currency: string; amountSpent: number }; campaigns: AdCampaignRow[]; }
interface Resp { accounts: AdAccount[]; selectedId: string | null; data: AccountData | null; needsReconnect: boolean; }

const nf = (n: number) => n.toLocaleString("fr-FR");

export function MetaAdAccountsPanel({ showCampaigns = true }: { showCampaigns?: boolean }) {
  const t = useT();
  const { company } = useCompany();
  const companyId = company.id;

  const [resp, setResp] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/meta/adaccounts?companyId=${encodeURIComponent(companyId)}`);
      setResp(r.ok ? await r.json() : null);
    } catch {
      setResp(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function select(id: string) {
    setSelecting(id);
    try {
      const r = await fetch("/api/meta/adaccounts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, adAccountId: id }),
      });
      if (r.ok) await load();
    } finally {
      setSelecting(null);
    }
  }

  if (loading) {
    return (
      <div className="card flex items-center gap-2 p-5 text-sm text-muted">
        <Spinner size={16} className="text-primary-600" />
        {t("Chargement des comptes Meta…", "Loading Meta accounts…")}
      </div>
    );
  }

  if (!resp || resp.needsReconnect || resp.accounts.length === 0) {
    return (
      <div className="card p-5">
        <p className="text-sm font-semibold text-ink">{t("Comptes publicitaires Meta", "Meta ad accounts")}</p>
        <p className="mt-1 text-sm text-muted">
          {resp?.needsReconnect
            ? t("Reconnectez Meta pour accéder à vos comptes publicitaires.", "Reconnect Meta to access your ad accounts.")
            : t("Aucun compte publicitaire détecté sur votre compte Meta.", "No ad account found on your Meta account.")}
        </p>
        <Link href="/pages-meta" className="btn-primary mt-3 inline-flex text-sm">{t("Gérer la connexion Meta", "Manage Meta connection")}</Link>
      </div>
    );
  }

  const selected = resp.selectedId;
  const data = resp.data;

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-hair bg-canvas px-5 py-3">
        <span className="section-label text-primary-500">{t("Comptes publicitaires Meta", "Meta ad accounts")}</span>
        <p className="mt-0.5 text-2xs text-muted">{t("Choisissez le compte à piloter — données réelles via Marketing API.", "Pick the account to manage — real data via Marketing API.")}</p>
      </div>

      {/* Sélecteur de comptes */}
      <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {resp.accounts.map((a) => {
          const isSel = a.id === selected;
          return (
            <button
              key={a.id}
              onClick={() => !isSel && select(a.id)}
              disabled={selecting === a.id}
              className={`rounded-xl border p-3 text-left transition-all ${isSel ? "border-primary-400 bg-primary-50 ring-2 ring-primary-200" : "border-hair hover:border-primary-200"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-ink">{a.name || `act_${a.id}`}</span>
                {a.active ? (
                  <span className="shrink-0 rounded-full bg-success-50 px-2 py-0.5 text-2xs font-semibold text-success-700">{t("actif", "active")}</span>
                ) : (
                  <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-2xs text-muted ring-1 ring-hair">{t("inactif", "inactive")}</span>
                )}
              </div>
              <p className="mt-1 text-2xs text-muted">
                act_{a.id} · {a.currency} · {t("dépensé", "spent")} {nf(a.amountSpent / 100)} {a.currency}
              </p>
              {isSel ? (
                <span className="mt-1 inline-block text-2xs font-semibold text-primary-700">{t("Sélectionné ✓", "Selected ✓")}</span>
              ) : selecting === a.id ? (
                <span className="mt-1 inline-flex items-center gap-1.5 text-2xs text-muted">
                  <Spinner size={12} className="text-primary-600" />
                  {t("Sélection…", "Selecting…")}
                </span>
              ) : (
                <span className="mt-1 inline-block text-2xs text-muted">{t("Utiliser ce compte", "Use this account")}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Campagnes réelles du compte sélectionné */}
      {showCampaigns && selected && (
        <div className="border-t border-hair p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="section-label">{t("Campagnes du compte", "Account campaigns")}</span>
            {data?.account && <span className="text-2xs text-muted">{data.account.name}</span>}
          </div>
          {data && data.campaigns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-hair text-2xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-semibold">{t("Campagne", "Campaign")}</th>
                    <th className="py-2 pr-3 font-semibold">{t("Statut", "Status")}</th>
                    <th className="py-2 pr-3 text-right font-semibold">{t("Dépense", "Spend")}</th>
                    <th className="py-2 pr-3 text-right font-semibold">Impr.</th>
                    <th className="py-2 text-right font-semibold">{t("Clics", "Clicks")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.map((c, i) => (
                    <tr key={i} className="border-b border-hair/60">
                      <td className="py-2 pr-3 font-medium text-ink">{c.name}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${c.status === "ACTIVE" ? "bg-success-50 text-success-700" : "bg-canvas text-muted ring-1 ring-hair"}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right text-ink">{nf(c.spend)} {c.currency}</td>
                      <td className="py-2 pr-3 text-right text-muted">{nf(c.impressions)}</td>
                      <td className="py-2 text-right text-muted">{nf(c.clicks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg bg-canvas px-3 py-2.5 text-xs text-muted">
              {t("Aucune campagne sur ce compte (ou aucune dépense récente).", "No campaign on this account (or no recent spend).")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
