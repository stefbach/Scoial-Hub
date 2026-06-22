"use client";

// Orchestrateur autonome du pipeline MiroFish :
//   ontologie → graphe → simulation (personas + rounds) → rapport → chat analyste.
// Tolérant aux variantes de noms de champs de l'API amont (non documentée).

import { useState } from "react";
import {
  buildSimulationRequirement,
  buildAdditionalContext,
  consultingChatPreamble,
  type StudioBrief,
} from "@/lib/prompt";

type StageState = "idle" | "running" | "done" | "error";
interface Stage { key: string; label: string; state: StageState }

const STAGES: Omit<Stage, "state">[] = [
  { key: "ontology", label: "Ontologie & extraction" },
  { key: "graph", label: "Construction du graphe" },
  { key: "create", label: "Création de la simulation" },
  { key: "prepare", label: "Génération des personas" },
  { key: "simulate", label: "Simulation (interactions)" },
  { key: "report", label: "Rapport exécutif" },
];

const DONE = ["completed", "done", "success", "succeeded", "finished", "ready", "complete"];
const FAIL = ["failed", "error", "cancelled", "canceled", "aborted"];

function pick<T = unknown>(obj: unknown, ...keys: string[]): T | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  for (const k of keys) if (o[k] != null) return o[k] as T;
  return undefined;
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-neutral-500 border-t-transparent"
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

