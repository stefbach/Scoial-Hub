"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { Toast } from "@/components/ui/Toast";

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
  const [country, setCountry] = useState("MU");
  const [terms, setTerms] = useState("");
  const [adType, setAdType] = useState<"POLITICAL_AND_ISSUE_ADS" | "ALL">("POLITICAL_AND_ISSUE_ADS");
  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState<AdEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AdStrategyAnalysis | null>(null);

  async function search() {
    setLoading(true);
    setErr(null);
    setAds([]);
    setAnalysis(null);
    try {
      const res = await fetch("/api/veille/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: country.trim().toUpperCase(), searchTerms: terms.trim(), adType, limit: 40 }),
      });
      const data = await res.json();
      if (data.error) setErr(data.error);
      setAds(data.ads ?? []);
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
        body: JSON.stringify({ ads, country: country.trim().toUpperCase(), terms: terms.trim() }),
      });
      const data = await res.json();
      if (data.analysis) setAnalysis(data.analysis as AdStrategyAnalysis);
      else setToast({ message: t("Analyse indisponible.", "Analysis unavailable."), key: Date.now() });
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

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: "#1877F2" }} aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.5V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" /></svg>
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">{t("Publicités concurrentes (Meta Ad Library)", "Competitor ads (Meta Ad Library)")}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {t(
              "Données réelles des publicités actives sur Facebook & Instagram, triées par impressions.",
              "Real data on active Facebook & Instagram ads, sorted by impressions."
            )}
          </p>
        </div>
      </div>

      <section className="card p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-muted">{t("Pays (code ISO)", "Country (ISO code)")}</label>
            <input className="input w-full" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="MU" />
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
            "Impressions & dépenses disponibles pour les pubs politiques/sociales. Nécessite META_AD_LIBRARY_TOKEN (token utilisateur, identité vérifiée).",
            "Impressions & spend available for political/issue ads. Requires META_AD_LIBRARY_TOKEN (user token, verified identity)."
          )}
        </p>
      </section>

      {err && (
        <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">{err}</div>
      )}

      {/* Analyse IA de la stratégie publicitaire */}
      {ads.length > 0 && (
        <section className="space-y-3">
          {!analysis && (
            <button className="btn-primary" onClick={analyze} disabled={analyzing}>
              {analyzing ? t("Analyse de la stratégie…", "Analyzing strategy…") : t("✨ Analyser la stratégie publicitaire (IA)", "✨ Analyze ad strategy (AI)")}
            </button>
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
                      <div key={i} className="rounded-lg border border-primary-200 bg-primary-50/50 p-3">
                        <p className="text-sm font-semibold text-ink">{r.titre}</p>
                        <p className="mt-0.5 text-xs text-muted">{r.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button className="btn-secondary text-xs" onClick={analyze} disabled={analyzing}>{t("↻ Relancer l'analyse", "↻ Re-run analysis")}</button>
            </div>
          )}

          <div className="section-label">{ads.length} {t("publicités (triées par impressions)", "ads (sorted by impressions)")}</div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {ads.map((a) => (
              <div key={a.id} className="card p-4">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{a.pageName || "—"}</span>
                  <span className="chip border-primary-200 bg-primary-50 text-primary-700">👁 {fmtImp(a)}</span>
                </div>
                {a.linkTitle && <p className="text-sm font-medium text-ink">{a.linkTitle}</p>}
                {a.body && <p className="mt-1 line-clamp-4 text-sm text-muted">{a.body}</p>}
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
