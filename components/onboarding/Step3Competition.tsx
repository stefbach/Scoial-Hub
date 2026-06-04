"use client";

// ── Étape 3 : Concurrence & mots-clés ───────────────────────────────────────
// L'utilisateur affine ses mots-clés, consulte les angles concurrentiels
// détectés par l'IA lors de l'étape 1, puis peut déclencher une analyse
// concurrentielle complète via /api/veille/run.
// Cette étape est optionnelle — un lien vers /veille permet d'aller plus loin.

import { useState } from "react";
import Link from "next/link";
import { useOnboardingCtx } from "@/components/onboarding/context";
import { useT } from "@/lib/i18n";

// ── Types locaux pour la réponse de /api/veille/run ─────────────────────────

interface VeilleCompetiteur {
  handle: string;
  network: string;
  scorePuissance: number;
  strategie: string;
  pourquoiPuissant: string;
  engagementMoyen?: number;
  formatDominant?: string;
}

interface VeilleRecommandation {
  priorite: "haute" | "moyenne" | "basse" | string;
  titre: string;
  detail: string;
  action?: string;
}

interface VeilleAnalysis {
  resume?: string;
  competiteurs?: VeilleCompetiteur[];
  recommandations?: VeilleRecommandation[];
  anglesThematiques?: { angle: string; potentiel: string }[];
}

interface VeilleRunResult {
  scrape?: unknown;
  analysis?: VeilleAnalysis;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Couleur du chip réseau selon la plateforme */
function networkColor(network: string): string {
  const n = network.toLowerCase();
  if (n === "facebook") return "text-platform-facebook border-blue-200 bg-blue-50";
  if (n === "instagram") return "text-platform-instagram border-pink-200 bg-pink-50";
  if (n === "linkedin") return "text-platform-linkedin border-sky-200 bg-sky-50";
  if (n === "tiktok") return "text-ink border-zinc-200 bg-zinc-50";
  return "text-muted border-hair bg-canvas";
}

/** Couleur de la priorité */
function prioriteColor(p: string): { chip: string; dot: string } {
  if (p === "haute") return { chip: "bg-danger-50 text-danger-700 border-danger-200", dot: "bg-danger-500" };
  if (p === "moyenne") return { chip: "bg-warning-50 text-warning-700 border-warning-200", dot: "bg-warning-500" };
  return { chip: "bg-success-50 text-success-700 border-success-200", dot: "bg-success-500" };
}

// ── Micro-composants ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8" strokeOpacity="0.25" fill="none" />
      <path d="M8 2A6 6 0 0 1 14 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Icône ampoule — angles IA */
function BulbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.5a4.5 4.5 0 0 0-2 8.535V11a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-.965A4.5 4.5 0 0 0 8 1.5Z"
        stroke="currentColor" strokeWidth="1.3" fill="none"
      />
      <path d="M6.5 13.5h3M7 14.5h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** Barre de score /100 */
function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(Math.max(score, 0), 100);
  const color = pct >= 70 ? "bg-danger-500" : pct >= 40 ? "bg-warning-500" : "bg-success-500";
  return (
    <div className="flex items-center gap-2" aria-label={`Score ${pct}/100`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-canvas">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-2xs font-bold text-ink">{pct}</span>
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────

export default function Step3Competition() {
  const t = useT();
  const { companyId, companyName, state, profile, hasProfile } = useOnboardingCtx();

  // Mots-clés — état local seedé depuis le profil IA
  const [keywords, setKeywords] = useState<string[]>(profile.keywords ?? []);
  const [kwInput, setKwInput] = useState("");

  // Analyse concurrentielle
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<VeilleAnalysis | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // ── Gestion des mots-clés ──────────────────────────────────────────────────

  function addKeyword() {
    const v = kwInput.trim().replace(/^#/, "");
    if (v && !keywords.includes(v)) setKeywords((prev) => [...prev, v]);
    setKwInput("");
  }

  function removeKeyword(kw: string) {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  }

  // ── Lancement de l'analyse concurrentielle ────────────────────────────────

  async function handleAnalyse() {
    setRunning(true);
    setRunResult(null);
    setRunError(null);
    try {
      const res = await fetch("/api/veille/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          geo: state.geo?.countries?.[0] ?? "MU",
          keywords,
          theme: keywords[0] ?? companyName,
          competitorIds: [],
        }),
      });
      const data = (await res.json()) as VeilleRunResult & { error?: string };
      if (data.error && !data.analysis) {
        setRunError(data.error);
        return;
      }
      setRunResult(data.analysis ?? null);
    } catch (err) {
      setRunError(
        t(
          "Impossible de lancer l'analyse. Vérifiez votre connexion.",
          "Unable to start the analysis. Check your connection."
        )
      );
      console.error("[Step3Competition] veille/run:", err);
    } finally {
      setRunning(false);
    }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Mots-clés ── */}
      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="section-label">{t("Mots-clés de veille", "Monitoring keywords")}</p>
          <span className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-2xs font-semibold text-primary-700">
            {keywords.length}
          </span>
        </div>

        {/* Chips */}
        <div
          className="flex flex-wrap gap-1.5 rounded-xl border border-hair bg-canvas px-3 py-2.5 shadow-inner-sm focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20"
          role="group"
          aria-label={t("Mots-clés actifs", "Active keywords")}
        >
          {keywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700"
            >
              #{kw}
              <button
                type="button"
                onClick={() => removeKeyword(kw)}
                className="ml-0.5 leading-none text-primary-400 hover:text-primary-700 transition-colors"
                aria-label={t(`Retirer le mot-clé ${kw}`, `Remove keyword ${kw}`)}
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={kwInput}
            onChange={(e) => setKwInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addKeyword(); }
              if (e.key === "Backspace" && !kwInput && keywords.length) {
                setKeywords((prev) => prev.slice(0, -1));
              }
            }}
            onBlur={addKeyword}
            placeholder={keywords.length === 0
              ? t("ex. mode durable, éco-mode… (Entrée pour valider)", "e.g. sustainable fashion… (Enter to confirm)")
              : t("Ajouter…", "Add…")}
            className="min-w-[180px] flex-1 bg-transparent text-sm text-ink placeholder:text-muted/50 outline-none"
            aria-label={t("Saisir un mot-clé", "Enter a keyword")}
          />
          {kwInput && (
            <button
              type="button"
              onClick={addKeyword}
              className="shrink-0 rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700 hover:bg-primary-100 transition-colors"
            >
              + {t("Ajouter", "Add")}
            </button>
          )}
        </div>

