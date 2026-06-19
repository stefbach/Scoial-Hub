"use client";

// ── Prédiction & Simulation de campagne ──────────────────────────────────────
// Avant de dépenser, on SIMULE : à partir d'un produit, d'une cible, d'un message
// (et des tendances issues de la Veille), Claude génère des personas représentatifs,
// simule leurs réactions et agrège une PRÉDICTION de réception + recommandations.
// Inspiré des moteurs multi-agents (type MiroFish), mais 100 % natif et sans
// dépendance externe. Résultat directionnel — une aide à la décision, pas un oracle.

import { useEffect, useRef, useState } from "react";
import { useT, useLang } from "@/lib/i18n";
import { useCompany } from "@/lib/company-context";
import { StudioHero, StudioStep } from "@/components/studio/StudioUI";
import { Spinner } from "@/components/ui/Spinner";
import type { SimulationResult } from "@/lib/ai/simulation";

function IconCrystal({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 18.5h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9.5 7.5a3.5 3.5 0 0 1 3-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

const SENTIMENT_STYLE: Record<string, string> = {
  positif: "bg-success-50 text-success-700 ring-success-500/20",
  neutre: "bg-canvas text-muted ring-hair",
  "négatif": "bg-danger-50 text-danger-700 ring-danger-500/20",
};

function scoreTone(score: number): { text: string; bar: string } {
  if (score >= 67) return { text: "text-success-700", bar: "bg-success-500" };
  if (score >= 40) return { text: "text-warning-700", bar: "bg-warning-500" };
  return { text: "text-danger-700", bar: "bg-danger-500" };
}

export default function SimulateurPage() {
  const t = useT();
  const { lang } = useLang();
  const { company, access } = useCompany();
  const canEdit = access.canEdit;

  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [message, setMessage] = useState("");
  const [market, setMarket] = useState("");
  const [trends, setTrends] = useState("");

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const hydrated = useRef(false);

  // Persistance par société : les saisies et la dernière simulation survivent au
  // rechargement (cohérent avec Veille / Studio Avatar / Publicités).
  useEffect(() => {
    hydrated.current = false;
    try {
      const raw = localStorage.getItem(`simulateur_${company.id}`);
      if (raw) {
        const s = JSON.parse(raw) as Record<string, unknown>;
        if (typeof s.product === "string") setProduct(s.product);
        if (typeof s.audience === "string") setAudience(s.audience);
        if (typeof s.message === "string") setMessage(s.message);
        if (typeof s.market === "string") setMarket(s.market);
        if (typeof s.trends === "string") setTrends(s.trends);
        if (s.result && typeof s.result === "object") setResult(s.result as SimulationResult);
      } else {
        setProduct(""); setAudience(""); setMessage(""); setMarket(""); setTrends(""); setResult(null);
      }
    } catch { /* stockage indisponible */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return; }
    try {
      localStorage.setItem(`simulateur_${company.id}`, JSON.stringify({ product, audience, message, market, trends, result }));
    } catch { /* quota / mode privé */ }
  }, [company.id, product, audience, message, market, trends, result]);

  async function run() {
    if (!product.trim()) { setError(t("Décrivez le produit à mettre en avant.", "Describe the product to promote.")); return; }
    if (!audience.trim()) { setError(t("Précisez l'audience cible.", "Specify the target audience.")); return; }
    setRunning(true); setError(null); setNote(null);
    try {
      const r = await fetch("/api/ai/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, product, audience, message, market, trends, language: lang }),
      });
      const d = await r.json();
      if (d.simulated) { setNote(t("Simulation IA non configurée (ANTHROPIC_API_KEY).", "AI simulation not configured (ANTHROPIC_API_KEY).")); return; }
      if (!r.ok || !d.result) { setError((d.error as string) || t("Échec de la simulation.", "Simulation failed.")); return; }
      setResult(d.result as SimulationResult);
    } catch {
      setError(t("Erreur réseau.", "Network error."));
    } finally { setRunning(false); }
  }

  const tone = result ? scoreTone(result.score) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <StudioHero
        icon={<IconCrystal size={24} />}
        title={t("Prédiction & Simulation de campagne", "Campaign Prediction & Simulation")}
        subtitle={t(
          "Avant de dépenser, simulez la réaction de votre cible : l'IA crée des personas représentatifs, simule leurs réactions à votre produit et prédit la réception — avec des recommandations concrètes.",
          "Before spending, simulate your audience's reaction: the AI builds representative personas, simulates their reactions to your product and predicts reception — with concrete recommendations."
        )}
      />

      {!canEdit ? (
        <div className="card p-8 text-center text-sm text-muted">
          {t("Accès en lecture seule : la simulation est réservée aux accès en édition.", "View-only access: simulation requires edit access.")}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          {/* ── Colonne entrées ── */}
          <div className="space-y-4">
            <StudioStep n={1} title={t("Quoi mettre en avant ?", "What to promote?")} hint={t("Le produit/offre et la cible sont obligatoires.", "Product/offer and audience are required.")}>
              <label className="text-2xs font-medium text-muted">{t("Produit / offre", "Product / offer")}</label>
              <textarea value={product} onChange={(e) => setProduct(e.target.value)} rows={2}
                placeholder={t("Ex. « Nouvelle offre de téléconsultation médicale 24/7 »", "E.g. \"New 24/7 telehealth consultation offer\"")}
                className="input resize-y" />

              <label className="text-2xs font-medium text-muted">{t("Audience cible", "Target audience")}</label>
              <textarea value={audience} onChange={(e) => setAudience(e.target.value)} rows={2}
                placeholder={t("Ex. « Familles urbaines 30-45 ans, île Maurice, soucieuses de la santé »", "E.g. \"Urban families 30-45, Mauritius, health-conscious\"")}
                className="input resize-y" />

              <label className="text-2xs font-medium text-muted">{t("Message / angle (optionnel)", "Message / angle (optional)")}</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2}
                placeholder={t("Ex. « Un médecin, à toute heure, sans bouger de chez vous »", "E.g. \"A doctor, anytime, without leaving home\"")}
                className="input resize-y" />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-2xs font-medium text-muted">{t("Marché / zone (optionnel)", "Market / area (optional)")}</label>
                  <input value={market} onChange={(e) => setMarket(e.target.value)}
                    placeholder={t("Ex. « Maurice »", "E.g. \"Mauritius\"")} className="input" />
                </div>
              </div>
            </StudioStep>

            <StudioStep n={2} title={t("Tendances actuelles (optionnel)", "Current trends (optional)")} hint={t("Collez les enseignements de la Veille & Marché pour ancrer la simulation dans le réel.", "Paste insights from Market Watch to ground the simulation in reality.")}>
              <textarea value={trends} onChange={(e) => setTrends(e.target.value)} rows={4}
                placeholder={t("Ex. « Forte demande de prévention, méfiance envers les pubs trop commerciales, essor du format vidéo court… »", "E.g. \"Strong demand for prevention, distrust of overly commercial ads, rise of short video…\"")}
                className="input resize-y" />
            </StudioStep>

            <button onClick={run} disabled={running} className="btn-primary w-full justify-center py-3 text-sm disabled:opacity-50">
              {running
                ? <span className="inline-flex items-center gap-2"><Spinner size={16} className="text-white" />{t("Simulation en cours… (30-60 s)", "Simulating… (30-60 s)")}</span>
                : t("🔮 Lancer la simulation", "🔮 Run simulation")}
            </button>
            {note && <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">{note}</p>}
            {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</p>}
          </div>

          {/* ── Colonne résultat ── */}
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            {!result ? (
              <div className="card flex min-h-[280px] flex-col items-center justify-center gap-3 p-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600"><IconCrystal size={28} /></span>
                <p className="text-sm text-muted">{t("La prédiction de réception s'affichera ici.", "The reception prediction will appear here.")}</p>
              </div>
            ) : (
              <>
                {/* Score + verdict */}
                <div className="card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="section-label">{t("Réception prédite", "Predicted reception")}</p>
                    <span className={`text-3xl font-bold ${tone?.text}`}>{result.score}<span className="text-base text-muted">/100</span></span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-canvas">
                    <div className={`h-full rounded-full ${tone?.bar}`} style={{ width: `${result.score}%` }} />
                  </div>
                  {result.verdict && <p className="mt-3 text-sm font-semibold text-ink">{result.verdict}</p>}
                  {result.summary && <p className="mt-1 text-xs leading-relaxed text-muted">{result.summary}</p>}
                </div>

                {/* Personas */}
                {result.personas.length > 0 && (
                  <div className="card p-5">
                    <p className="section-label mb-2">{t("Réactions simulées", "Simulated reactions")}</p>
                    <div className="space-y-2">
                      {result.personas.map((p, i) => (
                        <div key={i} className="rounded-lg border border-hair bg-canvas/40 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-semibold text-ink">{p.name}</p>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold ring-1 ${SENTIMENT_STYLE[p.sentiment] ?? SENTIMENT_STYLE.neutre}`}>
                              {p.adoption}%
                            </span>
                          </div>
                          {p.profile && <p className="text-2xs text-muted">{p.profile}</p>}
                          {p.reaction && <p className="mt-1 text-xs italic text-ink/80">« {p.reaction} »</p>}
                          {p.objection && <p className="mt-1 text-2xs text-danger-600">⚠ {p.objection}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Angles gagnants + objections */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {result.winningAngles.length > 0 && (
                    <div className="card p-4">
                      <p className="section-label mb-1.5">{t("Angles gagnants", "Winning angles")}</p>
                      <ul className="space-y-1 text-xs text-ink">
                        {result.winningAngles.map((a, i) => <li key={i} className="flex gap-1.5"><span className="text-success-600">✓</span>{a}</li>)}
                      </ul>
                    </div>
                  )}
                  {result.objections.length > 0 && (
                    <div className="card p-4">
                      <p className="section-label mb-1.5">{t("Objections & risques", "Objections & risks")}</p>
                      <ul className="space-y-1 text-xs text-ink">
                        {result.objections.map((o, i) => <li key={i} className="flex gap-1.5"><span className="text-danger-500">•</span>{o}</li>)}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Recommandations */}
                {result.recommendations.length > 0 && (
                  <div className="card p-5">
                    <p className="section-label mb-2">{t("Recommandations", "Recommendations")}</p>
                    <ul className="space-y-1.5 text-sm text-ink">
                      {result.recommendations.map((r, i) => <li key={i} className="flex gap-2"><span className="text-primary-600">→</span>{r}</li>)}
                    </ul>
                  </div>
                )}

                {/* Alignement tendances */}
                {result.trendAlignment && (
                  <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-4">
                    <p className="section-label mb-1">{t("Alignement aux tendances", "Trend alignment")}</p>
                    <p className="text-xs leading-relaxed text-ink">{result.trendAlignment}</p>
                  </div>
                )}

                <p className="text-2xs text-muted">
                  {t(
                    "⚠ Simulation prospective générée par IA : une aide à la décision directionnelle, pas une garantie de résultat.",
                    "⚠ AI-generated prospective simulation: a directional decision aid, not a guarantee of results."
                  )}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
