"use client";

// ── MirofishStudio — moteur de simulation PREMIUM (multi-agents, self-hosted) ──
// Orchestre le pipeline MiroFish via notre proxy /api/mirofish/* :
//   ontologie → graphe → simulation (personas + rounds) → rapport → chat.
// Cadrage « cabinet d'élite » (KPMG/McKinsey) injecté dans la demande envoyée.
// Le pipeline est long (plusieurs minutes) : on affiche l'avancement étape par
// étape et on tolère les variations de noms de champs de l'API amont.

import { useState } from "react";
import { useT, useLang } from "@/lib/i18n";
import { useCompany } from "@/lib/company-context";
import { Spinner } from "@/components/ui/Spinner";
import {
  buildSimulationRequirement,
  buildAdditionalContext,
  consultingChatPreamble,
  type MirofishBrief,
} from "@/lib/integrations/mirofish-prompt";

type StageState = "idle" | "running" | "done" | "error";
interface Stage { key: string; labelFr: string; labelEn: string; state: StageState }

const STAGES: Omit<Stage, "state">[] = [
  { key: "ontology", labelFr: "Ontologie & extraction", labelEn: "Ontology & extraction" },
  { key: "graph", labelFr: "Construction du graphe", labelEn: "Graph construction" },
  { key: "create", labelFr: "Création de la simulation", labelEn: "Simulation creation" },
  { key: "prepare", labelFr: "Génération des personas", labelEn: "Persona generation" },
  { key: "simulate", labelFr: "Simulation (interactions)", labelEn: "Simulation (interactions)" },
  { key: "report", labelFr: "Rapport exécutif", labelEn: "Executive report" },
];

const DONE_WORDS = ["completed", "done", "success", "succeeded", "finished", "ready", "complete"];
const FAIL_WORDS = ["failed", "error", "cancelled", "canceled", "aborted"];

function pick<T = unknown>(obj: unknown, ...keys: string[]): T | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  for (const k of keys) if (o[k] != null) return o[k] as T;
  return undefined;
}