export function Studio() {
  const [brief, setBrief] = useState<StudioBrief>({ product: "", audience: "" });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>(STAGES.map((s) => ({ ...s, state: "idle" })));
  const [report, setReport] = useState<string | null>(null);
  const [simId, setSimId] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatting, setChatting] = useState(false);

  function set<K extends keyof StudioBrief>(k: K, v: string) {
    setBrief((b) => ({ ...b, [k]: v }));
  }
  function setStage(key: string, state: StageState) {
    setStages((prev) => prev.map((s) => (s.key === key ? { ...s, state } : s)));
  }

  async function mf(path: string, opts: { method?: string; json?: unknown; form?: FormData } = {}) {
    const headers: Record<string, string> = {};
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(opts.json); }
    const r = await fetch(`/api/mf/${path}`, { method: opts.method ?? (body ? "POST" : "GET"), headers, body });
    const text = await r.text();
    let d: Record<string, unknown> = {};
    try { d = text ? (JSON.parse(text) as Record<string, unknown>) : {}; }
    catch { throw new Error(`Réponse inattendue de MiroFish (${r.status}).`); }
    if (!r.ok || d?.success === false) throw new Error((d?.error as string) || `MiroFish ${path} (HTTP ${r.status})`);
    return (d?.data ?? d) as Record<string, unknown>;
  }

  async function poll(fn: () => Promise<Record<string, unknown>>, maxMs: number): Promise<Record<string, unknown>> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 4000));
      const data = await fn();
      const status = String(pick<string>(data, "status", "runner_status", "state") ?? "").toLowerCase();
      if (DONE.some((w) => status.includes(w))) return data;
      if (FAIL.some((w) => status.includes(w))) throw new Error((pick<string>(data, "message", "error") as string) || "Étape en échec.");
    }
    throw new Error("Délai d'attente dépassé pour cette étape.");
  }

  async function run() {
    if (running) return;
    if (!brief.product.trim() || !brief.audience.trim()) {
      setError("Renseignez au moins le produit et l'audience.");
      return;
    }
    setRunning(true); setError(null); setReport(null); setSimId(null);
    setStages(STAGES.map((s) => ({ ...s, state: "idle" })));
    try {
      setStage("ontology", "running");
      const fd = new FormData();
      fd.append("simulation_requirement", buildSimulationRequirement(brief));
      fd.append("project_name", `${brief.brand || "Studio"} — ${brief.product}`.slice(0, 80));
      fd.append("additional_context", buildAdditionalContext(brief));
      const onto = await mf("api/graph/ontology/generate", { form: fd });
      const projectId = pick<string>(onto, "project_id", "projectId", "id");
      if (!projectId) throw new Error("project_id manquant.");
      setStage("ontology", "done");

      setStage("graph", "running");
      const build = await mf("api/graph/build", { json: { project_id: projectId, graph_name: "main", force: true } });
      const buildTask = pick<string>(build, "task_id", "taskId");
      let graphId = pick<string>(build, "graph_id", "graphId");
      if (buildTask) {
        const done = await poll(() => mf(`api/graph/task/${buildTask}`), 12 * 60_000);
        graphId = graphId || pick<string>(done, "graph_id", "graphId") || pick<string>(pick(done, "result", "data") ?? {}, "graph_id", "graphId");
      }
      setStage("graph", "done");

      setStage("create", "running");
      const created = await mf("api/simulation/create", { json: { project_id: projectId, graph_id: graphId, enable_twitter: true, enable_reddit: false } });
      const id = pick<string>(created, "simulation_id", "simulationId", "id");
      if (!id) throw new Error("simulation_id manquant.");
      setSimId(id);
      setStage("create", "done");

      setStage("prepare", "running");
      const prep = await mf("api/simulation/prepare", { json: { simulation_id: id, use_llm_for_profiles: true } });
      const prepTask = pick<string>(prep, "task_id", "taskId");
      if (prepTask && !pick<boolean>(prep, "already_prepared")) {
        await poll(() => mf("api/simulation/prepare/status", { json: { task_id: prepTask, simulation_id: id } }), 12 * 60_000);
      }
      setStage("prepare", "done");

      setStage("simulate", "running");
      await mf("api/simulation/start", { json: { simulation_id: id, platform: "parallel", max_rounds: 3 } });
      await poll(() => mf(`api/simulation/${id}/run-status`), 25 * 60_000);
      setStage("simulate", "done");

      setStage("report", "running");
      const gen = await mf("api/report/generate", { json: { simulation_id: id } });
      const reportTask = pick<string>(gen, "task_id", "taskId");
      let reportId = pick<string>(gen, "report_id", "reportId");
      if (reportTask) {
        const done = await poll(() => mf("api/report/generate/status", { json: { task_id: reportTask, simulation_id: id } }), 15 * 60_000);
        reportId = reportId || pick<string>(done, "report_id", "reportId");
      }
      if (!reportId) throw new Error("report_id manquant.");
      const rep = await mf(`api/report/${reportId}`);
      setReport(pick<string>(rep, "markdown_content", "markdown", "content") || "(Rapport vide.)");
      setStage("report", "done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la simulation.");
      setStages((prev) => prev.map((s) => (s.state === "running" ? { ...s, state: "error" } : s)));
    } finally {
      setRunning(false);
    }
  }

  async function sendChat() {
    const message = chatInput.trim();
    if (!message || chatting || !simId) return;
    setChatInput("");
    setChat((c) => [...c, { role: "user", content: message }]);
    setChatting(true);
    try {
      const d = await mf("api/report/chat", { json: { simulation_id: simId, message: `${consultingChatPreamble()}\n\n${message}`, chat_history: chat } });
      setChat((c) => [...c, { role: "assistant", content: pick<string>(d, "response", "answer", "content") || "…" }]);
    } catch (e) {
      setChat((c) => [...c, { role: "assistant", content: e instanceof Error ? e.message : "Erreur." }]);
    } finally {
      setChatting(false);
    }
  }

  const input = "w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-violet-500";
  const label = "mb-1 block text-xs font-medium text-neutral-400";

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      {/* Brief */}
      <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div>
          <label className={label}>Produit / offre *</label>
          <textarea rows={2} className={input} value={brief.product} onChange={(e) => set("product", e.target.value)}
            placeholder="Ex. « Nouvelle offre de téléconsultation 24/7 »" />
        </div>
        <div>
          <label className={label}>Audience cible *</label>
          <textarea rows={2} className={input} value={brief.audience} onChange={(e) => set("audience", e.target.value)}
            placeholder="Ex. « Familles urbaines 30-45 ans, soucieuses de la santé »" />
        </div>
        <div>
          <label className={label}>Message / angle</label>
          <textarea rows={2} className={input} value={brief.message ?? ""} onChange={(e) => set("message", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Marché / zone</label><input className={input} value={brief.market ?? ""} onChange={(e) => set("market", e.target.value)} /></div>
          <div><label className={label}>Marque</label><input className={input} value={brief.brand ?? ""} onChange={(e) => set("brand", e.target.value)} /></div>
        </div>
        <div>
          <label className={label}>Tendances actuelles</label>
          <textarea rows={3} className={input} value={brief.trends ?? ""} onChange={(e) => set("trends", e.target.value)}
            placeholder="Contexte marché, signaux de veille…" />
        </div>
        <button onClick={run} disabled={running}
          className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50">
          {running ? <span className="inline-flex items-center gap-2"><Spinner size={16} /> Simulation en cours…</span> : "🧠 Lancer la simulation"}
        </button>
        <p className="text-xs text-neutral-500">Pipeline complet (plusieurs minutes) : graphe → agents → rapport.</p>
        {error && <p className="rounded-lg bg-red-950/60 px-3 py-2 text-xs text-red-300">{error}</p>}
      </div>

      {/* Résultat */}
      <div className="space-y-4">
        <ol className="space-y-1.5">
          {stages.map((s) => (
            <li key={s.key} className="flex items-center gap-2.5 rounded-lg bg-neutral-900/40 px-3 py-2 text-sm">
              <span className="w-4 text-center">
                {s.state === "done" ? "✅" : s.state === "running" ? <Spinner size={14} /> : s.state === "error" ? "❌" : "○"}
              </span>
              <span className={s.state === "idle" ? "text-neutral-500" : "text-neutral-100"}>{s.label}</span>
            </li>
          ))}
        </ol>

        {report && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Rapport exécutif</p>
            <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">{report}</div>
          </div>
        )}

        {simId && report && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Interroger l'analyste</p>
            <div className="mb-2 max-h-56 space-y-2 overflow-y-auto">
              {chat.map((m, i) => (
                <div key={i} className={`rounded-lg px-3 py-2 text-xs ${m.role === "user" ? "bg-violet-950/50" : "bg-neutral-800/60"}`}>{m.content}</div>
              ))}
              {chatting && <div className="flex items-center gap-2 text-xs text-neutral-500"><Spinner size={12} /> L'agent réfléchit…</div>}
            </div>
            <div className="flex gap-2">
              <input className={input} value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
                placeholder="Ex. « Quel segment est le plus à risque ? »" />
              <button onClick={sendChat} disabled={chatting || !chatInput.trim()}
                className="shrink-0 rounded-lg border border-neutral-700 px-3 text-xs hover:border-violet-500 disabled:opacity-50">Envoyer</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
