"use client";

// ── Copilote de lancement ─────────────────────────────────────────────────────
// Assistant conversationnel qui : (1) récupère l'identité de marque + le RAG
// (veille, pubs, benchmark, campagnes), (2) DIALOGUE pour construire le brief
// jusqu'au bout, (3) lance la simulation de marché (MiroFish premium ou Claude),
// (4) génère une stratégie applicable EN 1 CLIC dans les campagnes organiques ET
// publicitaires (brouillons réversibles, aucun budget engagé).

import { useEffect, useRef, useState } from "react";
import { useT, useLang } from "@/lib/i18n";
import { useCompany } from "@/lib/company-context";
import { Spinner } from "@/components/ui/Spinner";
import { Segmented } from "@/components/studio/StudioUI";
import { MirofishStudio } from "@/components/simulateur/MirofishStudio";
import type {
  LaunchBrief,
  CopilotTurn,
  LaunchStrategy,
  ChannelPlay,
  ApplyResult,
  LaunchContextStatus,
} from "@/lib/launch/types";
import type { SimulationResult } from "@/lib/ai/simulation";

type Phase = "chat" | "simulate" | "strategy";
type Msg = { role: "user" | "assistant"; content: string };
type JsonObj = Record<string, unknown> & { error?: string };

// Lecture tolérante : si la réponse n'est pas du JSON (page d'erreur plateforme,
// timeout 504…), on renvoie un objet d'erreur lisible au lieu de planter.
async function readJson(r: Response): Promise<JsonObj> {
  const text = await r.text();
  try {
    return text ? (JSON.parse(text) as JsonObj) : {};
  } catch {
    return { error: `Réponse inattendue du serveur (${r.status}). Réessayez.` };
  }
}