export function MirofishStudio({
  brief,
  onReport,
}: {
  brief: MirofishBrief;
  /** Remonte le rapport markdown + l'id de simulation au parent (Copilote). */
  onReport?: (markdown: string, simulationId: string) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const { company } = useCompany();

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>(STAGES.map((s) => ({ ...s, state: "idle" })));
  const [report, setReport] = useState<string | null>(null);
  const [simulationId, setSimulationId] = useState<string | null>(null);

  // Chat avec le ReportAgent (après rapport).
  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatting, setChatting] = useState(false);

  function setStage(key: string, state: StageState) {
    setStages((prev) => prev.map((s) => (s.key === key ? { ...s, state } : s)));
  }

  // Appel proxy MiroFish. `form` => multipart ; `json` => application/json.
  async function mf(path: string, opts: { method?: string; json?: unknown; form?: FormData } = {}) {
    const headers: Record<string, string> = { "x-company-id": company.id };
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(opts.json); }
    const r = await fetch(`/api/mirofish/${path}`, { method: opts.method ?? (body ? "POST" : "GET"), headers, body });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d?.success === false) {
      throw new Error((d?.error as string) || `MiroFish ${path} (HTTP ${r.status})`);
    }
    return (d?.data ?? d) as Record<string, unknown>;
  }

  // Boucle de polling générique (status "done"/"failed" tolérant).
  async function poll(fn: () => Promise<Record<string, unknown>>, maxMs: number): Promise<Record<string, unknown>> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 4000));
      const data = await fn();
      const status = String(pick<string>(data, "status", "runner_status", "state") ?? "").toLowerCase();
      if (DONE_WORDS.some((w) => status.includes(w))) return data;
      if (FAIL_WORDS.some((w) => status.includes(w))) {
        throw new Error((pick<string>(data, "message", "error") as string) || "MiroFish: étape en échec.");
      }
    }
    throw new Error("MiroFish: délai d'attente dépassé pour cette étape.");
  }

  async function run() {
    if (running) return;
    setRunning(true); setError(null); setReport(null); setSimulationId(null);
    setStages(STAGES.map((s) => ({ ...s, state: "idle" })));
    try {
      // 1) Ontologie (multipart) — cadrage cabinet d'élite injecté ici.
      setStage("ontology", "running");
      const fd = new FormData();
      fd.append("simulation_requirement", buildSimulationRequirement(brief));
      fd.append("project_name", `${brief.brand || "AXON"} — ${brief.product}`.slice(0, 80));
      fd.append("additional_context", buildAdditionalContext(brief));
      const onto = await mf("api/graph/ontology/generate", { form: fd });
      const projectId = pick<string>(onto, "project_id", "projectId", "id");
      if (!projectId) throw new Error("MiroFish: project_id manquant.");
      setStage("ontology", "done");

      // 2) Construction du graphe (async → task).
      setStage("graph", "running");
      const build = await mf("api/graph/build", { json: { project_id: projectId, graph_name: "main", force: true } });
      const buildTask = pick<string>(build, "task_id", "taskId");
      let graphId = pick<string>(build, "graph_id", "graphId");
      if (buildTask) {
        const done = await poll(() => mf(`api/graph/task/${buildTask}`), 12 * 60_000);
        graphId = graphId || pick<string>(done, "graph_id", "graphId") || pick<string>(pick(done, "result", "data") ?? {}, "graph_id", "graphId");
      }
      setStage("graph", "done");

      // 3) Création de la simulation.
      setStage("create", "running");
      const created = await mf("api/simulation/create", {
        json: { project_id: projectId, graph_id: graphId, enable_twitter: true, enable_reddit: false },
      });
      const simId = pick<string>(created, "simulation_id", "simulationId", "id");
      if (!simId) throw new Error("MiroFish: simulation_id manquant.");
      setSimulationId(simId);
      setStage("create", "done");

      // 4) Préparation (génération des personas) — async.
      setStage("prepare", "running");
      const prep = await mf("api/simulation/prepare", { json: { simulation_id: simId, use_llm_for_profiles: true } });
      const prepTask = pick<string>(prep, "task_id", "taskId");
      if (prepTask && !pick<boolean>(prep, "already_prepared")) {
        await poll(() => mf("api/simulation/prepare/status", { json: { task_id: prepTask, simulation_id: simId } }), 12 * 60_000);
      }
      setStage("prepare", "done");

      // 5) Exécution de la simulation (rounds d'interactions) — async.
      setStage("simulate", "running");
      await mf("api/simulation/start", { json: { simulation_id: simId, platform: "parallel", max_rounds: 3 } });
      await poll(() => mf(`api/simulation/${simId}/run-status`), 25 * 60_000);
      setStage("simulate", "done");

      // 6) Rapport exécutif — async.
      setStage("report", "running");
      const gen = await mf("api/report/generate", { json: { simulation_id: simId } });
      const reportTask = pick<string>(gen, "task_id", "taskId");
      let reportId = pick<string>(gen, "report_id", "reportId");
      if (reportTask) {
        const done = await poll(() => mf("api/report/generate/status", { json: { task_id: reportTask, simulation_id: simId } }), 15 * 60_000);
        reportId = reportId || pick<string>(done, "report_id", "reportId");
      }
      if (!reportId) throw new Error("MiroFish: report_id manquant.");
      const rep = await mf(`api/report/${reportId}`);
      const md = pick<string>(rep, "markdown_content", "markdown", "content");
      const finalMd = md || t("(Rapport vide.)", "(Empty report.)");
      setReport(finalMd);
      setStage("report", "done");
      onReport?.(finalMd, simId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec de la simulation premium.", "Premium simulation failed."));
      setStages((prev) => prev.map((s) => (s.state === "running" ? { ...s, state: "error" } : s)));
    } finally {
      setRunning(false);
    }
  }

  async function sendChat() {
    const message = chatInput.trim();
    if (!message || chatting || !simulationId) return;
    setChatInput("");
    setChat((c) => [...c, { role: "user", content: message }]);
    setChatting(true);
    try {
      const d = await mf("api/report/chat", {
        json: {
          simulation_id: simulationId,
          message: `${consultingChatPreamble(lang)}\n\n${message}`,
          chat_history: chat,
        },
      });
      const answer = pick<string>(d, "response", "answer", "content") || "…";
      setChat((c) => [...c, { role: "assistant", content: answer }]);
    } catch (e) {
      setChat((c) => [...c, { role: "assistant", content: e instanceof Error ? e.message : "Erreur." }]);
    } finally {
      setChatting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-4">
        <p className="text-sm font-semibold text-ink">{t("Moteur premium — simulation multi-agents", "Premium engine — multi-agent simulation")}</p>
        <p className="mt-0.5 text-2xs text-muted">
          {t(
            "Pipeline complet (graphe de connaissance → milliers d'agents → rapport de niveau cabinet). Compter plusieurs minutes.",
            "Full pipeline (knowledge graph → thousands of agents → consulting-grade report). Allow several minutes."
          )}
        </p>
        <button onClick={run} disabled={running} className="btn-primary mt-3 w-full justify-center py-2.5 text-sm disabled:opacity-50">
          {running
            ? <span className="inline-flex items-center gap-2"><Spinner size={16} className="text-white" />{t("Simulation premium en cours…", "Premium simulation running…")}</span>
            : t("🧠 Lancer la simulation premium (MiroFish)", "🧠 Run premium simulation (MiroFish)")}
        </button>
      </div>

      {/* Avancement par étape */}
      <ol className="space-y-1.5">
        {stages.map((s) => (
          <li key={s.key} className="flex items-center gap-2.5 rounded-lg bg-canvas/50 px-3 py-2 text-sm">
            <span className="shrink-0">
              {s.state === "done" ? "✅" : s.state === "running" ? <Spinner size={14} className="text-primary-600" /> : s.state === "error" ? "❌" : "○"}
            </span>
            <span className={s.state === "idle" ? "text-muted" : "text-ink"}>{t(s.labelFr, s.labelEn)}</span>
          </li>
        ))}
      </ol>

      {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</p>}

      {/* Rapport */}
      {report && (
        <div className="card p-5">
          <p className="section-label mb-2">{t("Rapport exécutif", "Executive report")}</p>
          <div className="prose-sm max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {report}
          </div>
        </div>
      )}

      {/* Chat avec le ReportAgent */}
      {simulationId && report && (
        <div className="card p-4">
          <p className="section-label mb-2">{t("Interroger l'analyste (agent)", "Ask the analyst (agent)")}</p>
          <div className="mb-2 max-h-56 space-y-2 overflow-y-auto">
            {chat.map((m, i) => (
              <div key={i} className={`rounded-lg px-3 py-2 text-xs ${m.role === "user" ? "bg-primary-50 text-ink" : "bg-canvas text-ink"}`}>
                {m.content}
              </div>
            ))}
            {chatting && <div className="flex items-center gap-2 text-2xs text-muted"><Spinner size={12} className="text-primary-600" />{t("L'agent réfléchit…", "The agent is thinking…")}</div>}
          </div>
          <div className="flex gap-2">
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
              placeholder={t("Ex. « Quel segment est le plus à risque ? »", "E.g. \"Which segment is most at risk?\"")}
              className="input flex-1 text-sm" />
            <button onClick={sendChat} disabled={chatting || !chatInput.trim()} className="btn-secondary shrink-0 text-xs disabled:opacity-50">
              {t("Envoyer", "Send")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
