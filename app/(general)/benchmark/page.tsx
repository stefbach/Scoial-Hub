"use client";

// ── Benchmark concurrentiel ──────────────────────────────────────────────────
// Compare AXON-AI à des concurrents (saisis par l'utilisateur, avec URL pricing
// optionnelle). Le serveur récupère les pages puis Claude produit une matrice de
// scores (12 dimensions), une SWOT, le positionnement et un prix conseillé.

import { useEffect, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner, BusyHint } from "@/components/ui/Spinner";

interface Row { name: string; isYou?: boolean; scores: number[]; total: number }
interface PricingBlock { name: string; tiers: { tier: string; price: string; note?: string }[] }
interface BenchmarkResult {
  summary: string;
  threatLevel: "LOW" | "MEDIUM" | "HIGH";
  dimensions: string[];
  rows: Row[];
  pricing: PricingBlock[];
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  positioning: string;
  recommendedPricing: { tiers: { name: string; price: string; target: string; rationale?: string }[]; notes?: string };
}

const DEFAULT_COMPETITORS = [
  { name: "Hootsuite", url: "https://www.hootsuite.com/plans" },
  { name: "Sprout Social", url: "https://sproutsocial.com/pricing/" },
  { name: "Metricool", url: "https://metricool.com/pricing/" },
  { name: "HeyGen", url: "https://www.heygen.com/pricing" },
];

function scoreColor(n: number) {
  if (n >= 5) return "bg-success-500 text-white";
  if (n === 4) return "bg-success-500/70 text-white";
  if (n === 3) return "bg-amber-400/80 text-ink";
  if (n === 2) return "bg-orange-400/80 text-white";
  return "bg-danger-500/80 text-white";
}