function simResultToReport(r: SimulationResult): string {
  const lines = [
    `Score de réception : ${r.score}/100 — ${r.verdict ?? ""}`,
    r.summary ?? "",
    r.winningAngles?.length ? `Angles gagnants : ${r.winningAngles.join("; ")}` : "",
    r.objections?.length ? `Objections/risques : ${r.objections.join("; ")}` : "",
    r.recommendations?.length ? `Recommandations : ${r.recommendations.join("; ")}` : "",
    r.trendAlignment ? `Alignement tendances : ${r.trendAlignment}` : "",
    r.personas?.length
      ? `Personas : ${r.personas.map((p) => `${p.name} (${p.adoption}% adoption, ${p.sentiment})`).join(" · ")}`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export function LaunchCopilot({ premiumAvailable }: { premiumAvailable: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const { company, access } = useCompany();
  const canEdit = access.canEdit;

  const [status, setStatus] = useState<LaunchContextStatus | null>(null);
  const [phase, setPhase] = useState<Phase>("chat");

  // Chat
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [brief, setBrief] = useState<LaunchBrief>({ product: "", audience: "" });
  const [missing, setMissing] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Simulation
  const [engine, setEngine] = useState<"standard" | "premium">(premiumAvailable ? "premium" : "standard");
  const [simBusy, setSimBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);

  // Stratégie
  const [stratBusy, setStratBusy] = useState(false);
  const [strategy, setStrategy] = useState<LaunchStrategy | null>(null);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Charge le statut du RAG au montage / changement de société.
  useEffect(() => {
    setStatus(null); setPhase("chat"); setMsgs([]); setBrief({ product: "", audience: "" });
    setReady(false); setReport(null); setSimResult(null); setStrategy(null); setApplied(null);
    fetch(`/api/launch/context?companyId=${encodeURIComponent(company.id)}&companyName=${encodeURIComponent(company.name)}`)
      .then(readJson)
      .then((d) => setStatus((d.status as LaunchContextStatus) ?? null))
      .catch(() => setStatus(null));
  }, [company.id, company.name]);

  async function send(goal: string) {
    const g = goal.trim();
    if (!g || busy) return;
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: g }]);
    setInput("");
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/launch/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, companyName: company.name, goal: g, brief, history, language: lang }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.error || t("Le copilote a échoué.", "Copilot failed."));
      const turn = d as unknown as CopilotTurn;
      setMsgs((m) => [...m, { role: "assistant", content: turn.reply || "…" }]);
      if (turn.brief) setBrief(turn.brief);
      setMissing(turn.missing ?? []);
      setReady(Boolean(turn.ready));
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 60);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "Erreur." }]);
    } finally {
      setBusy(false);
    }
  }

  async function runStandardSim() {
    setSimBusy(true); setErr(null);
    try {
      const r = await fetch("/api/ai/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          product: brief.product, audience: brief.audience, message: brief.message,
          market: brief.market, trends: brief.trends, language: lang,
        }),
      });
      const d = await readJson(r);
      if (!r.ok || !d.result) throw new Error(d.error || t("Échec de la simulation.", "Simulation failed."));
      setSimResult(d.result as SimulationResult);
      setReport(simResultToReport(d.result as SimulationResult));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("Erreur réseau.", "Network error."));
    } finally {
      setSimBusy(false);
    }
  }

  async function generateStrategy() {
    setStratBusy(true); setErr(null); setApplied(null);
    try {
      const r = await fetch("/api/launch/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, companyName: company.name, brief, report, language: lang }),
      });
      const d = await readJson(r);
      if (!r.ok || !d.strategy) throw new Error(d.error || t("Stratégie non générée.", "Strategy not generated."));
      setStrategy(d.strategy as LaunchStrategy);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("Erreur réseau.", "Network error."));
    } finally {
      setStratBusy(false);
    }
  }

  async function applyStrategy() {
    if (!strategy || applyBusy) return;
    setApplyBusy(true); setErr(null);
    try {
      const r = await fetch("/api/launch/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, strategy, productName: brief.product }),
      });
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.error || t("Application échouée.", "Apply failed."));
      setApplied(d as unknown as ApplyResult);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("Erreur réseau.", "Network error."));
    } finally {
      setApplyBusy(false);
    }
  }

  const quick = [
    t("Aide-moi à lancer mon nouveau produit", "Help me launch my new product"),
    t("Quels canaux pour mon audience ?", "Which channels for my audience?"),
  ];

  return (
    <div className="space-y-4">
      {/* ── Données récupérées (RAG) ─────────────────────────────────────── */}
      <div className="rounded-xl border border-hair bg-canvas/40 p-3">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted">
          {t("Données de marque récupérées", "Brand data retrieved")}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {!status ? (
            <span className="inline-flex items-center gap-1.5 text-2xs text-muted"><Spinner size={12} className="text-primary-600" />{t("Chargement du contexte…", "Loading context…")}</span>
          ) : (
            <>
              <Chip ok={status.brandIdentity} label={t("Identité de marque", "Brand identity")} />
              <Chip ok={status.veille} label={t("Veille / benchmark", "Intelligence / benchmark")} count={status.memorySignals} />
              <Chip ok={status.ads} label={t("Données publicitaires", "Advertising data")} />
              <Chip ok={status.campaigns > 0} label={t("Campagnes", "Campaigns")} count={status.campaigns} />
            </>
          )}
        </div>
      </div>

      {/* ── Fil d'étapes ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-2xs">
        <Step active={phase === "chat"} done={ready} n={1} label={t("Brief guidé", "Guided brief")} onClick={() => setPhase("chat")} />
        <span className="text-muted">→</span>
        <Step active={phase === "simulate"} done={Boolean(report)} n={2} label={t("Simulation", "Simulation")} onClick={() => ready && setPhase("simulate")} disabled={!ready} />
        <span className="text-muted">→</span>
        <Step active={phase === "strategy"} done={Boolean(strategy)} n={3} label={t("Stratégie", "Strategy")} onClick={() => report && setPhase("strategy")} disabled={!report} />
      </div>

      {err && <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{err}</p>}

      {/* ── Phase 1 : Chat ───────────────────────────────────────────────── */}
      {phase === "chat" && (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="card flex flex-col p-3">
            <div ref={scrollRef} className="mb-2 max-h-[46vh] min-h-[200px] flex-1 space-y-2 overflow-y-auto">
              {msgs.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-lg text-white shadow">✦</span>
                  <p className="text-sm text-muted">{t("Décrivez votre projet de lancement. Je connais déjà votre marque — je vous guide jusqu'au brief complet.", "Describe your launch project. I already know your brand — I'll guide you to a complete brief.")}</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {quick.map((q) => (
                      <button key={q} onClick={() => send(q)} disabled={busy} className="rounded-full border border-hair bg-card px-2.5 py-1 text-2xs text-ink transition-colors hover:border-page hover:text-page disabled:opacity-50">{q}</button>
                    ))}
                  </div>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${m.role === "user" ? "bg-page text-white" : "bg-white/[0.05] text-ink ring-1 ring-hair"}`}>{m.content}</div>
                </div>
              ))}
              {busy && <div className="flex justify-start"><span className="inline-flex items-center gap-1.5 rounded-2xl bg-white/[0.05] px-3 py-2 text-2xs text-muted ring-1 ring-hair"><Spinner size={12} className="text-primary-600" />{t("Le copilote réfléchit…", "The copilot is thinking…")}</span></div>}
            </div>
            <div className="flex items-end gap-2">
              <textarea value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                rows={1} placeholder={t("Votre réponse…", "Your answer…")}
                className="max-h-28 min-h-[2.4rem] flex-1 resize-none rounded-lg border border-hair bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary-400" />
              <button onClick={() => send(input)} disabled={busy || !input.trim()} className="btn-primary h-[2.4rem] shrink-0 text-xs disabled:opacity-50">{t("Envoyer", "Send")}</button>
            </div>
          </div>

          {/* Brief vivant */}
          <div className="card space-y-2 p-4">
            <p className="section-label">{t("Brief en construction", "Brief in progress")}</p>
            <BriefRow label={t("Produit / offre", "Product / offer")} value={brief.product} />
            <BriefRow label={t("Audience", "Audience")} value={brief.audience} />
            <BriefRow label={t("Objectif", "Objective")} value={brief.objective} />
            <BriefRow label={t("Message", "Message")} value={brief.message} />
            <BriefRow label={t("Marché", "Market")} value={brief.market} />
            <BriefRow label={t("Budget", "Budget")} value={brief.budget} />
            <BriefRow label={t("Horizon", "Timeline")} value={brief.timeline} />
            <BriefRow label={t("Canaux", "Channels")} value={(brief.channels ?? []).join(", ")} />
            {(brief.kpis ?? []).length > 0 && <BriefRow label="KPIs" value={brief.kpis!.join(", ")} />}

            {missing.length > 0 && (
              <div className="rounded-lg bg-warning-50 p-2 text-2xs text-warning-700">
                {t("À préciser :", "To clarify:")} {missing.join(" · ")}
              </div>
            )}
            <button onClick={() => setPhase("simulate")} disabled={!ready}
              className="btn-primary mt-1 w-full justify-center py-2 text-sm disabled:opacity-40">
              {ready ? t("Passer à la simulation →", "Go to simulation →") : t("Complétez le brief pour continuer", "Complete the brief to continue")}
            </button>
          </div>
        </div>
      )}

      {/* ── Phase 2 : Simulation ─────────────────────────────────────────── */}
      {phase === "simulate" && (
        <div className="space-y-3">
          {premiumAvailable && (
            <Segmented value={engine} onChange={(v) => setEngine(v as "standard" | "premium")}
              options={[
                { id: "premium", label: t("Premium · MiroFish", "Premium · MiroFish") },
                { id: "standard", label: t("Standard · rapide", "Standard · fast") },
              ]} />
          )}

          {engine === "premium" && premiumAvailable ? (
            <MirofishStudio
              brief={{ product: brief.product, audience: brief.audience, message: brief.message, market: brief.market, trends: brief.trends, brand: company.name, language: lang }}
              onReport={(md) => setReport(md)}
            />
          ) : (
            <div className="card p-5">
              <p className="text-sm text-muted">{t("Lance une simulation rapide (Claude) à partir du brief construit.", "Run a fast simulation (Claude) from the built brief.")}</p>
              <button onClick={runStandardSim} disabled={simBusy} className="btn-primary mt-3 w-full justify-center py-2.5 text-sm disabled:opacity-50">
                {simBusy ? <span className="inline-flex items-center gap-2"><Spinner size={16} className="text-white" />{t("Simulation…", "Simulating…")}</span> : t("🔮 Lancer la simulation", "🔮 Run simulation")}
              </button>
              {simResult && (
                <div className="mt-4 rounded-lg border border-hair bg-canvas/40 p-3 text-sm">
                  <p className="font-semibold text-ink">{simResult.score}/100 — {simResult.verdict}</p>
                  {simResult.summary && <p className="mt-1 text-xs text-muted">{simResult.summary}</p>}
                </div>
              )}
            </div>
          )}

          {report && (
            <button onClick={() => { setPhase("strategy"); if (!strategy) generateStrategy(); }}
              className="btn-primary w-full justify-center py-2.5 text-sm">
              {t("Générer la stratégie →", "Generate strategy →")}
            </button>
          )}
        </div>
      )}

      {/* ── Phase 3 : Stratégie ──────────────────────────────────────────── */}
      {phase === "strategy" && (
        <div className="space-y-3">
          {stratBusy && !strategy && (
            <div className="card flex items-center justify-center gap-2 p-8 text-sm text-muted">
              <Spinner size={16} className="text-primary-600" />{t("Élaboration de la stratégie de lancement…", "Crafting the launch strategy…")}
            </div>
          )}

          {strategy && (
            <>
              <div className="card p-5">
                <p className="section-label mb-1">{t("Synthèse stratégique", "Strategic summary")}</p>
                <p className="text-sm text-ink">{strategy.summary}</p>
                {strategy.positioning && <p className="mt-2 text-xs italic text-muted">{t("Positionnement :", "Positioning:")} {strategy.positioning}</p>}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <PlayColumn title={t("📣 Organique (par canal)", "📣 Organic (per channel)")} plays={strategy.organic} kind="organic" />
                <PlayColumn title={t("💰 Publicitaire (par canal)", "💰 Paid (per channel)")} plays={strategy.paid} kind="paid" />
              </div>

              {strategy.calendar.length > 0 && (
                <div className="card p-4">
                  <p className="section-label mb-2">{t("Calendrier de lancement", "Launch calendar")}</p>
                  <div className="space-y-2">
                    {strategy.calendar.map((c, i) => (
                      <div key={i} className="rounded-lg border border-hair bg-canvas/40 p-2.5">
                        <p className="text-xs font-semibold text-ink">{c.phase}{c.focus ? ` — ${c.focus}` : ""}</p>
                        {c.actions?.length > 0 && <ul className="mt-1 space-y-0.5 text-2xs text-muted">{c.actions.map((a, k) => <li key={k}>• {a}</li>)}</ul>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {strategy.kpis.length > 0 && (
                  <div className="card p-4"><p className="section-label mb-1.5">KPIs</p><ul className="space-y-1 text-xs text-ink">{strategy.kpis.map((k, i) => <li key={i} className="flex gap-1.5"><span className="text-success-600">✓</span>{k}</li>)}</ul></div>
                )}
                {strategy.risks.length > 0 && (
                  <div className="card p-4"><p className="section-label mb-1.5">{t("Risques", "Risks")}</p><ul className="space-y-1 text-xs text-ink">{strategy.risks.map((r, i) => <li key={i} className="flex gap-1.5"><span className="text-danger-500">•</span>{r}</li>)}</ul></div>
                )}
              </div>

              {/* Appliquer */}
              <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-4">
                <p className="text-sm font-semibold text-ink">{t("Appliquer dans vos campagnes", "Apply to your campaigns")}</p>
                <p className="mt-0.5 text-2xs text-muted">
                  {t(
                    "Crée des brouillons réversibles : campagnes pub EN PAUSE (aucun budget engagé) + posts organiques en brouillon à valider.",
                    "Creates reversible drafts: PAUSED ad campaigns (no budget committed) + organic draft posts to review."
                  )}
                </p>
                {applied ? (
                  <div className="mt-2 rounded-lg bg-success-50 px-3 py-2 text-xs text-success-700">
                    ✅ {t("Appliqué :", "Applied:")} {applied.campaignsCreated} {t("campagne(s)", "campaign(s)")}, {applied.adSetsCreated} {t("ad set(s)", "ad set(s)")}, {applied.postsCreated} {t("brouillon(s) organique(s)", "organic draft(s)")}.
                  </div>
                ) : (
                  <button onClick={applyStrategy} disabled={applyBusy || !canEdit}
                    className="btn-primary mt-3 w-full justify-center py-2.5 text-sm disabled:opacity-50">
                    {applyBusy ? <span className="inline-flex items-center gap-2"><Spinner size={16} className="text-white" />{t("Application…", "Applying…")}</span>
                      : canEdit ? t("✅ Créer les brouillons (en pause)", "✅ Create drafts (paused)")
                      : t("Édition requise pour appliquer", "Edit access required to apply")}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function Chip({ ok, label, count }: { ok: boolean; label: string; count?: number }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium ring-1 ${ok ? "bg-success-50 text-success-700 ring-success-500/20" : "bg-canvas text-muted ring-hair"}`}>
      {ok ? "✓" : "○"} {label}{count !== undefined && count > 0 ? ` (${count})` : ""}
    </span>
  );
}

function Step({ active, done, n, label, onClick, disabled }: { active: boolean; done: boolean; n: number; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active ? "bg-page text-white" : done ? "bg-success-50 text-success-700" : "bg-canvas text-muted"}`}>
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[9px]">{done && !active ? "✓" : n}</span>{label}
    </button>
  );
}

function BriefRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="w-24 shrink-0 text-2xs text-muted">{label}</span>
      <span className={value ? "text-ink" : "text-muted/50"}>{value || "—"}</span>
    </div>
  );
}

function PlayColumn({ title, plays, kind }: { title: string; plays: ChannelPlay[]; kind: "organic" | "paid" }) {
  if (plays.length === 0) return null;
  return (
    <div className="card p-4">
      <p className="section-label mb-2">{title}</p>
      <div className="space-y-2.5">
        {plays.map((p, i) => (
          <div key={i} className="rounded-lg border border-hair bg-canvas/40 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold capitalize text-ink">{p.channel}</p>
              <span className="text-2xs text-muted">{kind === "paid" ? p.budgetShare : p.postingCadence}</span>
            </div>
            {p.objective && <p className="text-2xs text-muted">{p.objective}</p>}
            {(p.angles ?? []).length > 0 && <p className="mt-1 text-2xs text-ink">{p.angles.join(" · ")}</p>}
            {(p.hooks ?? []).length > 0 && <p className="mt-1 text-2xs italic text-ink/70">« {p.hooks[0]} »</p>}
            {(p.formats ?? []).length > 0 && <p className="mt-1 text-2xs text-muted">{p.formats.join(", ")}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
