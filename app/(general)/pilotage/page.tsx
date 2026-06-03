"use client";

import { useEffect, useMemo, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useScope } from "@/lib/scope";
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
        title: "Nouveau cycle de pilotage exécuté",
        rationale: data?.complianceVerdict === "block"
          ? "Contenu bloqué par la conformité — révision nécessaire."
          : "Les agents ont produit une recommandation prête à valider.",
        impact: data?.finalOutput ? String(data.finalOutput).slice(0, 120) + "…" : "Voir le centre Agents pour le détail.",
        status: "pending",
      };
      setDecisions((ds) => [reco, ...ds]);
      setToast("Cycle de pilotage terminé — nouvelle recommandation ajoutée.");
    } catch {
      setToast("Erreur lors du cycle. Réessayez.");
    } finally {
      setRunning(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  const pending = decisions.filter((d) => d.status === "pending").length;

  return (
    <div className="animate-fade-in space-y-6">
      {/* ── Bandeau stratégie ──────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="border-b border-hair bg-canvas/60 px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 animate-pulse rounded-full bg-success-500" />
              <span className="section-label text-ink">Centre de pilotage · {company.name}</span>
            </div>
            <span className="chip">{country.flag} {market} · {days} j</span>
          </div>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto]">
          <div>
            <label className="section-label mb-1 block text-muted">Objectif global</label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={2}
              className="input resize-none"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-2xs font-medium uppercase tracking-wide text-muted">Autonomie</span>
              {[1, 2, 3].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setAutonomy(lvl)}
                  className={`chip ${autonomy === lvl ? "border-page bg-page text-white" : ""}`}
                >
                  Niv. {lvl} {lvl === 1 ? "· Reco" : lvl === 2 ? "· Semi" : "· Auto"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-end gap-2">
            <button onClick={runCycle} disabled={running} className="btn-primary whitespace-nowrap">
              {running ? "Pilotage en cours…" : "▶ Lancer un cycle de pilotage"}
            </button>
            <span className="text-center text-2xs text-muted">{pending} décision(s) à valider</span>
          </div>
        </div>
        {toast && <div className="border-t border-hair bg-success-50 px-5 py-2 text-sm text-success-700">{toast}</div>}
      </div>

      {/* ── KPIs agrégés ───────────────────────────────── */}
      <section>
        <div className="section-label mb-2.5">Indicateurs clés · tous réseaux</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Followers" value={fmt(agg.followers)} />
          <Kpi label="Engagement" value={`${agg.engagementRate}%`} accent />
          <Kpi label="Likes" value={fmt(agg.likes)} />
          <Kpi label="Commentaires" value={fmt(agg.comments)} />
          <Kpi label="Vues" value={fmt(agg.views)} />
          <Kpi label="Portée" value={fmt(agg.reach)} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── File de décisions ────────────────────────── */}
        <section className="lg:col-span-2">
          <div className="section-label mb-2.5">Recommandations des agents — à valider</div>
          <div className="space-y-2.5">
            {decisions.map((d) => (
              <div key={d.id} className={`card p-4 ${d.status !== "pending" ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
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
                    <div className="font-semibold text-ink">{d.title}</div>
                    <p className="mt-1 text-sm text-muted">{d.rationale}</p>
                    <p className="mt-1.5 text-2xs font-medium text-success-700">Impact estimé : {d.impact}</p>
                  </div>
                  {d.status === "pending" ? (
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button onClick={() => setStatus(d.id, "approved")} className="btn-primary px-3 py-1 text-2xs">Valider</button>
                      <button onClick={() => setStatus(d.id, "rejected")} className="btn-ghost px-3 py-1 text-2xs">Ignorer</button>
                    </div>
                  ) : (
                    <span className={`shrink-0 text-2xs font-semibold ${d.status === "approved" ? "text-success-700" : "text-muted"}`}>
                      {d.status === "approved" ? "✓ Validé" : "Ignoré"}
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
            <div className="section-label mb-2.5">Benchmark marché · {market}</div>
            <div className="card divide-y divide-hair">
              {bench.map((b) => (
                <div key={b.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted">{b.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{b.you}{b.unit}</span>
                    <span className="text-2xs text-muted">vs {b.market}{b.unit}</span>
                    <span className={b.better ? "text-success-600" : "text-danger-600"}>{b.better ? "▲" : "▼"}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="section-label mb-2.5">Alertes</div>
            <div className="space-y-2">
              {alerts.length === 0 && <div className="card p-4 text-sm text-muted">Aucune alerte active.</div>}
              {alerts.map((a) => (
                <div key={a.id} className={`card border-l-[3px] p-3 ${a.level === "critical" ? "border-l-danger-500" : a.level === "warning" ? "border-l-warning-500" : "border-l-primary-400"}`}>
                  <div className="text-sm font-semibold text-ink">{a.title}</div>
                  <p className="mt-0.5 text-2xs text-muted">{a.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="section-label mb-2.5">Par réseau</div>
            <div className="space-y-2">
              {kpis.map((k: NetworkKpis) => (
                <div key={k.network} className="card flex items-center justify-between p-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-ink">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: NET_LABEL[k.network].color }} />
                    {NET_LABEL[k.network].label}
                  </span>
                  <span className="flex items-center gap-3 text-2xs text-muted">
                    <span>{fmt(k.followers)} abo.</span>
                    <span className="font-semibold text-ink">{k.engagementRate}%</span>
                    <span className={k.engagementTrend >= 0 ? "text-success-600" : "text-danger-600"}>
                      {k.engagementTrend >= 0 ? "+" : ""}{k.engagementTrend}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <p className="text-center text-2xs text-muted">
        Indicateurs et benchmark estimés à partir du marché et des mots-clés ciblés — basculent sur les données réelles dès la connexion Meta / LinkedIn.
      </p>
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