        <p className="text-xs text-muted leading-relaxed">
          {t(
            "Ces mots-clés guident l'analyse concurrentielle et alimentent la veille de marché.",
            "These keywords drive competitive analysis and feed market monitoring."
          )}
        </p>
      </section>

      {/* ── Angles IA ── */}
      <section className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ai-textbg text-ai-text">
            <BulbIcon />
          </span>
          <p className="section-label">
            {t("Angles à exploiter face à vos concurrents", "Angles to exploit against competitors")}
          </p>
        </div>

        {hasProfile && profile.competitorAngles.length > 0 ? (
          <ul className="space-y-2" role="list">
            {profile.competitorAngles.map((angle, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-ai-textbg/30 bg-ai-textbg/10 px-4 py-3"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ai-textbg text-ai-text text-2xs font-bold" aria-hidden>
                  {i + 1}
                </span>
                <p className="text-sm text-ink leading-relaxed">{angle}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-hair bg-canvas px-4 py-4 text-center space-y-1">
            <p className="text-sm text-muted">
              {t(
                "Aucun angle détecté — analysez votre identité (étape 1) pour déverrouiller ces insights.",
                "No angles detected — analyse your identity (step 1) to unlock these insights."
              )}
            </p>
            <p className="text-xs text-muted/70">
              {t(
                "L'IA déduit ces angles à partir de votre site et de vos réseaux.",
                "The AI infers these angles from your website and social accounts."
              )}
            </p>
          </div>
        )}
      </section>

      {/* ── Analyser la concurrence ── */}
      <section className="card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-label">{t("Analyse concurrentielle IA", "AI competitive analysis")}</p>
            <p className="mt-0.5 text-xs text-muted">
              {t(
                "L'IA scrape les réseaux sociaux et compare vos concurrents sur votre marché.",
                "The AI scrapes social networks and benchmarks competitors in your market."
              )}
            </p>
          </div>
          {/* Note optionnelle */}
          <span className="shrink-0 rounded-full border border-hair bg-canvas px-2.5 py-0.5 text-2xs font-medium text-muted">
            {t("optionnel", "optional")}
          </span>
        </div>

        <button
          type="button"
          onClick={handleAnalyse}
          disabled={running}
          className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          aria-busy={running}
        >
          {running ? (
            <>
              <Spinner />
              {t("Analyse concurrentielle… (jusqu'à 60s)", "Competitive analysis… (up to 60s)")}
            </>
          ) : (
            <>
              {/* Icône graphe/barres */}
              <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden>
                <rect x="1" y="8" width="3" height="5" rx="0.5" fill="currentColor" opacity="0.5" />
                <rect x="5.5" y="5" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.8" />
                <rect x="10" y="2" width="3" height="11" rx="0.5" fill="currentColor" />
              </svg>
              {t("Analyser mes concurrents avec l'IA", "Analyse my competitors with AI")}
            </>
          )}
        </button>

        {/* Erreur */}
        {runError && !running && (
          <div
            className="flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3"
            role="alert"
          >
            <svg className="mt-0.5 shrink-0 text-danger-500" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" fill="none" />
              <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-danger-700">{runError}</p>
          </div>
        )}

        {/* Résultats */}
        {runResult && !running && (
          <div className="space-y-4 animate-fade-in">

            {/* Résumé */}
            {runResult.resume && (
              <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 space-y-1">
                <p className="text-2xs font-semibold uppercase tracking-wide text-primary-500">
                  {t("Résumé de l'analyse", "Analysis summary")}
                </p>
                <p className="text-sm text-ink leading-relaxed">{runResult.resume}</p>
              </div>
            )}

            {/* Concurrents */}
            {runResult.competiteurs && runResult.competiteurs.length > 0 ? (
              <div className="space-y-2">
                <p className="section-label">{t("Concurrents détectés", "Detected competitors")}</p>
                <ol className="space-y-2" role="list">
                  {runResult.competiteurs.map((c, i) => (
                    <li
                      key={`${c.handle}-${i}`}
                      className="card p-4 space-y-2 hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Rang */}
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-canvas border border-hair text-2xs font-bold text-muted">
                            {i + 1}
                          </span>
                          <span className="font-semibold text-ink truncate">{c.handle}</span>
                          {/* Chip réseau */}
                          <span className={`rounded-full border px-2 py-0.5 text-2xs font-medium capitalize ${networkColor(c.network)}`}>
                            {c.network}
                          </span>
                        </div>
                        <ScoreBar score={c.scorePuissance} />
                      </div>
                      {/* Stratégie */}
                      {c.strategie && (
                        <p className="text-xs text-muted leading-relaxed">
                          <span className="font-medium text-ink">{t("Stratégie :", "Strategy:")}</span>{" "}
                          {c.strategie}
                        </p>
                      )}
                      {/* Pourquoi puissant */}
                      {c.pourquoiPuissant && (
                        <p className="text-xs text-muted leading-relaxed">
                          <span className="font-medium text-ink">{t("Pourquoi :", "Why:")}</span>{" "}
                          {c.pourquoiPuissant}
                        </p>
                      )}
                      {/* Format dominant */}
                      {(c.formatDominant || c.engagementMoyen !== undefined) && (
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          {c.formatDominant && (
                            <span className="rounded-full border border-hair bg-canvas px-2 py-0.5 text-2xs text-muted">
                              {t("Format :", "Format:")} {c.formatDominant}
                            </span>
                          )}
                          {c.engagementMoyen !== undefined && (
                            <span className="rounded-full border border-hair bg-canvas px-2 py-0.5 text-2xs text-muted">
                              {t("Engagement moyen :", "Avg engagement:")} {c.engagementMoyen}%
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              /* Pas de données concurrents */
              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary-200 bg-primary-50/30 px-5 py-5 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-primary-200 bg-primary-50">
                  {/* Icône loupe */}
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden className="text-primary-500">
                    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M13 13l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-ink">
                    {t("Pas encore de données concurrents", "No competitor data yet")}
                  </p>
                  <p className="text-xs text-muted">
                    {t(
                      "Connectez vos réseaux ou ouvrez la veille complète pour des analyses approfondies.",
                      "Connect your networks or open full monitoring for in-depth analysis."
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Link
                    href="/veille"
                    className="btn-secondary text-xs"
                  >
                    {t("Ouvrir la veille complète", "Open full monitoring")}
                  </Link>
                  <Link
                    href="/publicites"
                    className="btn-ghost text-xs border border-hair"
                  >
                    {t("Gérer les publicités", "Manage ads")}
                  </Link>
                </div>
              </div>
            )}

            {/* Recommandations */}
            {runResult.recommandations && runResult.recommandations.length > 0 && (
              <div className="space-y-2">
                <p className="section-label">
                  {t("Recommandations prioritaires", "Priority recommendations")}
                </p>
                <ul className="space-y-2" role="list">
                  {runResult.recommandations.slice(0, 4).map((r, i) => {
                    const c = prioriteColor(r.priorite ?? "basse");
                    return (
                      <li
                        key={i}
                        className="flex items-start gap-3 rounded-xl border border-hair bg-card px-4 py-3"
                      >
                        {/* Point priorité */}
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c.dot}`} aria-hidden />
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-ink">{r.titre}</p>
                            <span className={`rounded-full border px-2 py-0.5 text-2xs font-medium capitalize ${c.chip}`}>
                              {r.priorite}
                            </span>
                          </div>
                          {r.detail && <p className="text-xs text-muted leading-relaxed">{r.detail}</p>}
                          {r.action && (
                            <p className="text-xs text-primary-600 font-medium">→ {r.action}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Note optionnelle — lien vers veille ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hair bg-canvas px-4 py-3">
        {/* Icône info */}
        <svg className="shrink-0 text-muted" width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" fill="none" />
          <path d="M8 7v4M8 5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="text-xs text-muted">
          {t(
            "Cette étape est optionnelle — vous pouvez continuer sans analyser.",
            "This step is optional — you can continue without analysing."
          )}
          {" "}
          {t("Pour une veille approfondie, rendez-vous dans", "For deeper monitoring, head to")}{" "}
          <Link href="/veille" className="font-medium text-primary-600 hover:underline">
            {t("Veille & Marché", "Market Intelligence")}
          </Link>.
        </p>
      </div>

    </div>
  );
}
