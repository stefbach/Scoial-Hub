"use client";

// ── Publicité Meta (réel) ─────────────────────────────────────────────────────
// Gestion directe des publicités Meta : compte publicitaire + campagnes réelles,
// création d'une publicité (créée EN PAUSE, aucune dépense) puis activation
// explicite (= dépense réelle). Toutes les données viennent des API /api/meta/*.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { Spinner, BusyHint } from "@/components/ui/Spinner";

// ── Types des contrats API ────────────────────────────────────────────────────
interface AdAccount {
  id: string;
  name: string;
  currency: string;
  active: boolean;
  amountSpent: number; // unités mineures (centimes)
}
interface AdCampaign {
  name: string;
  status: string;
  objective: string;
  spend: number; // unités mineures (centimes)
  impressions: number;
  clicks: number;
  currency: string;
}
interface AdAccountsData {
  account?: { id: string; name: string; currency: string; amountSpent: number };
  campaigns: AdCampaign[];
}
interface AdAccountsResp {
  accounts: AdAccount[];
  selectedId: string | null;
  data: AdAccountsData | null;
  needsReconnect: boolean;
}
interface LibTemplate {
  id: string;
  media?: { kind?: string; url?: string; ready?: boolean };
  body?: string;
  platform?: string;
}
interface PublishIds {
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
  status: string;
}

const OBJECTIVES: { fr: string; en: string; value: string }[] = [
  { fr: "Notoriété", en: "Awareness", value: "notoriété" },
  { fr: "Trafic", en: "Traffic", value: "trafic" },
  { fr: "Engagement", en: "Engagement", value: "engagement" },
  { fr: "Leads", en: "Leads", value: "leads" },
  { fr: "Ventes", en: "Sales", value: "ventes" },
];
const CTAS = ["LEARN_MORE", "SHOP_NOW", "SIGN_UP", "CONTACT_US", "BOOK_TRAVEL"];

