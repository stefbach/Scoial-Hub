"use client";

// ── Mes Pages & données ──────────────────────────────────────────────────────
// Sélecteur de Page Facebook (sociétés multi-Pages) + données réelles de la
// Page sélectionnée et du compte Instagram lié (abonnés, posts, engagement).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import MetaAdsPublisher from "@/components/ads/MetaAdsPublisher";
import { OrganicPublisher } from "@/components/meta/OrganicPublisher";

interface PageItem {
  id: string;
  name: string;
  igUsername: string | null;
  hasInstagram: boolean;
  picture: string | null;
  fanCount: number | null;
}
interface PagesResp {
  pages: PageItem[];
  selectedPageId: string | null;
  needsReconnect: boolean;
}
interface Post {
  id: string;
  message: string;
  url?: string;
  image?: string;
  createdAt?: string;
  likes?: number;
  comments?: number;
}
interface Insights {
  connected: boolean;
  facebook?: { name: string; fanCount: number; followers: number; picture?: string };
  instagram?: { username: string; followers: number; mediaCount: number; picture?: string };
  facebookPosts: Post[];
  instagramPosts: Post[];
}
interface Analysis {
  synthese: string;
  pointsForts: string[];
  aAmeliorer: string[];
  formatsGagnants: string[];
  cadenceRecommandee: string;
  ideesContenu: { titre: string; angle: string }[];
  actions: { priorite: "haute" | "moyenne" | "basse"; action: string }[];
  aiGenerated: boolean;
}

const nf = (n: number) => n.toLocaleString("fr-FR");

