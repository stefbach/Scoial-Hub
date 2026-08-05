"use client";

// Écran Analytiques — données RÉELLES des réseaux connectés.
//
// Cet écran lisait auparavant un jeu de séries de DÉMONSTRATION indexé par des
// identifiants de sociétés fictives : pour une vraie société, l'index ne
// contenait rien, tous les compteurs valaient zéro et la page affichait « Pas
// encore de données » alors que Meta montrait de l'activité. Les séries
// viennent désormais de /api/analytics (publications réellement diffusées,
// engagement porté par ces publications, dépenses et conversions du compte
// publicitaire). Aucun chiffre n'est extrapolé : une source non mesurée est
// annoncée comme telle plutôt que remplie de zéros.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { MetricCard } from "@/components/ui/MetricCard";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { DatePicker } from "@/components/ui/DateTimePicker";
import { BarRow } from "@/components/charts/BarRow";
import { MultiLineChart, type ChartSeries } from "@/components/charts/MultiLineChart";
import { downloadFile } from "@/lib/history-store";
import { moneyFromCents } from "@/lib/format";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";

type RangeId = "7d" | "30d" | "90d" | "1y" | "custom";
const RANGE_DAYS: Record<Exclude<RangeId, "custom">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

type MetricId = "engagement" | "postsPublished" | "adSpend" | "conversions";

/** Un jour renvoyé par /api/analytics. */
interface ApiPoint {
  date: string;
  postsPublished: number;
  engagement: number;
  engagementFacebook: number;
  engagementInstagram: number;
  adSpendCents: number;
  conversions: number;
}

interface ApiAnalytics {
  companyId: string;
  connected: boolean;
  adsMeasured: boolean;
  currency: string;
  series: ApiPoint[];
  followers: number;
  reach?: number;
  views?: number;
}

/** Totaux d'une fenêtre, dans les unités de stockage (centimes pour l'argent). */
interface Totals {
  postsPublished: number;
  engagement: number;
  adSpendCents: number;
  conversions: number;
}

const ZERO: Totals = { postsPublished: 0, engagement: 0, adSpendCents: 0, conversions: 0 };

const PALETTE = ["#1e3a5f", "#6b1f3a", "#4ade80", "#7c3aed", "#ea580c", "#0891b2"];

const DAY_MS = 86_400_000;

/** Jour UTC (yyyy-MM-dd) décalé de `offset` jours. */
function dayString(base: Date, offset = 0): string {
  const utc = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
  return new Date(utc + offset * DAY_MS).toISOString().slice(0, 10);
}

/** Nombre de jours inclusifs entre deux jours yyyy-MM-dd (>= 1). */
function daysBetween(from: string, to: string): number {
  const d = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
  return Math.max(1, d + 1);
}

function sumTotals(points: ApiPoint[]): Totals {
  return points.reduce<Totals>(
    (acc, p) => ({
      postsPublished: acc.postsPublished + p.postsPublished,
      engagement: acc.engagement + p.engagement,
      adSpendCents: acc.adSpendCents + p.adSpendCents,
      conversions: acc.conversions + p.conversions,
    }),
    { ...ZERO }
  );
}

function addTotals(a: Totals, b: Totals): Totals {
  return {
    postsPublished: a.postsPublished + b.postsPublished,
    engagement: a.engagement + b.engagement,
    adSpendCents: a.adSpendCents + b.adSpendCents,
    conversions: a.conversions + b.conversions,
  };
}

/**
 * Variation par rapport à la période précédente de MÊME durée. Sans période
 * précédente exploitable (aucune activité), aucune variation n'est affichée :
 * une tendance inventée dans un tableau de bord est pire que pas de tendance.
 */
function trend(curr: number, prev: number): string | undefined {
  if (prev <= 0) return undefined;
  const p = Math.round(((curr - prev) / prev) * 100);
  return p >= 0 ? `UP ${p}%` : `DN ${Math.abs(p)}%`;
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <AnalyticsContent />
    </Suspense>
  );
}

