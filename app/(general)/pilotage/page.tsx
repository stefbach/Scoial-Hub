"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCompany } from "@/lib/company-context";
import { AgentLauncher } from "@/components/agents/AgentLauncher";
import { useScope } from "@/lib/scope";
import { useT } from "@/lib/i18n";
import {
  computeNetworkKpis,
  aggregateKpis,
  computeBenchmark,
  generateDecisions,
  generateAlerts,
  type Decision,
  type NetworkKpis,
  type Network,
} from "@/lib/pilotage";

/* ── Types veille (miroir du endpoint GET /api/veille/latest) ─────────── */
interface VeilleInsight {
  id: string;
  type: "format" | "angle" | "benchmark";
  label: string;
  detail: string;
  reseau?: string;
}
interface VeilleReco {
  id: string;
  priorite: "haute" | "moyenne" | "basse";
  titre: string;
  detail: string;
  action: string;
}
interface VeilleData {
  runId: string | null;
  finishedAt: string;
  simulated: boolean;
  resume: string;
  insights: VeilleInsight[];
  recommandations: VeilleReco[];
}

const NET_LABEL: Record<Network, { label: string; color: string }> = {
  facebook: { label: "Facebook", color: "#1877F2" },
  instagram: { label: "Instagram", color: "#E1306C" },
  linkedin: { label: "LinkedIn", color: "#0A66C2" },
};

const AGENT_LABEL: Record<string, string> = {
  strategist: "Stratège", copywriter: "Copywriter", creative: "Creative",
  media_buyer: "Media Buyer", analyst: "Analyste", compliance: "Conformité",
};

function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
  return String(n);
}

