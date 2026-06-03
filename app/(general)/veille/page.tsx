"use client";

/**
 * Page « Veille & Marché » — /veille
 *
 * Dispositif de veille & benchmark concurrentiel :
 *  1. Paramétrage : zone géo, mots-clés, thématique, compétiteurs
 *  2. Identification automatique de concurrents via Claude
 *  3. Lancement de l'analyse : collecte + IA
 *  4. Affichage des résultats : contenus, benchmark, recommandations
 */

import { useState, useCallback, useEffect } from "react";
import { useCompany } from "@/lib/company-context";
import { useScope, COUNTRIES } from "@/lib/scope";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContentCard } from "@/components/veille/ContentCard";
import { AnalysisPanel } from "@/components/veille/AnalysisPanel";
import { CompetitorItem } from "@/components/veille/CompetitorItem";
import type { Competitor } from "@/lib/repositories/competitors";
import type { CompetitorContent } from "@/lib/scraping/types";
import type { AnalysisResult } from "@/lib/scraping/analyze";
import type { IdentifiedCompetitor } from "@/app/api/veille/identify/route";
import type { ScrapeNetwork } from "@/lib/scraping/types";
import { useT } from "@/lib/i18n";

/* ─────────────────────────────────────────────────────────────────────────────
   Types locaux
───────────────────────────────────────────────────────────────────────────── */

interface RunResult {
  scrape: {
    contents: CompetitorContent[];
    realNetworks: string[];
    simulatedNetworks: string[];
    durationMs: number;
    collectedAt: string;
  };
  analysis: AnalysisResult | null;
  finishedAt: string;
}