function AnalyticsContent() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const { companies } = useCompany();

  const METRICS: Record<MetricId, { label: string; color: string; format: (n: number) => string }> = {
    engagement: { label: t("Engagement", "Engagement"), color: "#4ade80", format: (n) => n.toLocaleString() },
    postsPublished: { label: t("Publications", "Posts published"), color: "#60a5fa", format: (n) => `${n}` },
    adSpend: { label: t("Dépenses pub.", "Ad spend"), color: "#7c3aed", format: (n) => moneyFromCents(n) },
    conversions: { label: t("Conversions", "Conversions"), color: "#ea580c", format: (n) => `${n}` },
  };

  const RANGE_LABEL: Record<RangeId, string> = {
    "7d": t("7 derniers jours", "Last 7 days"),
    "30d": t("30 derniers jours", "Last 30 days"),
    "90d": t("90 derniers jours", "Last 90 days"),
    "1y": t("Dernière année", "Last year"),
    custom: t("Période personnalisée", "Custom range"),
  };

  // ── État piloté par l'URL ─────────────────────────────────────────────────
  const scopeParam = params.get("scope");
  const [scope, setScope] = useState(scopeParam ?? "all");
  const [scopeOpen, setScopeOpen] = useState(false);

  const rangeParam = params.get("range") as RangeId | null;
  const [range, setRange] = useState<RangeId>(rangeParam && RANGE_LABEL[rangeParam] ? rangeParam : "30d");
  const [customFrom, setCustomFrom] = useState<Date | null>(
    params.get("from") ? new Date(`${params.get("from")}T00:00:00`) : null
  );
  const [customTo, setCustomTo] = useState<Date | null>(
    params.get("to") ? new Date(`${params.get("to")}T00:00:00`) : null
  );

  const metricParam = params.get("metric") as MetricId | null;
  const [trendMetric, setTrendMetric] = useState<MetricId>(
    metricParam && METRICS[metricParam] ? metricParam : "engagement"
  );

  useEffect(() => {
    const qs = new URLSearchParams();
    if (scope !== "all") qs.set("scope", scope);
    if (range !== "30d") qs.set("range", range);
    if (range === "custom") {
      if (customFrom) qs.set("from", format(customFrom, "yyyy-MM-dd"));
      if (customTo) qs.set("to", format(customTo, "yyyy-MM-dd"));
    }
    if (trendMetric !== "engagement") qs.set("metric", trendMetric);
    const s = qs.toString();
    router.replace(s ? `/analytics?${s}` : "/analytics");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, range, customFrom, customTo, trendMetric]);

  // ── Fenêtre observée ──────────────────────────────────────────────────────
  // La série renvoyée par l'API se termine AUJOURD'HUI ; la fenêtre affichée
  // (et la fenêtre précédente, de même durée) en sont découpées par date.
  const { windowStart, windowEnd, fetchDays } = useMemo(() => {
    const today = new Date();
    if (range === "custom" && customFrom) {
      const from = format(customFrom, "yyyy-MM-dd");
      const to = format(customTo ?? today, "yyyy-MM-dd");
      const span = daysBetween(from, to);
      // Profondeur à demander : de aujourd'hui jusqu'au début de la période
      // PRÉCÉDENTE de même durée.
      const depth = daysBetween(from, dayString(today)) + span;
      return { windowStart: from, windowEnd: to, fetchDays: Math.min(365, depth) };
    }
    const span = RANGE_DAYS[(range === "custom" ? "30d" : range) as Exclude<RangeId, "custom">];
    return {
      windowStart: dayString(today, -(span - 1)),
      windowEnd: dayString(today),
      fetchDays: Math.min(365, span * 2),
    };
  }, [range, customFrom, customTo]);

  const inScope = useMemo(
    () => (scope === "all" ? companies : companies.filter((c) => c.id === scope)),
    [companies, scope]
  );

  // ── Chargement des séries réelles ─────────────────────────────────────────
  const [byCompanyData, setByCompanyData] = useState<Record<string, ApiAnalytics>>({});
  const [loading, setLoading] = useState(true);

  const scopeKey = inScope.map((c) => c.id).join(",");
  useEffect(() => {
    if (inScope.length === 0) {
      setByCompanyData({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const entries = await Promise.all(
        inScope.map(async (c) => {
          try {
            const res = await fetch(
              `/api/analytics?companyId=${encodeURIComponent(c.id)}&days=${fetchDays}`
            );
            if (!res.ok) return null;
            const json = (await res.json()) as ApiAnalytics & { error?: string };
            if (json.error || !Array.isArray(json.series)) return null;
            return [c.id, json] as const;
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      setByCompanyData(Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, ApiAnalytics]>));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, fetchDays]);

  /** Points de la fenêtre courante pour une société. */
  const windowPoints = useCallback(
    (companyId: string): ApiPoint[] => {
      const s = byCompanyData[companyId]?.series ?? [];
      return s.filter((p) => p.date >= windowStart && p.date <= windowEnd);
    },
    [byCompanyData, windowStart, windowEnd]
  );

  /** Points de la période PRÉCÉDENTE, de même durée, pour une société. */
  const previousPoints = useCallback(
    (companyId: string): ApiPoint[] => {
      const span = daysBetween(windowStart, windowEnd);
      const prevEnd = dayString(new Date(`${windowStart}T00:00:00Z`), -1);
      const prevStart = dayString(new Date(`${windowStart}T00:00:00Z`), -span);
      const s = byCompanyData[companyId]?.series ?? [];
      return s.filter((p) => p.date >= prevStart && p.date <= prevEnd);
    },
    [byCompanyData, windowStart, windowEnd]
  );

  const totals = useMemo(
    () => inScope.reduce<Totals>((acc, c) => addTotals(acc, sumTotals(windowPoints(c.id))), { ...ZERO }),
    [inScope, windowPoints]
  );
  const prevTotals = useMemo(
    () => inScope.reduce<Totals>((acc, c) => addTotals(acc, sumTotals(previousPoints(c.id))), { ...ZERO }),
    [inScope, previousPoints]
  );

  const loaded = inScope.filter((c) => byCompanyData[c.id]);
  const anyConnected = loaded.some((c) => byCompanyData[c.id].connected);
  const adsMeasured = loaded.some((c) => byCompanyData[c.id].adsMeasured);
  const currency =
    loaded.map((c) => byCompanyData[c.id]).find((d) => d.adsMeasured)?.currency ?? "EUR";
  const followers = loaded.reduce((s, c) => s + (byCompanyData[c.id].followers ?? 0), 0);
  const reach = loaded.reduce((s, c) => s + (byCompanyData[c.id].reach ?? 0), 0);

  const hasData =
    totals.engagement > 0 || totals.postsPublished > 0 || totals.adSpendCents > 0 || totals.conversions > 0;

  // ── Répartitions ──────────────────────────────────────────────────────────
  const byCompanyBars = useMemo(() => {
    const rows = companies.map((c, i) => {
      const visible = scope === "all" || scope === c.id;
      const value = visible ? sumTotals(windowPoints(c.id)).engagement : 0;
      return { id: c.id, name: c.code || c.name, value, visible, color: PALETTE[i % PALETTE.length] };
    });
    const max = Math.max(1, ...rows.map((r) => r.value));
    const grand = rows.reduce((s, r) => s + r.value, 0) || 1;
    return rows.map((r) => ({ ...r, max, pct: Math.round((r.value / grand) * 100) }));
  }, [companies, scope, windowPoints]);

  const byPlatform = useMemo(() => {
    // Répartition réelle : engagement mesuré sur chaque réseau, sur la période
    // affichée. LinkedIn n'expose pas de statistiques de page sans
    // l'approbation Community Management → « non mesuré », pas « zéro ».
    let fb = 0;
    let ig = 0;
    for (const c of inScope) {
      for (const p of windowPoints(c.id)) {
        fb += p.engagementFacebook;
        ig += p.engagementInstagram;
      }
    }
    const max = Math.max(1, fb, ig);
    return [
      { name: "Facebook", value: fb, max, color: "#1877f2", measured: true, target: "facebook" as const },
      { name: "Instagram", value: ig, max, color: "#d62976", measured: true, target: "instagram" as const },
      { name: "LinkedIn", value: 0, max, color: "#0a66c2", measured: false, target: "linkedin" as const },
    ];
  }, [inScope, windowPoints]);

  const trendSeries: ChartSeries[] = useMemo(
    () =>
      inScope.map((c, i) => {
        const points = windowPoints(c.id);
        const data = points.map((p) =>
          trendMetric === "adSpend"
            ? p.adSpendCents
            : trendMetric === "engagement"
              ? p.engagement
              : trendMetric === "postsPublished"
                ? p.postsPublished
                : p.conversions
        );
        return {
          id: c.id,
          label: c.code || c.name,
          color: PALETTE[i % PALETTE.length],
          data,
          format: METRICS[trendMetric].format,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inScope, windowPoints, trendMetric]
  );

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = (kind: "csv" | "json") => {
    const slug = scope === "all" ? "all-companies" : scope;
    const file = `social-hub-analytics-${slug}-${windowEnd}.${kind === "csv" ? "csv" : "json"}`;
    const rows = inScope.map((c) => {
      const s = sumTotals(windowPoints(c.id));
      return {
        company: c.code || c.name,
        posts_published: s.postsPublished,
        engagement: s.engagement,
        ad_spend_minor_units: s.adSpendCents,
        currency,
        conversions: s.conversions,
        period_start: windowStart,
        period_end: windowEnd,
      };
    });
    if (kind === "csv") {
      const columns = [
        "company", "posts_published", "engagement", "ad_spend_minor_units",
        "currency", "conversions", "period_start", "period_end",
      ];
      const esc = (v: unknown) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [
        columns.join(","),
        ...rows.map((r) => columns.map((c) => esc((r as Record<string, unknown>)[c])).join(",")),
      ].join("\n");
      downloadFile(file, csv, "text/csv");
    } else {
      downloadFile(file, JSON.stringify(rows, null, 2), "application/json");
    }
  };

  const goToPlatform = (target: "facebook" | "instagram" | "linkedin") => {
    if (target === "linkedin") router.push("/accounts");
    else router.push(`/ad-performance?platform=${target}`);
  };

  const scopeLabel =
    scope === "all"
      ? t("Toutes les entreprises", "All companies")
      : companies.find((c) => c.id === scope)?.name ?? t("Toutes les entreprises", "All companies");

  return (
    <div className="animate-fade-in">
      {/* En-tête */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight text-ink">{t("Analytiques", "Analytics")}</h1>
          <span aria-hidden="true" className="h-4 w-px shrink-0 rounded-full bg-hair" />
          <div className="relative">
            <button
              onClick={() => setScopeOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-hair bg-card px-3 py-1.5 text-sm shadow-xs transition-colors hover:bg-canvas"
            >
              <span className="text-muted">{t("Portée :", "Scope:")}</span>
              <span className="font-semibold text-ink">{scopeLabel}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted">
                <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
            {scopeOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setScopeOpen(false)} />
                <div className="absolute left-0 z-20 mt-1.5 w-56 rounded-xl border border-hair bg-card shadow-md">
                  <button
                    onClick={() => { setScope("all"); setScopeOpen(false); }}
                    className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-canvas ${
                      scope === "all" ? "font-semibold text-ink" : "text-ink/80"
                    }`}
                  >
                    {t("Toutes les entreprises", "All companies")}
                  </button>
                  <div className="mx-2 my-1 border-t border-hair" />
                  {companies.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setScope(c.id); setScopeOpen(false); }}
                      className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-canvas ${
                        scope === c.id ? "font-semibold text-ink" : "text-ink/80"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dropdown
            align="right"
            trigger={(open, toggle) => (
              <button
                onClick={toggle}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hair bg-card px-3 py-1.5 text-sm font-medium text-ink shadow-xs hover:bg-canvas transition-colors"
              >
                {RANGE_LABEL[range]}
                <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted">
                  <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </button>
            )}
          >
            {(close) =>
              (Object.keys(RANGE_LABEL) as RangeId[]).map((r) => (
                <DropdownItem key={r} active={r === range} onClick={() => { setRange(r); close(); }}>
                  {RANGE_LABEL[r]}
                </DropdownItem>
              ))
            }
          </Dropdown>
          <Dropdown
            align="right"
            trigger={(open, toggle) => (
              <button
                onClick={toggle}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hair bg-card px-3 py-1.5 text-sm font-medium text-ink shadow-xs hover:bg-canvas transition-colors"
              >
                {t("Exporter", "Export")}
                <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted">
                  <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </button>
            )}
          >
            {(close) => (
              <>
                <DropdownItem onClick={() => { handleExport("csv"); close(); }}>{t("Exporter en CSV", "Export as CSV")}</DropdownItem>
                <DropdownItem onClick={() => { handleExport("json"); close(); }}>{t("Exporter en JSON", "Export as JSON")}</DropdownItem>
              </>
            )}
          </Dropdown>
        </div>
      </div>

      {range === "custom" && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-2xs text-muted">{t("Du", "From")}</span>
          <div className="w-40">
            <DatePicker value={customFrom ?? new Date()} onChange={setCustomFrom} />
          </div>
          <span className="text-2xs text-muted">{t("au", "to")}</span>
          <div className="w-40">
            <DatePicker value={customTo ?? new Date()} onChange={setCustomTo} />
          </div>
        </div>
      )}

      {/* Chargement */}
      {loading && (
        <div className="mb-6 rounded-xl border border-hair bg-card px-6 py-14 text-center text-xs text-muted">
          {t("Lecture des données réelles de vos réseaux…", "Reading real data from your networks…")}
        </div>
      )}

      {/* Vue d'ensemble — uniquement sur des chiffres mesurés */}
      {!loading && hasData && (
        <>
          <div className="section-label mb-3">{t("Vue d'ensemble", "Overview")}</div>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard
              label={t("Publications", "Posts published")}
              value={totals.postsPublished}
              trend={trend(totals.postsPublished, prevTotals.postsPublished)}
            />
            <MetricCard
              label={t("Engagement", "Engagement")}
              value={totals.engagement.toLocaleString()}
              sub={followers > 0 ? `${followers.toLocaleString()} ${t("abonnés", "followers")}` : undefined}
              trend={trend(totals.engagement, prevTotals.engagement)}
            />
            <MetricCard
              label={t("Dépenses pub.", "Ad spend")}
              value={adsMeasured ? moneyFromCents(totals.adSpendCents, currency) : t("Non mesuré", "Not measured")}
              sub={adsMeasured ? undefined : t("Aucun compte publicitaire connecté", "No ad account connected")}
              trend={adsMeasured ? trend(totals.adSpendCents, prevTotals.adSpendCents) : undefined}
            />
            <MetricCard
              label={t("Conversions", "Conversions")}
              value={adsMeasured ? totals.conversions : t("Non mesuré", "Not measured")}
              trend={adsMeasured ? trend(totals.conversions, prevTotals.conversions) : undefined}
            />
          </div>
        </>
      )}

      {/* États vides */}
      {!loading && !hasData && (
        <div className="mb-6 flex flex-col items-center justify-center rounded-xl border border-hair bg-card px-6 py-14 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-canvas">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-muted">
              <path d="M3 20h18M3 14l5-5 4 4 5-7 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {companies.length === 0 ? (
            <>
              <h3 className="mb-1 text-sm font-semibold text-ink">{t("Aucune société", "No company yet")}</h3>
              <p className="max-w-sm text-xs text-muted">
                {t("Créez une société pour commencer à mesurer son activité.", "Create a company to start measuring its activity.")}
              </p>
            </>
          ) : anyConnected ? (
            <>
              <h3 className="mb-1 text-sm font-semibold text-ink">
                {t("Aucune activité sur la période", "No activity in this period")}
              </h3>
              <p className="max-w-sm text-xs text-muted">
                {t(
                  `Vos réseaux sont connectés, mais aucune publication n'a paru entre le ${windowStart} et le ${windowEnd}. Élargissez la période pour voir l'historique.`,
                  `Your networks are connected, but no post was published between ${windowStart} and ${windowEnd}. Widen the period to see history.`
                )}
              </p>
            </>
          ) : (
            <>
              <h3 className="mb-1 text-sm font-semibold text-ink">
                {t("Connectez vos réseaux", "Connect your networks")}
              </h3>
              <p className="max-w-sm text-xs text-muted">
                {t(
                  "Les graphiques et indicateurs s'appuient sur les données réelles de vos comptes : connectez Meta pour les alimenter.",
                  "Charts and metrics are built from your accounts' real data: connect Meta to feed them."
                )}
              </p>
              <a
                href="/accounts"
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-page px-4 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-90 transition-colors"
              >
                {t("Connecter mes réseaux", "Connect my networks")}
              </a>
            </>
          )}
        </div>
      )}

      {/* Courbe */}
      {!loading && hasData && (
        <div className="card mb-6 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-ink">
              {METRICS[trendMetric].label} {t("dans le temps", "over time")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(METRICS) as MetricId[]).map((m) => {
                const on = trendMetric === m;
                return (
                  <button
                    key={m}
                    onClick={() => setTrendMetric(m)}
                    className={`rounded-lg px-2.5 py-1 text-2xs font-medium transition-all ${
                      on
                        ? "bg-ai-textbg text-ai-text ring-1 ring-ai-text/30 shadow-xs"
                        : "border border-hair bg-card text-muted hover:bg-canvas hover:text-ink"
                    }`}
                  >
                    {METRICS[m].label}
                  </button>
                );
              })}
            </div>
          </div>
          <MultiLineChart series={trendSeries} />
          <p className="mt-3 text-2xs text-muted">
            {t(
              "L'engagement est rattaché au jour de publication : Meta n'horodate pas chaque interaction.",
              "Engagement is attributed to the publication day: Meta does not timestamp each interaction."
            )}
          </p>
        </div>
      )}

      {/* Répartitions */}
      {!loading && hasData && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="card p-4">
            <div className="mb-4 text-sm font-semibold text-ink">{t("Engagement par entreprise", "Engagement by company")}</div>
            {byCompanyBars.map((c) => (
              <BarRow
                key={c.id}
                label={c.name}
                value={c.visible ? c.value : 0}
                max={c.max}
                color={c.color}
                caption={c.visible ? `${c.value.toLocaleString()} · ${c.pct}%` : t("Masqué par la portée", "Hidden by scope")}
                muted={!c.visible}
                onClick={c.visible ? () => setScope(c.id) : undefined}
                title={c.visible ? `${t("Filtrer sur", "Scope to")} ${c.name}` : undefined}
              />
            ))}
          </div>
          <div className="card p-4">
            <div className="mb-4 text-sm font-semibold text-ink">{t("Performance par plateforme", "Performance by platform")}</div>
            {byPlatform.map((p) => (
              <BarRow
                key={p.name}
                label={p.name}
                value={p.value}
                max={p.max}
                color={p.color}
                caption={p.measured ? p.value.toLocaleString() : t("Non mesuré", "Not measured")}
                muted={!p.measured}
                onClick={() => goToPlatform(p.target)}
                title={
                  p.measured
                    ? `${t("Voir les performances", "View performance")} ${p.name}`
                    : t("LinkedIn n'expose pas de statistiques de page sans l'approbation Community Management", "LinkedIn exposes no page statistics without Community Management approval")
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Lecture factuelle — calculée sur les chiffres affichés, rien d'inventé */}
      {!loading && hasData && (
        <div className="rounded-xl border border-ai-text/20 bg-ai-textbg px-4 py-3.5 text-xs text-ai-text shadow-xs">
          <span className="font-semibold">{t("Lecture :", "Reading:")}</span>{" "}
          {t(
            `${totals.postsPublished} publication(s) du ${windowStart} au ${windowEnd}, ${totals.engagement.toLocaleString()} interaction(s)` +
              (reach > 0 ? `, ${reach.toLocaleString()} personne(s) touchée(s) sur 28 jours` : "") +
              (adsMeasured ? `, ${moneyFromCents(totals.adSpendCents, currency)} investis pour ${totals.conversions} conversion(s)` : "") +
              ".",
            `${totals.postsPublished} post(s) from ${windowStart} to ${windowEnd}, ${totals.engagement.toLocaleString()} interaction(s)` +
              (reach > 0 ? `, ${reach.toLocaleString()} people reached over 28 days` : "") +
              (adsMeasured ? `, ${moneyFromCents(totals.adSpendCents, currency)} spent for ${totals.conversions} conversion(s)` : "") +
              "."
          )}
        </div>
      )}
    </div>
  );
}