export default function BenchmarkPage() {
  const { company } = useCompany();
  const t = useT();

  const [competitors, setCompetitors] = useState(DEFAULT_COMPETITORS);
  const [product, setProduct] = useState("");
  const [productPrefilled, setProductPrefilled] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BenchmarkResult | null>(null);

  const setComp = (i: number, key: "name" | "url", v: string) =>
    setCompetitors((cs) => cs.map((c, j) => (j === i ? { ...c, [key]: v } : c)));
  const addComp = () => setCompetitors((cs) => (cs.length >= 6 ? cs : [...cs, { name: "", url: "" }]));
  const removeComp = (i: number) => setCompetitors((cs) => cs.filter((_, j) => j !== i));

  // #20 — Réutiliser la description produit déjà saisie ailleurs : on préremplit
  // « Votre produit » depuis l'identité de marque (résumé + positionnement),
  // pour ne plus avoir à la ressaisir. L'utilisateur reste libre de l'éditer.
  useEffect(() => {
    let alive = true;
    setProduct(""); setProductPrefilled(false);
    fetch(`/api/onboarding/state?companyId=${encodeURIComponent(company.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.profile) return;
        const p = d.profile as { summary?: string; positioning?: string; audience?: string };
        const text = [p.summary, p.positioning, p.audience ? `Cible : ${p.audience}` : ""]
          .filter(Boolean).join(" ").trim();
        if (text) { setProduct((cur) => cur || text); setProductPrefilled(true); }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [company.id]);

  // #21 — L'IA propose des concurrents à partir de votre produit ; l'utilisateur
  // peut toujours en ajouter/éditer/supprimer manuellement.
  async function suggestCompetitors() {
    if (suggesting) return;
    setSuggesting(true); setError(null);
    try {
      const res = await fetch("/api/veille/identify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, theme: product.trim() || company.name, keywords: [], geo: "fr" }),
      });
      const d = await res.json() as { competitors?: { name: string }[] };
      const names = (d.competitors ?? []).map((c) => c.name).filter(Boolean);
      if (names.length === 0) { setError(t("Aucune suggestion — décrivez votre produit puis réessayez.", "No suggestion — describe your product then retry.")); return; }
      setCompetitors((cs) => {
        const existing = new Set(cs.map((c) => c.name.trim().toLowerCase()).filter(Boolean));
        const additions = names
          .filter((n) => !existing.has(n.toLowerCase()))
          .map((n) => ({ name: n, url: "" }));
        return [...cs.filter((c) => c.name.trim()), ...additions].slice(0, 6);
      });
    } catch {
      setError(t("Erreur réseau pendant la suggestion.", "Network error while suggesting."));
    } finally { setSuggesting(false); }
  }

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          product: product.trim() || undefined,
          competitors: competitors.filter((c) => c.name.trim()),
        }),
      });
      const d = await res.json();
      if (d.simulated) { setError(t("IA non configurée (ANTHROPIC_API_KEY).", "AI not configured (ANTHROPIC_API_KEY).")); return; }
      if (!res.ok) { setError(d.error || t("Échec du benchmark.", "Benchmark failed.")); return; }
      setResult(d.result as BenchmarkResult);
    } catch {
      setError(t("Erreur réseau.", "Network error."));
    } finally {
      setLoading(false);
    }
  }

  const threatTint =
    result?.threatLevel === "HIGH" ? "bg-danger-500/15 text-danger-600"
    : result?.threatLevel === "MEDIUM" ? "bg-amber-400/20 text-amber-700"
    : "bg-success-500/15 text-success-600";

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={t("Benchmark concurrentiel", "Competitive benchmark")}
        scoped={false}
      />
      <p className="-mt-3 max-w-3xl text-sm text-muted">
        {t(
          "Comparez votre produit aux meilleurs du marché : qualité, fonctionnalités, prix. L'IA récupère les pages des concurrents et génère une matrice de scores, une analyse SWOT et un prix conseillé.",
          "Compare your product to the best on the market: quality, features, pricing. AI fetches competitor pages and generates a score matrix, SWOT analysis and recommended pricing."
        )}
      </p>

      {/* Saisie */}
      <div className="card space-y-4 p-5">
        <div>
          <label className="section-label">{t("Votre produit", "Your product")}</label>
          <textarea
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            rows={2}
            placeholder={t("Décrivez votre produit, sa cible et ses atouts…", "Describe your product, target and strengths…")}
            className="input mt-1 w-full"
          />
          {productPrefilled && (
            <p className="mt-1 text-2xs text-muted">{t("✓ Prérempli depuis votre identité de marque — modifiable.", "✓ Prefilled from your brand identity — editable.")}</p>
          )}
        </div>

        <div>
          <label className="section-label">{t("Concurrents (nom + URL pricing optionnelle)", "Competitors (name + optional pricing URL)")}</label>
          <div className="mt-2 space-y-2">
            {competitors.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={c.name}
                  onChange={(e) => setComp(i, "name", e.target.value)}
                  placeholder={t("Nom", "Name")}
                  className="input w-40 shrink-0"
                />
                <input
                  value={c.url}
                  onChange={(e) => setComp(i, "url", e.target.value)}
                  placeholder="https://…/pricing"
                  className="input min-w-0 flex-1"
                />
                <button onClick={() => removeComp(i)} className="btn-ghost shrink-0 px-2 text-danger-600" aria-label="remove">✕</button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {competitors.length < 6 && (
              <button onClick={addComp} className="btn-ghost text-xs">+ {t("Ajouter un concurrent", "Add competitor")}</button>
            )}
            <button onClick={suggestCompetitors} disabled={suggesting} className="btn-secondary inline-flex items-center gap-1.5 text-xs disabled:opacity-50">
              {suggesting && <Spinner size={12} className="text-current" />}
              {suggesting ? t("Suggestion…", "Suggesting…") : t("✨ Suggérer des concurrents (IA)", "✨ Suggest competitors (AI)")}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={run} disabled={loading} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
            {loading && <Spinner size={14} className="text-white" />}
            {loading ? t("Analyse en cours…", "Analyzing…") : t("Lancer le benchmark", "Run benchmark")}
          </button>
          {loading && <BusyHint label={t("Récupération des pages + analyse Claude…", "Fetching pages + Claude analysis…")} eta={t("~20–40 s", "~20–40 s")} />}
        </div>
        {error && <p className="text-xs text-danger-600">{error}</p>}
      </div>

      {/* Résultats */}
      {result && (
        <div className="space-y-5">
          {/* Synthèse */}
          <div className="card p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="section-label">{t("Synthèse", "Summary")}</span>
              <span className={`rounded-full px-2 py-0.5 text-2xs font-bold ${threatTint}`}>
                {t("Menace", "Threat")}: {result.threatLevel}
              </span>
            </div>
            <p className="text-sm text-ink">{result.summary}</p>
          </div>

          {/* Scorecard */}
          {result.rows?.length > 0 && (
            <div className="card overflow-x-auto p-5">
              <span className="section-label">{t("Matrice de scores (1–5)", "Score matrix (1–5)")}</span>
              <table className="mt-3 w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-card p-2 text-left font-semibold text-muted">{t("Dimension", "Dimension")}</th>
                    {result.rows.map((r) => (
                      <th key={r.name} className={`p-2 text-center font-semibold ${r.isYou ? "text-primary-600" : "text-ink"}`}>{r.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.dimensions.map((dim, di) => (
                    <tr key={dim} className="border-t border-hair">
                      <td className="sticky left-0 bg-card p-2 text-muted">{dim}</td>
                      {result.rows.map((r) => (
                        <td key={r.name} className="p-1.5 text-center">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded font-bold ${scoreColor(r.scores[di] ?? 0)}`}>
                            {r.scores[di] ?? "–"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-hair">
                    <td className="sticky left-0 bg-card p-2 font-bold text-ink">{t("Total / 60", "Total / 60")}</td>
                    {result.rows.map((r) => (
                      <td key={r.name} className={`p-2 text-center text-sm font-bold ${r.isYou ? "text-primary-600" : "text-ink"}`}>{r.total}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Prix concurrents */}
          {result.pricing?.length > 0 && (
            <div className="card p-5">
              <span className="section-label">{t("Tarifs des concurrents", "Competitor pricing")}</span>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {result.pricing.map((p) => (
                  <div key={p.name} className="rounded-lg border border-hair p-3">
                    <p className="mb-1.5 text-sm font-semibold text-ink">{p.name}</p>
                    <ul className="space-y-1">
                      {p.tiers.map((tier, i) => (
                        <li key={i} className="flex justify-between gap-2 text-2xs text-muted">
                          <span>{tier.tier}{tier.note ? ` — ${tier.note}` : ""}</span>
                          <span className="shrink-0 font-semibold text-ink">{tier.price}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SWOT */}
          {result.swot && (
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["strengths", t("Forces", "Strengths"), "border-success-500/40"],
                ["weaknesses", t("Faiblesses", "Weaknesses"), "border-danger-500/40"],
                ["opportunities", t("Opportunités", "Opportunities"), "border-primary-400/40"],
                ["threats", t("Menaces", "Threats"), "border-amber-400/40"],
              ] as const).map(([key, label, border]) => (
                <div key={key} className={`card border-l-4 p-4 ${border}`}>
                  <p className="section-label mb-1.5">{label}</p>
                  <ul className="list-disc space-y-1 pl-4 text-2xs text-ink">
                    {result.swot[key]?.map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Positionnement */}
          {result.positioning && (
            <div className="card p-5">
              <span className="section-label">{t("Positionnement", "Positioning")}</span>
              <p className="mt-2 text-sm text-ink">{result.positioning}</p>
            </div>
          )}

          {/* Prix conseillé */}
          {result.recommendedPricing?.tiers?.length > 0 && (
            <div className="card p-5">
              <span className="section-label text-primary-600">{t("Prix conseillé pour votre produit", "Recommended pricing for your product")}</span>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {result.recommendedPricing.tiers.map((tier, i) => (
                  <div key={i} className="rounded-xl border border-primary-400/30 bg-primary-50/40 p-3">
                    <p className="text-sm font-bold text-ink">{tier.name}</p>
                    <p className="my-1 text-lg font-extrabold text-primary-600">{tier.price}</p>
                    <p className="text-2xs font-medium text-muted">{tier.target}</p>
                    {tier.rationale && <p className="mt-1.5 text-2xs text-muted">{tier.rationale}</p>}
                  </div>
                ))}
              </div>
              {result.recommendedPricing.notes && (
                <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-2xs text-muted">{result.recommendedPricing.notes}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