const NETWORKS: { value: ScrapeNetwork; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok",    label: "TikTok" },
  { value: "youtube",   label: "YouTube" },
  { value: "linkedin",  label: "LinkedIn" },
  { value: "twitter",   label: "X / Twitter" },
  { value: "facebook",  label: "Facebook" },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Composant Tag Input léger
───────────────────────────────────────────────────────────────────────────── */

function TagInput({
  tags,
  onChange,
  placeholder,
  addMoreLabel,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
  placeholder?: string;
  addMoreLabel?: string;
}) {
  const [input, setInput] = useState("");

  function addTag() {
    const v = input.trim().replace(/^#/, "");
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-lg border border-hair bg-card px-3 py-2 shadow-inner-sm focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
          #{tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== tag))}
            className="ml-0.5 text-primary-400 hover:text-primary-700"
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
          if (e.key === "Backspace" && !input && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={addTag}
        placeholder={tags.length === 0 ? placeholder : (addMoreLabel ?? "Add…")}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-ink placeholder:text-muted/50 outline-none"
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Page principale
───────────────────────────────────────────────────────────────────────────── */

export default function VeillePage() {
  const t = useT();
  const { company } = useCompany();
  const { country, setCountryId } = useScope();

  // Paramétrage
  const [geo, setGeo] = useState(country.id);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [theme, setTheme] = useState("");

  // Compétiteurs
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loadingCompetitors, setLoadingCompetitors] = useState(false);
  const [addNetwork, setAddNetwork] = useState<ScrapeNetwork>("instagram");
  const [addHandle, setAddHandle] = useState("");
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Identification automatique
  const [identifying, setIdentifying] = useState(false);
  const [identified, setIdentified] = useState<IdentifiedCompetitor[]>([]);

  // Run
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  // Onglets résultats
  const [activeTab, setActiveTab] = useState<"contenus" | "analyse">("analyse");

  /* ── Chargement initial des compétiteurs ── */
  const loadCompetitors = useCallback(async () => {
    setLoadingCompetitors(true);
    try {
      const res = await fetch(`/api/veille/competitors?companyId=${company.id}`);
      if (res.ok) {
        const data = await res.json() as { competitors: Competitor[] };
        setCompetitors(data.competitors);
      }
    } catch (err) {
      console.warn("[veille] load competitors:", err);
    } finally {
      setLoadingCompetitors(false);
    }
  }, [company.id]);

  useEffect(() => { void loadCompetitors(); }, [loadCompetitors]);

  /* ── Ajout d'un compétiteur ── */
  async function handleAddCompetitor() {
    if (!addHandle.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/veille/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          network: addNetwork,
          handle: addHandle.trim(),
          name: addName.trim() || addHandle.trim(),
          source: "manuel",
        }),
      });
      if (res.ok) {
        const data = await res.json() as { competitor: Competitor };
        setCompetitors((prev) => [data.competitor, ...prev]);
        setAddHandle("");
        setAddName("");
      }
    } finally {
      setAdding(false);
    }
  }

  /* ── Ajout d'un compétiteur identifié ── */
  async function handleAddIdentified(c: IdentifiedCompetitor) {
    setAdding(true);
    try {
      const res = await fetch("/api/veille/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          network: c.network,
          handle: c.handle,
          name: c.name,
          source: "identifié",
        }),
      });
      if (res.ok) {
        const data = await res.json() as { competitor: Competitor };
        setCompetitors((prev) => [data.competitor, ...prev]);
        setIdentified((prev) => prev.filter((x) => x.handle !== c.handle));
      }
    } finally {
      setAdding(false);
    }
  }

  /* ── Suppression d'un compétiteur ── */
  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      await fetch(`/api/veille/competitors?id=${id}`, { method: "DELETE" });
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setRemovingId(null);
    }
  }

  /* ── Identification automatique des concurrents ── */
  async function handleIdentify() {
    setIdentifying(true);
    setIdentified([]);
    try {
      const res = await fetch("/api/veille/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, theme, keywords, geo }),
      });
      if (res.ok) {
        const data = await res.json() as { competitors: IdentifiedCompetitor[] };
        // Exclure ceux déjà dans la liste
        const existingHandles = new Set(competitors.map((c) => c.handle.toLowerCase()));
        setIdentified(data.competitors.filter((c) => !existingHandles.has(c.handle.toLowerCase())));
      }
    } finally {
      setIdentifying(false);
    }
  }

  /* ── Lancement de l'analyse ── */
  async function handleRun() {
    setRunning(true);
    setResult(null);
    setRunError(null);
    try {
      const res = await fetch("/api/veille/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          geo,
          keywords,
          theme,
          competitorIds: competitors.map((c) => c.id),
        }),
      });
      const data = await res.json() as RunResult & { error?: string };
      if (data.error && (!data.scrape || data.scrape.contents.length === 0)) {
        setRunError(data.error);
        return;
      }
      // Étape 1 : afficher tout de suite les contenus collectés.
      setResult(data);
      setActiveTab("analyse");

      // Étape 2 : analyse IA (Claude) séparée → ne dépasse jamais 60 s.
      setAnalyzing(true);
      try {
        const ares = await fetch("/api/veille/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: data.scrape?.contents ?? [],
            geo,
            keywords,
            theme,
          }),
        });
        if (ares.ok) {
          const adata = await ares.json() as { analysis: RunResult["analysis"] };
          setResult((prev) => (prev ? { ...prev, analysis: adata.analysis } : prev));
        }
      } catch (e) {
        console.warn("[veille analyze]", e);
      } finally {
        setAnalyzing(false);
      }
    } catch (err) {
      setRunError(t("Impossible de lancer l'analyse. Vérifiez votre connexion.", "Unable to start analysis. Check your connection."));
      console.error("[veille run]", err);
    } finally {
      setRunning(false);
    }
  }

  const hasEnough = theme.trim().length > 0 || keywords.length > 0;

  return (
    <div className="min-h-full bg-canvas">
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        <PageHeader
          title={t("Veille & Marché", "Market Intelligence")}
          actions={
            <button
              onClick={handleRun}
              disabled={running || !hasEnough}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {running ? (
                <>
                  <Spinner />
                  {t("Analyse en cours...", "Analysis in progress...")}
                </>
              ) : (
                <>
                  <BarIcon />
                  {t("Lancer l'analyse", "Run analysis")}
                </>
              )}
            </button>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
          {/* ── Panneau de paramétrage ── */}
          <aside className="space-y-4">
            {/* Zone géographique */}
            <div className="card p-4 space-y-3">
              <p className="section-label">{t("Zone géographique", "Geographic area")}</p>
              <select
                value={geo}
                onChange={(e) => {
                  setGeo(e.target.value);
                  setCountryId(e.target.value);
                }}
                className="input"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.flag} {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Thématique + mots-clés */}
            <div className="card p-4 space-y-3">
              <p className="section-label">{t("Thématique & mots-clés", "Theme & keywords")}</p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted">{t("Thématique principale", "Main theme")}</label>
                <input
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder={t("ex. Mode durable, Fintech B2B...", "e.g. Sustainable fashion, B2B Fintech...")}
                  className="input"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted">{t("Mots-clés (Entrée pour valider)", "Keywords (Enter to confirm)")}</label>
                <TagInput
                  tags={keywords}
                  onChange={setKeywords}
                  placeholder={t("ex. développement durable, éco-mode...", "e.g. sustainability, eco-fashion...")}
                  addMoreLabel={t("Ajouter...", "Add…")}
                />
              </div>
            </div>

            {/* Compétiteurs */}
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="section-label">{t("Compétiteurs à suivre", "Competitors to monitor")}</p>
                <span className="chip">{competitors.length}</span>
              </div>

              {/* Ajout manuel */}
              <div className="space-y-2">
                <select
                  value={addNetwork}
                  onChange={(e) => setAddNetwork(e.target.value as ScrapeNetwork)}
                  className="input text-xs"
                >
                  {NETWORKS.map((n) => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={addHandle}
                  onChange={(e) => setAddHandle(e.target.value)}
                  placeholder="@handle"
                  className="input"
                  onKeyDown={(e) => e.key === "Enter" && handleAddCompetitor()}
                />
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder={t("Nom affiché (optionnel)", "Display name (optional)")}
                  className="input"
                />
                <button
                  onClick={handleAddCompetitor}
                  disabled={!addHandle.trim() || adding}
                  className="btn-secondary w-full text-xs disabled:opacity-50"
                >
                  {t("+ Ajouter manuellement", "+ Add manually")}
                </button>
              </div>

              {/* Bouton Identifier */}
              <button
                onClick={handleIdentify}
                disabled={identifying || !hasEnough}
                className="btn-ghost w-full text-xs flex items-center justify-center gap-2 disabled:opacity-50 border border-hair"
              >
                {identifying
                  ? <><Spinner /> {t("Identification...", "Identifying...")}</>
                  : <><SparkleIcon /> {t("Identifier des concurrents", "Identify competitors")}</>}
              </button>

              {/* Compétiteurs identifiés */}
              {identified.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-2xs font-semibold text-muted uppercase tracking-widest">{t("Suggérés", "Suggested")}</p>
                  {identified.map((c) => (
                    <div key={c.handle} className="rounded-lg border border-dashed border-primary-200 bg-primary-50/40 p-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-ink truncate">{c.name} <span className="text-muted font-normal">{c.handle}</span></p>
                          <p className="text-2xs text-muted capitalize">{c.network}</p>
                        </div>
                        <button
                          onClick={() => handleAddIdentified(c)}
                          disabled={adding}
                          className="shrink-0 btn-primary text-2xs px-2 py-1 disabled:opacity-50"
                        >
                          {t("+ Ajouter", "+ Add")}
                        </button>
                      </div>
                      <p className="text-2xs text-muted leading-snug">{c.rationale}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Liste des compétiteurs ajoutés */}
              {loadingCompetitors ? (
                <div className="flex justify-center py-4"><Spinner /></div>
              ) : competitors.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                  <p className="text-2xs font-semibold text-muted uppercase tracking-widest">{t("Liste active", "Active list")}</p>
                  {competitors.map((c) => (
                    <CompetitorItem
                      key={c.id}
                      competitor={c}
                      onRemove={handleRemove}
                      removing={removingId === c.id}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted text-center py-2">
                  {t(
                    "Aucun compétiteur — ajoutez-en ou utilisez « Identifier ».",
                    "No competitors — add some or use \"Identify\"."
                  )}
                </p>
              )}
            </div>
          </aside>

          {/* ── Zone de résultats ── */}
          <main className="space-y-4">
            {/* État vide */}
            {!running && !result && !runError && (
              <div className="card p-12 flex flex-col items-center justify-center gap-4 text-center">
                <div className="h-14 w-14 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center">
                  <BarIcon size={24} className="text-primary-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-ink">{t("Prêt pour la veille", "Ready for monitoring")}</h3>
                  <p className="mt-1 text-sm text-muted max-w-xs">
                    {t(
                      "Configurez vos paramètres, ajoutez des compétiteurs et lancez l'analyse pour obtenir des insights concurrentiels.",
                      "Configure your settings, add competitors and run the analysis to get competitive insights."
                    )}
                  </p>
                </div>
                <button
                  onClick={handleRun}
                  disabled={!hasEnough}
                  className="btn-primary disabled:opacity-50"
                >
                  <BarIcon size={14} />
                  {t("Lancer l'analyse", "Run analysis")}
                </button>
              </div>
            )}

            {/* Chargement */}
            {running && (
              <div className="card p-12 flex flex-col items-center justify-center gap-4 text-center">
                <div className="relative">
                  <div className="h-14 w-14 rounded-full border-2 border-primary-100 border-t-primary-500 animate-spin" />
                </div>
                <div>
                  <p className="text-base font-semibold text-ink">{t("Analyse en cours...", "Analysis in progress...")}</p>
                  <p className="mt-1 text-sm text-muted">{t("Collecte des contenus concurrents et analyse par IA", "Collecting competitor content and running AI analysis")}</p>
                </div>
              </div>
            )}

            {/* Erreur */}
            {runError && !running && (
              <div className="card border-danger-200 bg-danger-50 p-4 flex items-start gap-3">
                <svg className="shrink-0 mt-0.5 text-danger-500" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" fill="none"/>
                  <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <p className="text-sm text-danger-700">{runError}</p>
              </div>
            )}

            {/* Résultats */}
            {result && !running && (
              <div className="space-y-4">
                {/* Barre de statut */}
                <div className="card p-3 flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-semibold text-ink">
                    {result.scrape.contents.length} {t("contenus collectés", "contents collected")}
                  </span>
                  <span className="text-muted">{t("en", "in")} {result.scrape.durationMs}ms</span>
                  {result.scrape.realNetworks.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-success-700 font-medium">
                      {t("Réel :", "Real:")} {result.scrape.realNetworks.join(", ")}
                    </span>
                  )}
                  {result.scrape.simulatedNetworks.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-warning-700 font-medium">
                      {t("Simulé :", "Simulated:")} {result.scrape.simulatedNetworks.join(", ")}
                    </span>
                  )}
                  <button
                    onClick={handleRun}
                    className="ml-auto btn-ghost text-xs border border-hair"
                  >
                    {t("Relancer", "Re-run")}
                  </button>
                </div>

                {/* Onglets */}
                <div className="flex gap-1 border-b border-hair">
                  {[
                    { key: "analyse" as const, labelFr: "Analyse IA", labelEn: "AI Analysis" },
                    { key: "contenus" as const, labelFr: `Contenus (${result.scrape.contents.length})`, labelEn: `Content (${result.scrape.contents.length})` },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={[
                        "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                        activeTab === tab.key
                          ? "border-page text-ink"
                          : "border-transparent text-muted hover:text-ink",
                      ].join(" ")}
                    >
                      {t(tab.labelFr, tab.labelEn)}
                    </button>
                  ))}
                </div>

                {/* Contenus */}
                {activeTab === "contenus" && (
                  <div>
                    {result.scrape.contents.length === 0 ? (
                      <div className="card p-8 text-center">
                        <p className="text-sm text-muted">{t("Aucun contenu collecté pour cette requête.", "No content collected for this query.")}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {result.scrape.contents.map((c, i) => (
                          <ContentCard key={i} content={c} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Analyse IA */}
                {activeTab === "analyse" && (
                  <div>
                    {result.analysis ? (
                      <AnalysisPanel analysis={result.analysis} />
                    ) : analyzing ? (
                      <div className="card flex items-center justify-center gap-3 p-8">
                        <Spinner />
                        <p className="text-sm text-muted">{t("Analyse IA en cours…", "AI analysis in progress…")}</p>
                      </div>
                    ) : (
                      <div className="card p-8 text-center">
                        <p className="text-sm text-muted">{t("Analyse IA non disponible pour cette exécution.", "AI analysis not available for this run.")}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Micro-composants
───────────────────────────────────────────────────────────────────────────── */

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" fill="none"/>
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function BarIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className} aria-hidden="true">
      <rect x="1"   y="8"  width="3" height="5" rx="0.5" fill="currentColor" opacity="0.5"/>
      <rect x="5.5" y="5"  width="3" height="8" rx="0.5" fill="currentColor" opacity="0.8"/>
      <rect x="10"  y="2"  width="3" height="11" rx="0.5" fill="currentColor"/>
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M6.5 1 7.3 4.8 11 5.5 7.3 6.2 6.5 10 5.7 6.2 2 5.5 5.7 4.8Z" fill="currentColor"/>
      <path d="M10.5 9l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L9 11l1.5-.5Z" fill="currentColor" opacity="0.6"/>
    </svg>
  );
}