const money = (minor: number, currency: string) => {
  const v = (minor || 0) / 100;
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency || "EUR" }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency || ""}`.trim();
  }
};
const nf = (n: number) => (n || 0).toLocaleString("fr-FR");

function statusTone(status: string): string {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE") return "bg-success-50 text-success-700 ring-success-500/30";
  if (s === "PAUSED") return "bg-warning-50 text-warning-700 ring-warning-500/30";
  return "bg-canvas text-muted ring-hair";
}

export default function MetaAdsPublisher() {
  const t = useT();
  const { company } = useCompany();
  const companyId = company.id;

  // ── Compte publicitaire / campagnes ─────────────────────────────────────────
  const [resp, setResp] = useState<AdAccountsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // ── Visuels (bibliothèque) ──────────────────────────────────────────────────
  const [visuals, setVisuals] = useState<LibTemplate[]>([]);

  // ── Formulaire de création ──────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [objective, setObjective] = useState(OBJECTIVES[0].value);
  const [budgetEuros, setBudgetEuros] = useState(10);
  const [countries, setCountries] = useState<string[]>(["FR"]);
  const [countryDraft, setCountryDraft] = useState("");
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [imageUrl, setImageUrl] = useState("");
  const [primaryText, setPrimaryText] = useState("");
  const [headline, setHeadline] = useState("");
  const [link, setLink] = useState("");
  const [cta, setCta] = useState(CTAS[0]);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [created, setCreated] = useState<PublishIds | null>(null);

  // ── Activation ──────────────────────────────────────────────────────────────
  const [confirming, setConfirming] = useState(false);
  const [activating, setActivating] = useState(false);
  const [live, setLive] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/meta/adaccounts?companyId=${encodeURIComponent(companyId)}`);
      const data = r.ok ? ((await r.json()) as AdAccountsResp) : null;
      setResp(data);
    } catch {
      setResp(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/company-data?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        const tpls: LibTemplate[] = d?.library?.templates ?? [];
        setVisuals(tpls.filter((tpl) => tpl?.media?.url));
      })
      .catch(() => {
        /* dégradation : pas de visuels pré-remplis */
      });
    return () => {
      alive = false;
    };
  }, [companyId]);

  async function selectAccount(adAccountId: string) {
    setSwitching(true);
    setAccountError(null);
    try {
      const res = await fetch("/api/meta/adaccounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, adAccountId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setAccountError(
          data?.error ||
            t(
              `Impossible de changer de compte publicitaire (erreur ${res.status}).`,
              `Could not switch ad account (error ${res.status}).`
            )
        );
        return;
      }
      await loadAccounts();
    } catch (e) {
      setAccountError(
        e instanceof Error
          ? e.message
          : t("Impossible de changer de compte publicitaire.", "Could not switch ad account.")
      );
    } finally {
      setSwitching(false);
    }
  }

  function addCountry(raw: string) {
    const code = raw.trim().toUpperCase().slice(0, 2);
    if (!code) return;
    setCountries((prev) => (prev.includes(code) ? prev : [...prev, code]));
    setCountryDraft("");
  }
  function removeCountry(code: string) {
    setCountries((prev) => prev.filter((c) => c !== code));
  }

  const canPublish =
    name.trim() && primaryText.trim() && link.trim() && imageUrl.trim() && budgetEuros >= 1 && countries.length > 0;

  async function publish() {
    setPublishError(null);
    setPublishing(true);
    try {
      const res = await fetch("/api/meta/ads/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          name: name.trim(),
          objective,
          dailyBudgetCents: Math.round(budgetEuros * 100),
          countries,
          ageMin,
          ageMax,
          imageUrl: imageUrl.trim(),
          primaryText: primaryText.trim(),
          headline: headline.trim() || undefined,
          link: link.trim(),
          cta,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        setPublishError(data?.error || `Erreur ${res.status}`);
        return;
      }
      setCreated({
        campaignId: data.campaignId,
        adSetId: data.adSetId,
        creativeId: data.creativeId,
        adId: data.adId,
        status: data.status,
      });
      setLive(false);
      setConfirming(false);
      setActivateError(null);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : t("Création impossible.", "Could not create the ad."));
    } finally {
      setPublishing(false);
    }
  }

  async function setActivation(makeLive: boolean) {
    if (!created) return;
    setActivateError(null);
    setActivating(true);
    try {
      const res = await fetch("/api/meta/ads/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          campaignId: created.campaignId,
          adSetId: created.adSetId,
          adId: created.adId,
          live: makeLive,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        setActivateError(data?.error || `Erreur ${res.status}`);
        return;
      }
      setLive(Boolean(data.live));
      setConfirming(false);
    } catch (e) {
      setActivateError(e instanceof Error ? e.message : t("Action impossible.", "Action failed."));
    } finally {
      setActivating(false);
    }
  }

  const acc = resp?.data?.account;
  const campaigns = resp?.data?.campaigns ?? [];

  return (
    <section className="space-y-4">
      <header>
        <p className="section-label text-primary-500">{t("Publicité Meta (réel)", "Meta Ads (live)")}</p>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          {t(
            "Créez une publicité Meta directement ici. Elle est d'abord créée EN PAUSE (aucune dépense), puis vous l'activez explicitement.",
            "Create a Meta ad directly here. It is first created PAUSED (no spend), then you activate it explicitly."
          )}
        </p>
      </header>

      {/* ════════ 1) Compte publicitaire ════════ */}
      <div className="card p-5">
        <div className="section-label">{t("Compte publicitaire", "Ad account")}</div>

        {loading ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted">
            <Spinner size={16} className="text-primary-600" />
            {t("Chargement…", "Loading…")}
          </div>
        ) : resp?.needsReconnect || !resp ? (
          <div className="mt-3 rounded-xl border border-warning-500/30 bg-warning-50 p-4">
            <p className="text-sm font-semibold text-warning-700">
              {t("Connexion Meta requise", "Meta connection required")}
            </p>
            <p className="mt-1 text-xs text-warning-600">
              {t(
                "Reconnectez votre compte Meta pour gérer vos comptes publicitaires.",
                "Reconnect your Meta account to manage your ad accounts."
              )}
            </p>
            <Link href="/demarrage" className="btn-primary mt-3 inline-flex text-sm">
              {t("Connecter Meta", "Connect Meta")}
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <div className="min-w-0">
                <p className="text-2xs text-muted">{t("Compte sélectionné", "Selected account")}</p>
                <p className="truncate text-base font-bold text-ink">
                  {acc?.name ?? t("Aucun compte sélectionné", "No account selected")}
                </p>
                {acc && (
                  <p className="mt-0.5 text-xs text-muted">
                    {acc.currency} · {t("Dépense totale", "Total spent")}: {money(acc.amountSpent, acc.currency)}
                  </p>
                )}
              </div>
              {resp.accounts.length > 0 && (
                <label className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-2xs text-muted">
                    {t("Changer de compte", "Switch account")}
                    {switching && <Spinner size={12} className="text-primary-600" />}
                  </span>
                  <select
                    value={resp.selectedId ?? ""}
                    onChange={(e) => selectAccount(e.target.value)}
                    disabled={switching}
                    className="mt-1 w-full rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink disabled:opacity-50"
                  >
                    <option value="" disabled>
                      {t("Sélectionner…", "Select…")}
                    </option>
                    {resp.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.currency})
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {accountError && (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-danger-500/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
              >
                {accountError}
              </div>
            )}

            {/* Campagnes réelles */}
            <div className="mt-5">
              <div className="text-2xs font-semibold uppercase tracking-wide text-muted">
                {t("Campagnes réelles", "Live campaigns")}
              </div>
              {campaigns.length === 0 ? (
                <p className="mt-2 rounded-lg border border-dashed border-hair bg-canvas px-3 py-4 text-center text-xs text-muted">
                  {t("Aucune campagne sur ce compte pour l'instant.", "No campaigns on this account yet.")}
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-hair text-2xs uppercase tracking-wide text-muted">
                        <th className="py-2 pr-3 font-semibold">{t("Nom", "Name")}</th>
                        <th className="py-2 pr-3 font-semibold">{t("Statut", "Status")}</th>
                        <th className="py-2 pr-3 font-semibold">{t("Objectif", "Objective")}</th>
                        <th className="py-2 pr-3 text-right font-semibold">{t("Dépense", "Spend")}</th>
                        <th className="py-2 text-right font-semibold">{t("Impressions", "Impressions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((c, i) => (
                        <tr key={`${c.name}-${i}`} className="border-b border-hair/60">
                          <td className="max-w-[180px] truncate py-2 pr-3 font-medium text-ink">{c.name}</td>
                          <td className="py-2 pr-3">
                            <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold uppercase ring-1 ${statusTone(c.status)}`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-muted">{c.objective}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-ink">{money(c.spend, c.currency)}</td>
                          <td className="py-2 text-right tabular-nums text-muted">{nf(c.impressions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ════════ 2) Créer une publicité ════════ */}
      <div className="card p-5">
        <div className="section-label">{t("Créer une publicité", "Create an ad")}</div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Objectif */}
          <label className="block">
            <span className="block text-2xs font-semibold uppercase tracking-wide text-muted">
              {t("Objectif", "Objective")}
            </span>
            <select
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="mt-1 w-full rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink"
            >
              {OBJECTIVES.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.fr, o.en)}
                </option>
              ))}
            </select>
          </label>

          {/* Budget */}
          <label className="block">
            <span className="block text-2xs font-semibold uppercase tracking-wide text-muted">
              {t("Budget quotidien (€)", "Daily budget (€)")}
            </span>
            <input
              type="number"
              min={1}
              value={budgetEuros}
              onChange={(e) => setBudgetEuros(Math.max(1, Number(e.target.value) || 0))}
              className="mt-1 w-full rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink"
            />
          </label>
        </div>

        {/* Pays (chips) */}
        <div className="mt-4">
          <span className="block text-2xs font-semibold uppercase tracking-wide text-muted">{t("Pays", "Countries")}</span>
          <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-hair bg-card px-2.5 py-2">
            {countries.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-2xs font-semibold text-primary-700"
              >
                {c}
                <button
                  type="button"
                  onClick={() => removeCountry(c)}
                  aria-label={t("Retirer", "Remove")}
                  className="text-primary-500 hover:text-primary-700"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </span>
            ))}
            <input
              value={countryDraft}
              onChange={(e) => setCountryDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addCountry(countryDraft);
                }
              }}
              onBlur={() => countryDraft && addCountry(countryDraft)}
              placeholder={t("ex. BE, CH…", "e.g. BE, CH…")}
              className="min-w-[90px] flex-1 bg-transparent px-1 py-0.5 text-sm text-ink outline-none placeholder:text-muted"
            />
          </div>
        </div>

        {/* Âge */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-2xs font-semibold uppercase tracking-wide text-muted">{t("Âge min", "Min age")}</span>
            <input
              type="number"
              min={13}
              max={65}
              value={ageMin}
              onChange={(e) => setAgeMin(Number(e.target.value) || 18)}
              className="mt-1 w-full rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="block">
            <span className="block text-2xs font-semibold uppercase tracking-wide text-muted">{t("Âge max", "Max age")}</span>
            <input
              type="number"
              min={13}
              max={65}
              value={ageMax}
              onChange={(e) => setAgeMax(Number(e.target.value) || 65)}
              className="mt-1 w-full rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink"
            />
          </label>
        </div>

        {/* Visuel */}
        <div className="mt-4">
          <span className="block text-2xs font-semibold uppercase tracking-wide text-muted">{t("Visuel", "Visual")}</span>
          {visuals.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {visuals.map((v) => {
                const url = v.media!.url!;
                const selected = imageUrl === url;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setImageUrl(url)}
                    className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                      selected ? "border-primary-500 ring-2 ring-primary-200" : "border-hair hover:border-primary-200"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {selected && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-white">
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2 6.5l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder={t("…ou collez une URL d'image", "…or paste an image URL")}
            className="mt-2 w-full rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink"
          />
        </div>

        {/* Texte principal */}
        <label className="mt-4 block">
          <span className="block text-2xs font-semibold uppercase tracking-wide text-muted">
            {t("Texte principal", "Primary text")} *
          </span>
          <textarea
            value={primaryText}
            onChange={(e) => setPrimaryText(e.target.value)}
            rows={3}
            required
            className="mt-1 w-full rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink"
            placeholder={t("Le message principal de votre publicité…", "The main message of your ad…")}
          />
        </label>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Headline */}
          <label className="block">
            <span className="block text-2xs font-semibold uppercase tracking-wide text-muted">{t("Titre", "Headline")}</span>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="mt-1 w-full rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink"
            />
          </label>
          {/* CTA */}
          <label className="block">
            <span className="block text-2xs font-semibold uppercase tracking-wide text-muted">{t("Bouton (CTA)", "Button (CTA)")}</span>
            <select
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              className="mt-1 w-full rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink"
            >
              {CTAS.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Lien */}
        <label className="mt-4 block">
          <span className="block text-2xs font-semibold uppercase tracking-wide text-muted">
            {t("Lien de destination", "Destination link")} *
          </span>
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            required
            placeholder="https://…"
            className="mt-1 w-full rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink"
          />
        </label>

        {/* Nom de la pub */}
        <label className="mt-4 block">
          <span className="block text-2xs font-semibold uppercase tracking-wide text-muted">
            {t("Nom de la pub", "Ad name")} *
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink"
          />
        </label>

        {publishError && (
          <div className="mt-4 rounded-lg border border-danger-500/30 bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
            {publishError}
          </div>
        )}

        <button
          type="button"
          onClick={publish}
          disabled={publishing || !canPublish}
          className="btn-primary mt-4 inline-flex items-center gap-2 disabled:opacity-50"
        >
          {publishing ? (
            <>
              <Spinner size={16} className="text-white" />
              {t("Création…", "Creating…")}
            </>
          ) : (
            t("Créer la publicité (en pause)", "Create the ad (paused)")
          )}
        </button>

        {publishing && (
          <div className="mt-3">
            <BusyHint label={t("Création de votre publicité (en pause)…", "Creating your ad (paused)…")} eta={t("~10–20 s", "~10–20 s")} />
          </div>
        )}

        {created && (
          <div className="mt-4 rounded-xl border border-success-500/30 bg-success-50 p-4 animate-fade-in">
            <p className="text-sm font-bold text-success-700">
              {t("Publicité créée — EN PAUSE (aucune dépense)", "Ad created — PAUSED (no spend)")}
            </p>
            <p className="mt-1 break-all text-2xs text-success-600">
              campaign {created.campaignId} · adSet {created.adSetId} · ad {created.adId}
            </p>
          </div>
        )}
      </div>

      {/* ════════ 3) Activation ════════ */}
      {created && (
        <div className="card p-5 animate-fade-in">
          <div className="section-label">{t("Activation", "Activation")}</div>

          {live ? (
            <div className="mt-3 rounded-xl border border-success-500/30 bg-success-50 p-4">
              <p className="text-sm font-bold text-success-700">🟢 {t("En diffusion", "Live")}</p>
              <p className="mt-1 text-xs text-success-600">
                {t(
                  `Votre publicité dépense actuellement (budget ${budgetEuros} €/j).`,
                  `Your ad is currently spending (budget €${budgetEuros}/day).`
                )}
              </p>
              <button
                type="button"
                onClick={() => setActivation(false)}
                disabled={activating}
                className="btn-secondary mt-3 inline-flex items-center gap-2 disabled:opacity-50"
              >
                {activating ? <Spinner size={16} className="text-primary-600" /> : null}
                {t("Mettre en pause", "Pause")}
              </button>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-danger-500/30 bg-danger-50 p-4">
              <p className="text-sm font-bold text-danger-700">
                ⚠️ {t(`Activer = dépense réelle (budget ${budgetEuros} €/j)`, `Activate = real spend (budget €${budgetEuros}/day)`)}
              </p>
              <p className="mt-1 text-xs text-danger-600">
                {t(
                  "Une fois activée, la publicité commencera à dépenser votre budget quotidien sur Meta.",
                  "Once activated, the ad will start spending your daily budget on Meta."
                )}
              </p>

              {activateError && (
                <div className="mt-3 rounded-lg border border-danger-500/30 bg-danger-100 px-3 py-2 text-sm text-danger-700">
                  {activateError}
                </div>
              )}

              {confirming ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-danger-700">
                    {t("Confirmer la diffusion réelle ?", "Confirm real spend?")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivation(true)}
                    disabled={activating}
                    className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {activating ? <Spinner size={16} className="text-white" /> : null}
                    {t("Oui, activer", "Yes, activate")}
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} disabled={activating} className="btn-ghost">
                    {t("Annuler", "Cancel")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setActivateError(null);
                    setConfirming(true);
                  }}
                  className="btn-primary mt-3 inline-flex"
                >
                  {t("Activer la diffusion", "Activate delivery")}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