export default function PilotagePage() {
  const { company } = useCompany();
  const { country, range } = useScope();
  const market = country.label;
  const days = range ? Math.max(1, Math.round((+range.to - +range.from) / 86400000)) : 30;

  const t = useT();
  const [autonomy, setAutonomy] = useState(1);
  const [objective, setObjective] = useState("");
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Objectif global depuis la config d'entité (tunnel admin) si présent
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`sh_entity_config_${company.id}`);
      if (raw) {
        const cfg = JSON.parse(raw);
        if (cfg.objectifGlobal) setObjective(cfg.objectifGlobal);
      }
    } catch { /* ignore */ }
    if (!objective) setObjective(`Développer la notoriété et l'acquisition de ${company.name} sur ${market}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  const kpis = useMemo(() => computeNetworkKpis(company.id, market, days), [company.id, market, days]);
  const agg = useMemo(() => aggregateKpis(kpis), [kpis]);
  const bench = useMemo(() => computeBenchmark(company.id, market, kpis), [company.id, market, kpis]);
  const alerts = useMemo(() => generateAlerts(company.id, market, kpis), [company.id, market, kpis]);

  const [decisions, setDecisions] = useState<Decision[]>([]);
  useEffect(() => { setDecisions(generateDecisions(company.id, market)); }, [company.id, market]);

  /* ── Insights de veille ────────────────────────────────────────────── */
  const [veille, setVeille] = useState<VeilleData | null>(null);
  const [veilleLoading, setVeilleLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setVeilleLoading(true);
    fetch(`/api/veille/latest?companyId=${encodeURIComponent(company.id)}`)
      .then((r) => r.json())
      .then((data: VeilleData) => {
        if (!alive) return;
        setVeille(data);
        // Injecter les recommandations veille dans la file de décisions
        const recoDecisions: Decision[] = (data.recommandations ?? []).map(
          (r): Decision => ({
            id: `veille-${r.id}`,
            agent: "analyst",
            title: r.titre,
            rationale: `${r.detail}${r.action ? " — Action : " + r.action : ""}`,
            impact: `Priorité veille : ${r.priorite}`,
            status: "pending",
          })
        );
        if (recoDecisions.length > 0) {
          setDecisions((ds) => {
            // Éviter les doublons si l'effet se rejoue
            const existingIds = new Set(ds.map((d) => d.id));
            const toAdd = recoDecisions.filter((d) => !existingIds.has(d.id));
            return toAdd.length > 0 ? [...toAdd, ...ds] : ds;
          });
        }
      })
      .catch((err) => console.warn("[Pilotage] Veille fetch error:", err))
      .finally(() => { if (alive) setVeilleLoading(false); });
    return () => { alive = false; };
  }, [company.id]);

  // Performance publicitaire RÉELLE (Meta, 30 j) — données concrètes et utiles.
  const [ads, setAds] = useState<{ spend: number; impressions: number; clicks: number; conversions: number; currency: string; count: number } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/meta/adaccounts?companyId=${encodeURIComponent(company.id)}&datePreset=last_30d`)
      .then((r) => r.json())
      .then((d) => {
        const camps = d?.data?.campaigns as Array<{ spend: number; impressions: number; clicks: number; conversions: number; currency?: string }> | undefined;
        if (!alive || !Array.isArray(camps) || camps.length === 0) return;
        const sum = camps.reduce((a, c) => ({ spend: a.spend + (c.spend || 0), impressions: a.impressions + (c.impressions || 0), clicks: a.clicks + (c.clicks || 0), conversions: a.conversions + (c.conversions || 0) }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
        setAds({ ...sum, currency: camps[0]?.currency || "EUR", count: camps.length });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [company.id]);

  // KPIs organiques RÉELS (Facebook + Instagram) via /api/meta/insights.
  const [realKpi, setRealKpi] = useState<{ followers: number; likes: number; comments: number; engagementRate: number; reach?: number; views?: number; perNet: { net: string; followers: number; engagementRate: number }[] } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/meta/insights?companyId=${encodeURIComponent(company.id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.connected) return;
        const fbF = Number(d.facebook?.followers ?? d.facebook?.fanCount ?? 0);
        const igF = Number(d.instagram?.followers ?? 0);
        const fbPosts = (d.facebookPosts ?? []) as Array<{ likes?: number; comments?: number; shares?: number }>;
        const igPosts = (d.instagramPosts ?? []) as Array<{ likes?: number; comments?: number; shares?: number }>;
        const sumEng = (ps: typeof fbPosts) => ps.reduce((a, p) => a + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0), 0);
        const likes = [...fbPosts, ...igPosts].reduce((a, p) => a + (p.likes ?? 0), 0);
        const comments = [...fbPosts, ...igPosts].reduce((a, p) => a + (p.comments ?? 0), 0);
        const rate = (f: number, ps: typeof fbPosts) => (f && ps.length ? +((sumEng(ps) / ps.length / f) * 100).toFixed(2) : 0);
        const perNet = [
          ...(d.facebook ? [{ net: "Facebook", followers: fbF, engagementRate: rate(fbF, fbPosts) }] : []),
          ...(d.instagram ? [{ net: "Instagram", followers: igF, engagementRate: rate(igF, igPosts) }] : []),
        ];
        const totFollowers = fbF + igF;
        const totRate = perNet.length ? +(perNet.reduce((a, n) => a + n.engagementRate, 0) / perNet.length).toFixed(2) : 0;
        if (totFollowers > 0 || likes > 0) setRealKpi({ followers: totFollowers, likes, comments, engagementRate: totRate, reach: Number(d.reach ?? 0) || undefined, views: Number(d.views ?? 0) || undefined, perNet });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [company.id]);

  const setStatus = (id: string, status: Decision["status"]) =>
    setDecisions((ds) => ds.map((d) => (d.id === id ? { ...d, status } : d)));

  async function runCycle() {
    setRunning(true);
    setToast(null);
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective,
          companyId: company.id,
          brandVoice: company.brandVoice,
          autonomy,
          benchmarkTarget: `concurrents ${market}`,
        }),
      });
      const data = await res.json();
      const reco: Decision = {
        id: `live-${Date.now()}`,
        agent: "strategist",
        title: t("Nouveau cycle de pilotage exécuté", "New steering cycle executed"),
        rationale: data?.complianceVerdict === "block"
          ? t("Contenu bloqué par la conformité — révision nécessaire.", "Content blocked by compliance — revision required.")
          : t("Les agents ont produit une recommandation prête à valider.", "The agents have produced a recommendation ready for review."),
        impact: data?.finalOutput ? String(data.finalOutput).slice(0, 120) + "…" : t("Voir le centre Agents pour le détail.", "See the Agents center for details."),
        status: "pending",
      };
      setDecisions((ds) => [reco, ...ds]);
      setToast(t("Cycle de pilotage terminé — nouvelle recommandation ajoutée.", "Steering cycle completed — new recommendation added."));
    } catch {
      setToast(t("Erreur lors du cycle. Réessayez.", "Cycle error. Please try again."));
    } finally {
      setRunning(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  const pending = decisions.filter((d) => d.status === "pending").length;

  // Données réelles non encore disponibles (lib/pilotage renvoie des 0/[]).
  // On affiche des états vides explicites au lieu de cartes/KPIs à « 0 ».
  const hasKpiData = agg.followers > 0 || agg.reach > 0 || agg.views > 0 || agg.engagementRate > 0;
  const hasNetworkData = kpis.some((k) => k.followers > 0 || k.engagementRate > 0);

  return (
    <div className="animate-fade-in space-y-6">
      {/* ── Liens rapides : le pilotage relie tous les outils ──────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          ["/veille", t("Veille", "Watch")],
          ["/agents", t("Agents", "Agents")],
          ["/campaigns", t("Campagnes", "Campaigns")],
          ["/ad-performance", t("Performance Ads", "Ad Performance")],
          ["/inbox", t("Messagerie", "Inbox")],
          ["/media", t("Médiathèque", "Media")],
          ["/compose", "Compose"],
        ] as [string, string][]).map(([href, label]) => (
          <Link key={href} href={href} className="rounded-full border border-hair bg-card px-3 py-1 text-xs text-ink hover:border-primary-300 hover:text-primary-700">
            {label} →
          </Link>
        ))}
      </div>

      {/* Agent IA lançable directement depuis le centre de pilotage */}
      <AgentLauncher context={t("Centre de pilotage", "Steering center")} defaultObjective={t("Définir et lancer la stratégie social media", "Define and launch the social media strategy")} />

      {/* Performance publicitaire réelle (Meta, 30 j) — données concrètes */}
      {ads && (
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="section-label">{t("Performance pub · Meta (30 j)", "Ad performance · Meta (30d)")}</span>
            <Link href="/ad-performance" className="text-2xs text-primary-600 hover:underline">{t("Détail →", "Details →")}</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><div className="text-2xs text-muted">{t("Dépense", "Spend")}</div><div className="text-lg font-bold text-ink">{ads.spend >= 1000 ? Math.round(ads.spend).toLocaleString("fr-FR") : ads.spend.toFixed(2)} {ads.currency}</div></div>
            <div><div className="text-2xs text-muted">Impressions</div><div className="text-lg font-bold text-ink">{ads.impressions.toLocaleString("fr-FR")}</div></div>
            <div><div className="text-2xs text-muted">{t("Clics", "Clicks")}</div><div className="text-lg font-bold text-ink">{ads.clicks.toLocaleString("fr-FR")}</div></div>
            <div><div className="text-2xs text-muted">{t("Conversions", "Conversions")}</div><div className="text-lg font-bold text-ink">{ads.conversions.toLocaleString("fr-FR")}</div></div>
          </div>
          <p className="mt-1.5 text-2xs text-muted">{ads.count} {t("campagne(s) · données réelles", "campaign(s) · real data")}</p>
        </div>
      )}

      {/* ── Bandeau stratégie ──────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="border-b border-hair bg-canvas/60 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-success-500" />
              <span className="section-label truncate text-ink">{t("Centre de pilotage", "Steering center")} · {company.name}</span>
            </div>
            <span className="chip shrink-0">{country.flag} {market} · {days} {t("j", "d")}</span>
          </div>
        </div>
        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_auto]">
          <div>
            <label className="section-label mb-1 block text-muted">{t("Objectif global", "Global objective")}</label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={2}
              className="input resize-none"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-2xs font-medium uppercase tracking-wide text-muted">{t("Autonomie", "Autonomy")}</span>
              {[1, 2, 3].map((lvl) => {
                const selected = autonomy === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setAutonomy(lvl)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-2xs font-medium transition-colors ${
                      selected
                        ? "border-page bg-page text-white hover:bg-page hover:border-page"
                        : "border-hair bg-canvas text-ink hover:bg-white/[0.06] hover:border-page/50"
                    }`}
                  >
                    {t("Niv.", "Lvl.")} {lvl} {lvl === 1 ? t("· Reco", "· Reco") : lvl === 2 ? t("· Semi", "· Semi") : t("· Auto", "· Auto")}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col justify-end gap-2">
            <button onClick={runCycle} disabled={running} className="btn-primary w-full md:w-auto">
              {running ? t("Pilotage en cours…", "Running cycle…") : t("▶ Lancer un cycle de pilotage", "▶ Start a steering cycle")}
            </button>
            <span className="text-center text-2xs text-muted">{pending} {t("décision(s) à valider", "decision(s) to review")}</span>
          </div>
        </div>
        {toast && <div className="border-t border-hair bg-success-50 px-5 py-2 text-sm text-success-700">{toast}</div>}
      </div>

      {/* ── KPIs agrégés ───────────────────────────────── */}
      <section>
        <div className="section-label mb-2.5">{t("Indicateurs clés · tous réseaux", "Key metrics · all networks")}</div>
        {realKpi ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Kpi label={t("Abonnés", "Followers")} value={fmt(realKpi.followers)} />
              <Kpi label={t("Engagement moyen", "Avg. engagement")} value={`${realKpi.engagementRate}%`} accent />
              <Kpi label={t("Likes (récents)", "Likes (recent)")} value={fmt(realKpi.likes)} />
              <Kpi label={t("Commentaires (récents)", "Comments (recent)")} value={fmt(realKpi.comments)} />
              {typeof realKpi.reach === "number" && <Kpi label={t("Portée (28 j)", "Reach (28d)")} value={fmt(realKpi.reach)} />}
              {typeof realKpi.views === "number" && <Kpi label={t("Vues (28 j)", "Views (28d)")} value={fmt(realKpi.views)} />}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {realKpi.perNet.map((n) => (
                <span key={n.net} className="rounded-full border border-hair bg-card px-3 py-1 text-2xs text-ink">
                  {n.net} · {fmt(n.followers)} {t("abonnés", "followers")} · {n.engagementRate}% {t("eng.", "eng.")}
                </span>
              ))}
              <span className="self-center text-2xs text-muted">{t("Données réelles · posts récents", "Real data · recent posts")}</span>
            </div>
          </>
        ) : hasKpiData ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label={t("Abonnés", "Followers")} value={fmt(agg.followers)} />
            <Kpi label={t("Engagement", "Engagement")} value={`${agg.engagementRate}%`} accent />
            <Kpi label={t("Likes", "Likes")} value={fmt(agg.likes)} />
            <Kpi label={t("Commentaires", "Comments")} value={fmt(agg.comments)} />
            <Kpi label={t("Vues", "Views")} value={fmt(agg.views)} />
            <Kpi label={t("Portée", "Reach")} value={fmt(agg.reach)} />
          </div>
        ) : (
          <EmptyState
            title={t("Aucune statistique pour l'instant", "No statistics yet")}
            detail={t(
              "Vos indicateurs (abonnés, engagement, portée…) s'afficheront ici dès la connexion de vos comptes Meta / LinkedIn.",
              "Your metrics (followers, engagement, reach…) will appear here once your Meta / LinkedIn accounts are connected."
            )}
          />
        )}
      </section>

      {/* ── Insights de veille ─────────────────────────────────────────── */}
      <section>
        <div className="section-label mb-2.5 flex items-center gap-2">
          {t("Insights de veille concurrentielle", "Competitive intelligence insights")}
          {veilleLoading && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-page/50" />}
          {veille && (
            <span className="chip">
              {veille.simulated ? t("simulé", "simulated") : `run ${new Date(veille.finishedAt).toLocaleDateString("fr-FR")}`}
            </span>
          )}
        </div>

        {!veille && !veilleLoading && (
          <div className="card p-4 text-sm text-muted">{t("Aucune donnée de veille disponible.", "No intelligence data available.")}</div>
        )}

        {veille && (
          <div className="space-y-3">
            {/* Résumé exécutif */}
            <div className="card border-l-[3px] border-l-page/40 bg-page/5 p-4">
              <p className="text-sm text-ink">{veille.resume}</p>
            </div>

            {/* Insights concurrents (2-3 cartes) */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {veille.insights.map((insight) => (
                <div key={insight.id} className="card p-3.5">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-md bg-canvas px-1.5 py-0.5 text-2xs font-semibold uppercase text-muted ring-1 ring-hair">
                      {insight.type === "format" ? t("Format", "Format") : insight.type === "angle" ? t("Angle", "Angle") : t("Benchmark", "Benchmark")}
                    </span>
                    {insight.reseau && (
                      <span
                        className="text-2xs font-medium"
                        style={{
                          color:
                            insight.reseau === "instagram" ? "#E1306C"
                            : insight.reseau === "linkedin" ? "#0A66C2"
                            : insight.reseau === "facebook" ? "#1877F2"
                            : undefined,
                        }}
                      >
                        {insight.reseau}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-ink">{insight.label}</div>
                  <p className="mt-1 text-2xs text-muted">{insight.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── File de décisions ────────────────────────── */}
        <section className="lg:col-span-2">
          <div className="section-label mb-2.5">{t("Recommandations des agents — à valider", "Agent recommendations — to review")}</div>
          <div className="space-y-2.5">
            {decisions.map((d) => (
              <div key={d.id} className={`card p-4 ${d.status !== "pending" ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-page/10 px-1.5 py-0.5 text-2xs font-semibold text-page">
                        {AGENT_LABEL[d.agent] ?? d.agent}
                      </span>
                      {d.channel && d.channel !== "sea" && (
                        <span className="text-2xs" style={{ color: NET_LABEL[d.channel as Network].color }}>
                          {NET_LABEL[d.channel as Network].label}
                        </span>
                      )}
                      {d.channel === "sea" && <span className="text-2xs text-warning-600">SEA</span>}
                    </div>
                    <div className="break-words font-semibold text-ink">{d.title}</div>
                    <p className="mt-1 break-words text-sm text-muted">{d.rationale}</p>
                    <p className="mt-1.5 break-words text-2xs font-medium text-success-700">{t("Impact estimé", "Estimated impact")} : {d.impact}</p>
                  </div>
                  {d.status === "pending" ? (
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button onClick={() => setStatus(d.id, "approved")} className="btn-primary px-3 py-1 text-2xs">{t("Valider", "Approve")}</button>
                      <button onClick={() => setStatus(d.id, "rejected")} className="btn-ghost px-3 py-1 text-2xs">{t("Ignorer", "Dismiss")}</button>
                    </div>
                  ) : (
                    <span className={`shrink-0 text-2xs font-semibold ${d.status === "approved" ? "text-success-700" : "text-muted"}`}>
                      {d.status === "approved" ? t("✓ Validé", "✓ Approved") : t("Ignoré", "Dismissed")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Colonne droite : benchmark + alertes + réseaux ── */}
        <div className="space-y-6">
          <section>
            <div className="section-label mb-2.5">{t("Benchmark marché", "Market benchmark")} · {market}</div>
            {bench.length > 0 ? (
              <div className="card divide-y divide-hair">
                {bench.map((b) => (
                  <div key={b.label} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="min-w-0 truncate text-muted">{b.label}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-semibold text-ink">{b.you}{b.unit}</span>
                      <span className="text-2xs text-muted">{t("vs", "vs")} {b.market}{b.unit}</span>
                      <span className={b.better ? "text-success-600" : "text-danger-600"}>{b.better ? "▲" : "▼"}</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title={t("Pas encore de benchmark", "No benchmark yet")}
                detail={t(
                  "Données disponibles dès vos premières campagnes / connexion. Nous comparerons alors vos performances au marché de votre zone.",
                  "Data available from your first campaigns / connection. We'll then compare your performance against your market."
                )}
              />
            )}
          </section>

          <section>
            <div className="section-label mb-2.5">{t("Alertes", "Alerts")}</div>
            <div className="space-y-2">
              {alerts.length === 0 && <div className="card p-4 text-sm text-muted">{t("Aucune alerte active.", "No active alerts.")}</div>}
              {alerts.map((a) => (
                <div key={a.id} className={`card border-l-[3px] p-3 ${a.level === "critical" ? "border-l-danger-500" : a.level === "warning" ? "border-l-warning-500" : "border-l-primary-400"}`}>
                  <div className="text-sm font-semibold text-ink">{a.title}</div>
                  <p className="mt-0.5 text-2xs text-muted">{a.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="section-label mb-2.5">{t("Par réseau", "By network")}</div>
            {!hasNetworkData ? (
              <EmptyState
                title={t("Aucun réseau connecté", "No network connected")}
                detail={t(
                  "Connectez Facebook, Instagram ou LinkedIn pour suivre vos performances réseau par réseau.",
                  "Connect Facebook, Instagram or LinkedIn to track your performance network by network."
                )}
              />
            ) : (
            <div className="space-y-2">
              {kpis.map((k: NetworkKpis) => (
                <div key={k.network} className="card flex items-center justify-between gap-2 p-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: NET_LABEL[k.network].color }} />
                    <span className="truncate">{NET_LABEL[k.network].label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-2xs text-muted sm:gap-3">
                    <span>{fmt(k.followers)} {t("abo.", "subs.")}</span>
                    <span className="font-semibold text-ink">{k.engagementRate}%</span>
                    <span className={k.engagementTrend >= 0 ? "text-success-600" : "text-danger-600"}>
                      {k.engagementTrend >= 0 ? "+" : ""}{k.engagementTrend}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
            )}
          </section>
        </div>
      </div>

      <p className="text-center text-2xs text-muted">
        {t(
          "Indicateurs et benchmark estimés à partir du marché et des mots-clés ciblés — basculent sur les données réelles dès la connexion Meta / LinkedIn.",
          "Metrics and benchmark estimated from the target market and keywords — switch to live data once Meta / LinkedIn is connected."
        )}
      </p>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="card flex flex-col items-center gap-1.5 p-5 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-muted ring-1 ring-hair">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2 12.5 6 8l2.5 2.5L11 7l3 3.5M2 4h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="text-sm font-semibold text-ink">{title}</div>
      <p className="max-w-xs text-2xs text-muted">{detail}</p>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`card p-3.5 ${accent ? "ring-1 ring-page/15" : ""}`}>
      <div className="text-2xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-xl font-bold ${accent ? "text-page" : "text-ink"}`}>{value}</div>
    </div>
  );
}