export default function PagesMetaPage() {
  const t = useT();
  const { company } = useCompany();
  const companyId = company.id;

  const [pages, setPages] = useState<PagesResp | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pubTab, setPubTab] = useState<"organic" | "ads">("organic");

  const load = useCallback(async () => {
    setLoading(true);
    const [p, i] = await Promise.all([
      fetch(`/api/meta/pages?companyId=${encodeURIComponent(companyId)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/meta/insights?companyId=${encodeURIComponent(companyId)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    setPages(p);
    setInsights(i);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function selectPage(pageId: string) {
    setSwitching(pageId);
    setAnalysis(null);
    setPageError(null);
    try {
      const res = await fetch("/api/meta/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, pageId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setPageError(
          data?.error ||
            t(
              `Impossible de sélectionner cette Page (erreur ${res.status}).`,
              `Could not select this Page (error ${res.status}).`
            )
        );
        return;
      }
      await load();
    } catch (e) {
      setPageError(
        e instanceof Error
          ? e.message
          : t("Impossible de sélectionner cette Page.", "Could not select this Page.")
      );
    } finally {
      setSwitching(null);
    }
  }

  async function runAnalyze() {
    setAnalyzing(true);
    setPageError(null);
    try {
      const res = await fetch("/api/meta/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) {
        setPageError(
          data?.error ||
            t(
              `L'analyse IA a échoué (erreur ${res.status}). Réessayez.`,
              `The AI analysis failed (error ${res.status}). Please try again.`
            )
        );
        return;
      }
      if (data?.analysis) {
        setAnalysis(data.analysis as Analysis);
      } else {
        setPageError(
          t(
            "L'analyse n'a renvoyé aucun résultat. Réessayez.",
            "The analysis returned no result. Please try again."
          )
        );
      }
    } catch (e) {
      setPageError(
        e instanceof Error
          ? e.message
          : t("L'analyse IA a échoué. Réessayez.", "The AI analysis failed. Please try again.")
      );
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <header>
        <p className="section-label text-primary-500">{t("Pages & données", "Pages & data")}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
          {t("Vos Pages connectées", "Your connected Pages")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          {t(
            "Choisissez la Page Facebook à piloter pour cette société (votre compte en gère plusieurs) et consultez ses données réelles.",
            "Pick the Facebook Page to manage for this company (your account manages several) and view its real data."
          )}
        </p>
      </header>

      {pageError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-danger-500/30 bg-danger-50 px-4 py-3 text-sm text-danger-700"
        >
          <span className="min-w-0 break-words">{pageError}</span>
          <button
            type="button"
            onClick={() => setPageError(null)}
            aria-label={t("Fermer", "Dismiss")}
            className="shrink-0 text-danger-500 hover:text-danger-700"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {loading ? (
        <div className="card flex items-center justify-center p-12 text-sm text-muted">
          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-hair border-t-primary" />
          {t("Chargement…", "Loading…")}
        </div>
      ) : pages?.needsReconnect || !pages ? (
        <div className="card p-6 text-center">
          <p className="text-sm font-semibold text-ink">{t("Aucune connexion Meta active", "No active Meta connection")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            {t(
              "Connectez Facebook/Instagram pour voir vos Pages et leurs données.",
              "Connect Facebook/Instagram to see your Pages and their data."
            )}
          </p>
          <Link href="/demarrage" className="btn-primary mt-4 inline-flex">{t("Connecter mes comptes", "Connect my accounts")}</Link>
        </div>
      ) : (
        <>
          {/* ── Données réelles de la Page sélectionnée ── */}
          {insights?.connected && (insights.facebook || insights.instagram) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {insights.facebook && (
                <StatCard
                  tone="facebook"
                  title={insights.facebook.name}
                  subtitle="Facebook"
                  picture={insights.facebook.picture}
                  stats={[
                    { label: t("Abonnés", "Followers"), value: nf(insights.facebook.followers) },
                    { label: "Fans", value: nf(insights.facebook.fanCount) },
                  ]}
                />
              )}
              {insights.instagram && (
                <StatCard
                  tone="instagram"
                  title={`@${insights.instagram.username}`}
                  subtitle="Instagram"
                  picture={insights.instagram.picture}
                  stats={[
                    { label: t("Abonnés", "Followers"), value: nf(insights.instagram.followers) },
                    { label: t("Publications", "Posts"), value: nf(insights.instagram.mediaCount) },
                  ]}
                />
              )}
            </div>
          )}

          {/* ── Analyse IA pour optimiser la suite ── */}
          {insights?.connected && (insights.facebook || insights.instagram) && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="section-label text-ai-text">{t("Optimisation IA", "AI optimization")}</div>
                  <p className="mt-0.5 text-xs text-muted">
                    {t(
                      "L'IA analyse vos contenus et leur engagement pour recommander la suite.",
                      "The AI analyses your content and its engagement to recommend what's next."
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={runAnalyze}
                  disabled={analyzing}
                  className="btn-primary inline-flex w-full items-center justify-center gap-2 disabled:opacity-50 sm:w-auto"
                >
                  {analyzing ? (
                    <>
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      {t("Analyse en cours…", "Analyzing…")}
                    </>
                  ) : (
                    <>
                      <SparkIcon />
                      {analysis ? t("Ré-analyser", "Re-analyze") : t("Analyser cette Page avec l'IA", "Analyze this Page with AI")}
                    </>
                  )}
                </button>
              </div>
              {analysis && <AnalysisReport a={analysis} t={t} />}
            </section>
          )}

          {/* ── Sélecteur de Page ── */}
          <section className="space-y-3">
            <div className="section-label">{t("Choisir la Page de cette société", "Choose this company's Page")}</div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {pages.pages.map((p) => {
                const selected = p.id === pages.selectedPageId;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 rounded-2xl border p-4 transition-all ${
                      selected ? "border-primary-400 bg-primary-50 ring-2 ring-primary-200" : "border-hair bg-card hover:border-primary-200"
                    }`}
                  >
                    {p.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.picture} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-bold text-muted">
                        {p.name.slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                      <p className="truncate text-2xs text-muted">
                        {p.fanCount != null ? `${nf(p.fanCount)} fans` : ""}
                        {p.hasInstagram ? ` · IG @${p.igUsername}` : ` · ${t("pas d'Instagram lié", "no linked Instagram")}`}
                      </p>
                    </div>
                    {selected ? (
                      <span className="shrink-0 rounded-full bg-primary-100 px-2.5 py-1 text-2xs font-bold text-primary-700">
                        {t("Sélectionnée", "Selected")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => selectPage(p.id)}
                        disabled={switching === p.id}
                        className="btn-secondary shrink-0 text-xs disabled:opacity-50"
                      >
                        {switching === p.id ? "…" : t("Utiliser", "Use")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Posts récents ── */}
          <PostsSection title={t("Publications Facebook récentes", "Recent Facebook posts")} posts={insights?.facebookPosts ?? []} t={t} />
          <PostsSection title={t("Publications Instagram récentes", "Recent Instagram posts")} posts={insights?.instagramPosts ?? []} t={t} />
        </>
      )}

      {/* ── Publier : publication normale (organique) OU via Ads ── */}
      <section className="space-y-3">
        <div>
          <div className="section-label text-primary-500">{t("Publier", "Publish")}</div>
          <p className="mt-0.5 text-xs text-muted">
            {t(
              "Deux façons de publier sur cette Page : une publication normale (gratuite, à vos abonnés) ou une publicité (payante, ciblée).",
              "Two ways to publish on this Page: a normal post (free, to your followers) or an ad (paid, targeted)."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {([
            { id: "organic", fr: "Publication normale", en: "Normal post" },
            { id: "ads", fr: "Publication via Ads", en: "Publish via Ads" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPubTab(tab.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${pubTab === tab.id ? "bg-ink text-white" : "bg-canvas text-muted hover:text-ink"}`}
            >
              {t(tab.fr, tab.en)}
            </button>
          ))}
        </div>

        {pubTab === "organic" ? (
          <div className="card p-5">
            <OrganicPublisher />
          </div>
        ) : (
          <MetaAdsPublisher />
        )}
      </section>
    </div>
  );
}

function StatCard({
  tone,
  title,
  subtitle,
  picture,
  stats,
}: {
  tone: "facebook" | "instagram";
  title: string;
  subtitle: string;
  picture?: string;
  stats: { label: string; value: string }[];
}) {
  const color = tone === "facebook" ? "text-platform-facebook" : "text-platform-instagram";
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        {picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={picture} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <span className={`flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-lg font-bold ${color}`}>
            {title.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{title}</p>
          <p className={`text-2xs font-semibold uppercase tracking-wide ${color}`}>{subtitle}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {stats.map((sx) => (
          <div key={sx.label} className="rounded-xl bg-canvas px-3 py-2.5">
            <div className="text-lg font-bold text-ink">{sx.value}</div>
            <div className="text-2xs text-muted">{sx.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" aria-hidden="true">
      <path d="M7.5 1 8.5 5.5 13 6.5 8.5 7.5 7.5 12 6.5 7.5 2 6.5 6.5 5.5Z" />
    </svg>
  );
}

function AnalysisReport({ a, t }: { a: Analysis; t: (fr: string, en: string) => string }) {
  const prioColor: Record<string, string> = {
    haute: "bg-danger-50 text-danger-700 ring-danger-200",
    moyenne: "bg-warning-50 text-warning-700 ring-warning-200",
    basse: "bg-canvas text-muted ring-hair",
  };
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Synthèse */}
      <div className="card border-l-4 border-ai-text p-5">
        <div className="flex items-center gap-2">
          <span className="section-label text-ai-text">{t("Synthèse", "Summary")}</span>
          {a.aiGenerated ? (
            <span className="rounded-full bg-ai-textbg px-2 py-0.5 text-2xs font-semibold text-ai-text">IA</span>
          ) : (
            <span className="rounded-full border border-hair bg-canvas px-2 py-0.5 text-2xs font-medium text-muted">{t("estimation", "estimate")}</span>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink">{a.synthese}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {a.pointsForts.length > 0 && (
          <ListCard title={t("Points forts", "Strengths")} items={a.pointsForts} tone="success" />
        )}
        {a.aAmeliorer.length > 0 && (
          <ListCard title={t("À améliorer", "To improve")} items={a.aAmeliorer} tone="warning" />
        )}
      </div>

      {/* Formats + cadence */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {a.formatsGagnants.length > 0 && (
          <div className="card p-5">
            <div className="section-label">{t("Formats gagnants", "Winning formats")}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {a.formatsGagnants.map((f) => (
                <span key={f} className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">{f}</span>
              ))}
            </div>
          </div>
        )}
        {a.cadenceRecommandee && (
          <div className="card p-5">
            <div className="section-label">{t("Cadence recommandée", "Recommended cadence")}</div>
            <p className="mt-2 text-sm text-ink">{a.cadenceRecommandee}</p>
          </div>
        )}
      </div>

      {/* Idées de contenu */}
      {a.ideesContenu.length > 0 && (
        <div className="card p-5">
          <div className="section-label">{t("Idées de contenu", "Content ideas")}</div>
          <ul className="mt-3 space-y-2.5">
            {a.ideesContenu.map((idea, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-2xs font-bold text-primary-700">{i + 1}</span>
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-ink">{idea.titre}</p>
                  <p className="break-words text-xs text-muted">{idea.angle}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {a.actions.length > 0 && (
        <div className="card p-5">
          <div className="section-label">{t("Prochaines actions", "Next actions")}</div>
          <ul className="mt-3 space-y-2">
            {a.actions.map((act, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold uppercase ring-1 ${prioColor[act.priorite] ?? prioColor.basse}`}>
                  {act.priorite}
                </span>
                <span className="min-w-0 break-words text-sm text-ink">{act.action}</span>
              </li>
            ))}
          </ul>
          <Link href="/demarrage?new=1" className="btn-primary mt-4 inline-flex text-sm">
            {t("Lancer une campagne basée sur ces recommandations", "Launch a campaign based on these recommendations")}
          </Link>
        </div>
      )}
    </div>
  );
}

function ListCard({ title, items, tone }: { title: string; items: string[]; tone: "success" | "warning" }) {
  const dot = tone === "success" ? "bg-success-500" : "bg-warning-500";
  return (
    <div className="card p-5">
      <div className="section-label">{title}</div>
      <ul className="mt-2 space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span className="min-w-0 break-words text-sm text-ink">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PostsSection({ title, posts, t }: { title: string; posts: Post[]; t: (fr: string, en: string) => string }) {
  if (posts.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="section-label">{title}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <a
            key={p.id}
            href={p.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="card overflow-hidden transition-shadow hover:shadow-md"
          >
            {p.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt="" className="h-40 w-full object-cover" />
            )}
            <div className="p-3">
              <p className="line-clamp-3 text-xs leading-relaxed text-ink">{p.message || t("(sans texte)", "(no caption)")}</p>
              <div className="mt-2 flex items-center gap-3 text-2xs text-muted">
                {p.createdAt && <span>{new Date(p.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>}
                {p.likes != null && <span>♥ {nf(p.likes)}</span>}
                {p.comments != null && <span>💬 {nf(p.comments)}</span>}
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
