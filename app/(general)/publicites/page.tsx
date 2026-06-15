"use client";

import { useState } from "react";
import Link from "next/link";
import { useT, useLang } from "@/lib/i18n";
import { StudioHero } from "@/components/studio/StudioUI";
import { IconScout } from "@/components/visual/Icons";
import { Toast } from "@/components/ui/Toast";
import { useCompany } from "@/lib/company-context";
import { StrategyPanel } from "@/components/strategy/StrategyPanel";
import { CountryCombobox } from "@/components/ui/CountryCombobox";

interface AdEntry {
  id: string;
  pageName: string;
  body: string;
  linkTitle: string;
  impressionsLow: number;
  impressionsHigh: number;
  spendLow: number;
  spendHigh: number;
  currency: string;
  startTime: string;
  platforms: string[];
  snapshotUrl: string;
}

interface AdStrategyAnalysis {
  resume: string;
  anglesDominants: { angle: string; exemples: string[] }[];
  offres: string[];
  ctas: string[];
  pourquoiPerformantes: string[];
  recommandations: { titre: string; detail: string }[];
  aiGenerated: boolean;
}

export default function PublicitesPage() {
  const t = useT();
  const { lang } = useLang();
  const { company } = useCompany();
  const [country, setCountry] = useState("mu");
  const [terms, setTerms] = useState("");
  const [adType, setAdType] = useState<"POLITICAL_AND_ISSUE_ADS" | "ALL">("POLITICAL_AND_ISSUE_ADS");
  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState<AdEntry[]>([]);
  const [metricsAvailable, setMetricsAvailable] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AdStrategyAnalysis | null>(null);
  // Incrémenté après une analyse → force le StrategyPanel à recharger le brief.
  const [memoryRefresh, setMemoryRefresh] = useState(0);

  async function search() {
    setLoading(true);
    setErr(null);
    setAds([]);
    setAnalysis(null);
    try {
      const res = await fetch("/api/veille/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: country.trim().toUpperCase(), searchTerms: terms.trim(), adType, limit: 40, companyId: company.id }),
      });
      const data = await res.json();
      if (data.error) setErr(data.error);
      setAds(data.ads ?? []);
      // Impressions/dépenses uniquement disponibles pour les pubs politiques/sociales.
      // En mode "ALL", l'API les renvoie vides : on le signale et on n'en déduit rien.
      setMetricsAvailable(data.metricsAvailable !== false && adType === "POLITICAL_AND_ISSUE_ADS");
    } catch {
      setErr(t("Erreur réseau.", "Network error."));
    } finally {
      setLoading(false);
    }
  }

  async function analyze() {
    if (ads.length === 0) return;
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await fetch("/api/veille/ads-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ads, country: country.trim().toUpperCase(), terms: terms.trim(), companyId: company.id, language: lang }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAnalysis(data.analysis as AdStrategyAnalysis);
        // L'analyse est désormais stockée en mémoire stratégique : on régénère
        // le brief IA en tâche de fond (fire-and-forget). Quand la synthèse
        // aboutit, on signale au StrategyPanel de recharger le brief (sans clic).
        fetch("/api/memory/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId: company.id }),
        })
          .catch(() => {})
          .finally(() => setMemoryRefresh((n) => n + 1));
        // Rafraîchit aussi immédiatement (la mémoire est déjà alimentée).
        setMemoryRefresh((n) => n + 1);
        setToast({ message: t("Stratégie analysée et ajoutée à la mémoire.", "Strategy analyzed and added to memory."), key: Date.now() });
      } else {
        setToast({ message: t("Analyse indisponible.", "Analysis unavailable."), key: Date.now() });
      }
    } catch {
      setToast({ message: t("Erreur réseau.", "Network error."), key: Date.now() });
    } finally {
      setAnalyzing(false);
    }
  }

  function fmtImp(a: AdEntry) {
    if (a.impressionsHigh === 0 && a.impressionsLow === 0) return "—";
    return `${a.impressionsLow.toLocaleString()}–${a.impressionsHigh.toLocaleString()}`;
  }

  const flowSteps = [
    t("Chercher des pubs concurrentes", "Find competitor ads"),
    t("Analyser la stratégie (IA)", "Analyze the strategy (AI)"),
    t("Enrichir la mémoire & le brief", "Enrich memory & brief"),
    t("Lancer une campagne", "Launch a campaign"),
  ];

  return (
    <div className="animate-fade-in space-y-5">
      <StudioHero
        icon={<IconScout size={24} />}
        title={t("Publicités concurrentes (Meta Ad Library)", "Competitor ads (Meta Ad Library)")}
        subtitle={t(
          "Données réelles des publicités actives sur Facebook & Instagram, triées par impressions.",
          "Real data on active Facebook & Instagram ads, sorted by impressions."
        )}
      />

      {/* Fil conducteur : de la recherche de pubs à la campagne */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-2xs text-muted">
        {flowSteps.map((step, i) => (
          <span key={i} className="flex min-w-0 items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-hair bg-canvas px-2.5 py-1 font-medium text-ink">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700">{i + 1}</span>
              {step}
            </span>
            {i < flowSteps.length - 1 && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0 text-muted" aria-hidden><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            )}
          </span>
        ))}
      </div>

      {/* Mémoire stratégique & brief IA — alimente directement les campagnes */}
      <StrategyPanel companyId={company.id} refreshSignal={memoryRefresh} />

      <section className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="section-label text-primary-600">{t("1 · Chercher des publicités", "1 · Find ads")}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-muted">{t("Pays", "Country")}</label>
            <CountryCombobox value={country} onChange={setCountry} placeholder={t("Tapez un pays…", "Type a country…")} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-muted">{t("Mot-clé / marque", "Keyword / brand")}</label>
            <input className="input w-full" value={terms} onChange={(e) => setTerms(e.target.value)} placeholder={t("ex : santé, nom d'un concurrent…", "e.g. health, a competitor name…")} onKeyDown={(e) => e.key === "Enter" && search()} />
          </div>
          <div>
            <label className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-muted">{t("Type", "Type")}</label>
            <select className="input w-full" value={adType} onChange={(e) => setAdType(e.target.value as "POLITICAL_AND_ISSUE_ADS" | "ALL")}>
              <option value="POLITICAL_AND_ISSUE_ADS">{t("Politique & social", "Political & issue")}</option>
              <option value="ALL">{t("Toutes", "All")}</option>
            </select>
          </div>
        </div>
        <button className="btn-primary mt-4" onClick={search} disabled={loading}>
          {loading ? t("Recherche…", "Searching…") : t("Chercher les publicités", "Search ads")}
        </button>
        <p className="mt-2 text-2xs text-muted">
          {t(
            "Fonctionne avec SCRAPECREATORS_API_KEY (une seule clé, sans token Meta). Les impressions & dépenses ne sont disponibles que pour les pubs politiques/sociales (voie Meta avec token vérifié).",
            "Works with SCRAPECREATORS_API_KEY (single key, no Meta token). Impressions & spend are only available for political/issue ads (Meta route with verified token)."
          )}
        </p>
      </section>

      {err && (
        <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          <p className="font-semibold">{err}</p>
          <Link href="/parametres-connecteurs" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-warning-700 hover:underline">
            {t("Configurer le connecteur Meta", "Configure the Meta connector")}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>
      )}

      {/* État vide : la recherche n'a rien renvoyé (souvent faute de token Meta) */}
      {!loading && !err && ads.length === 0 && (
        <section className="card flex flex-col items-center gap-3 p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-muted" aria-hidden>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </span>
          <div className="max-w-md space-y-1.5">
            <p className="text-sm font-semibold text-ink">{t("Aucune publicité à afficher pour l'instant", "No ads to show yet")}</p>
            <p className="text-sm text-muted">
              {t(
                "Lancez une recherche ci-dessus. Si rien ne s'affiche, la Meta Ad Library renvoie souvent une liste vide sans jeton d'accès configuré.",
                "Run a search above. If nothing appears, the Meta Ad Library often returns an empty list when no access token is configured."
              )}
            </p>
          </div>
          <Link href="/parametres-connecteurs" className="btn-secondary text-xs">
            {t("Configurer le connecteur Meta", "Configure the Meta connector")}
          </Link>
        </section>
      )}

      {/* Analyse IA de la stratégie publicitaire */}
      {ads.length > 0 && (
        <section className="space-y-3">
          {!analysis && (
            <div className="card space-y-3 p-5">
              <span className="section-label text-ai-text">{t("2 · Analyser la stratégie", "2 · Analyze the strategy")}</span>
              <p className="text-sm text-muted">
                {t(
                  "L'IA dégage les angles, offres et CTA des publicités ci-dessous. Analyser ces pubs enrichit la mémoire stratégique réutilisée par vos campagnes.",
                  "The AI extracts angles, offers and CTAs from the ads below. Analyzing these ads enriches the strategic memory reused by your campaigns."
                )}
              </p>
              <button className="btn-primary" onClick={analyze} disabled={analyzing}>
                {analyzing ? t("Analyse de la stratégie…", "Analyzing strategy…") : t("✨ Analyser la stratégie publicitaire (IA)", "✨ Analyze ad strategy (AI)")}
              </button>
            </div>
          )}
          {analysis && (
            <div className="card space-y-4 p-5">
              <div className="flex items-center gap-2">
                <span className="section-label text-primary-500">{t("Stratégie publicitaire", "Ad strategy")}</span>
                <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${analysis.aiGenerated ? "bg-success-100 text-success-700" : "bg-warning-50 text-warning-700"}`}>
                  {analysis.aiGenerated ? t("Analyse IA", "AI analysis") : t("Modèle", "Template")}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-ink">{analysis.resume}</p>

              {analysis.anglesDominants?.length > 0 && (
                <div>
                  <p className="section-label mb-2">{t("Angles dominants", "Dominant angles")}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {analysis.anglesDominants.map((a, i) => (
                      <div key={i} className="rounded-lg border border-hair bg-canvas p-3">
                        <p className="text-sm font-semibold text-ink">{a.angle}</p>
                        {a.exemples?.length > 0 && <p className="mt-0.5 text-2xs text-muted">{a.exemples.join(" · ")}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {analysis.offres?.length > 0 && (
                  <div>
                    <p className="section-label mb-1.5">{t("Offres / promesses", "Offers / promises")}</p>
                    <ul className="space-y-0.5 text-sm text-ink">{analysis.offres.map((o, i) => <li key={i} className="flex gap-1.5"><span className="text-primary">›</span>{o}</li>)}</ul>
                  </div>
                )}
                {analysis.ctas?.length > 0 && (
                  <div>
                    <p className="section-label mb-1.5">{t("Appels à l'action", "Calls to action")}</p>
                    <div className="flex flex-wrap gap-1.5">{analysis.ctas.map((c, i) => <span key={i} className="chip">{c}</span>)}</div>
                  </div>
                )}
              </div>

              {analysis.pourquoiPerformantes?.length > 0 && (
                <div>
                  <p className="section-label mb-1.5">{t("Pourquoi elles performent", "Why they perform")}</p>
                  <ul className="space-y-1 text-sm text-ink">{analysis.pourquoiPerformantes.map((p, i) => <li key={i} className="flex gap-1.5"><span className="text-success-600">✓</span>{p}</li>)}</ul>
                </div>
              )}

              {analysis.recommandations?.length > 0 && (
                <div>
                  <p className="section-label mb-2">{t("Recommandations pour vous", "Recommendations for you")}</p>
                  <div className="space-y-2">
                    {analysis.recommandations.map((r, i) => (
                      <a
                        key={i}
                        href={`/campaigns/new?${new URLSearchParams({ name: r.titre, text: `${r.titre} — ${r.detail}` }).toString()}`}
                        className="group block rounded-lg border border-primary-200 bg-primary-50/50 p-3 transition-colors hover:border-primary-400 hover:bg-primary-50"
                        title={t("Créer une campagne à partir de cette recommandation", "Create a campaign from this recommendation")}
                      >
                        <p className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">
                          {r.titre}
                          <span className="shrink-0 text-2xs font-medium text-page opacity-0 transition-opacity group-hover:opacity-100">{t("Créer une pub →", "Create an ad →")}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted">{r.detail}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-hair pt-3">
                <button className="btn-secondary text-xs" onClick={analyze} disabled={analyzing}>{t("↻ Relancer l'analyse", "↻ Re-run analysis")}</button>
                <p className="min-w-0 flex-1 text-2xs text-ai-text">
                  {t(
                    "Ces enseignements sont enregistrés dans la mémoire stratégique et le brief IA, réutilisés pour vos campagnes.",
                    "These insights are saved to the strategic memory and AI brief, reused for your campaigns."
                  )}
                </p>
              </div>
            </div>
          )}

          {!metricsAvailable && (
            <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
              <p className="font-semibold">
                {t("Impressions & dépenses indisponibles hors pubs politiques", "Impressions & spend unavailable outside political/issue ads")}
              </p>
              <p className="mt-0.5 text-xs">
                {t(
                  "En mode « Toutes », la Meta Ad Library ne renvoie ni impressions ni dépenses. Ces publicités ne sont donc PAS triées par impressions. Sélectionnez « Politique & social » pour obtenir ces métriques.",
                  "In « All » mode, the Meta Ad Library returns neither impressions nor spend. These ads are therefore NOT sorted by impressions. Select « Political & issue » to get these metrics."
                )}
              </p>
            </div>
          )}
          <div className="section-label">
            {ads.length}{" "}
            {metricsAvailable
              ? t("publicités (triées par impressions)", "ads (sorted by impressions)")
              : t("publicités (impressions/dépenses indisponibles)", "ads (impressions/spend unavailable)")}
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {ads.map((a) => (
              <div key={a.id} className="card p-4">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold text-ink">{a.pageName || "—"}</span>
                  {metricsAvailable && (
                    <span className="chip shrink-0 border-primary-200 bg-primary-50 text-primary-700">👁 {fmtImp(a)}</span>
                  )}
                </div>
                {a.linkTitle && <p className="break-words text-sm font-medium text-ink">{a.linkTitle}</p>}
                {a.body && <p className="mt-1 line-clamp-4 break-words text-sm text-muted">{a.body}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs text-muted">
                  {(a.spendHigh > 0 || a.spendLow > 0) && (
                    <span className="chip">{t("Dépense", "Spend")}: {a.spendLow.toLocaleString()}–{a.spendHigh.toLocaleString()} {a.currency}</span>
                  )}
                  {a.platforms.map((p) => <span key={p} className="chip">{p}</span>)}
                  {a.startTime && <span>{t("Depuis", "Since")} {new Date(a.startTime).toLocaleDateString(t("fr-FR", "en-US"))}</span>}
                </div>
                {a.snapshotUrl && (
                  <a href={a.snapshotUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">
                    {t("Voir la publicité →", "View the ad →")}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {toast && <Toast key={toast.key} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}
