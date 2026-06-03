"use client";

import { useEffect, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { Toast } from "@/components/ui/Toast";

// ── Page « Connecteur MCP Claude » côté client ──────────────────────────────────
// Permet à chaque client de brancher AXON-AI sur Claude Desktop (ou tout client
// MCP compatible) pour piloter ses agents et campagnes en langage naturel.

const MCP_TOOLS: { name: string; fr: string; en: string }[] = [
  { name: "list_companies", fr: "Lister les comptes / entités accessibles.", en: "List accessible accounts / entities." },
  { name: "get_dashboard", fr: "Récupérer les KPIs et l'état d'un compte.", en: "Fetch KPIs and the state of an account." },
  { name: "run_agents", fr: "Lancer une orchestration multi-agent sur un objectif.", en: "Launch a multi-agent orchestration on an objective." },
  { name: "generate_post", fr: "Générer un post organique (texte) prêt à publier.", en: "Generate an organic post (text) ready to publish." },
  { name: "generate_image", fr: "Générer un visuel au bon format pour un réseau.", en: "Generate a visual in the right format for a network." },
  { name: "run_veille", fr: "Déclencher une analyse de veille concurrentielle.", en: "Trigger a competitive market-watch analysis." },
  { name: "list_scheduled", fr: "Lister les publications programmées.", en: "List scheduled publications." },
  { name: "schedule_post", fr: "Programmer une publication à une date/heure.", en: "Schedule a publication at a date/time." },
];

export default function ClientMcpPage() {
  const { company } = useCompany();
  const t = useT();
  const [origin, setOrigin] = useState("https://votre-app.vercel.app");
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const config = `{
  "mcpServers": {
    "axon-ai": {
      "command": "node",
      "args": ["/chemin/absolu/vers/Scoial-Hub/mcp/dist/index.js"],
      "env": {
        "SOCIAL_HUB_URL": "${origin}"
      }
    }
  }
}`;

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(
      () => setToast({ message: t(`${label} copié.`, `${label} copied.`), key: Date.now() }),
      () => setToast({ message: t("Copie impossible.", "Copy failed."), key: Date.now() })
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* En-tête */}
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg,#5b2d8e,#7c3aed)" }}
          aria-hidden
        >
          MCP
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">
            {t("Connecteur MCP Claude", "Claude MCP Connector")}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {t(
              "Branchez AXON-AI sur Claude Desktop (ou tout client MCP) pour piloter vos agents et campagnes en langage naturel, sans quitter votre assistant.",
              "Plug AXON-AI into Claude Desktop (or any MCP client) to pilot your agents and campaigns in natural language, without leaving your assistant."
            )}
          </p>
        </div>
      </div>

      {/* C'est quoi MCP */}
      <div className="rounded-xl border border-primary-200 bg-primary-50/60 px-5 py-4">
        <h2 className="text-sm font-semibold text-ink">{t("Qu'est-ce que MCP ?", "What is MCP?")}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {t(
            "Le Model Context Protocol (MCP) est un standard ouvert qui permet à un assistant IA comme Claude d'utiliser des outils externes. Le serveur MCP d'AXON-AI expose vos comptes, vos agents et vos campagnes : vous demandez à Claude « lance une campagne pour la rentrée », et il exécute réellement l'action dans votre espace AXON-AI.",
            "The Model Context Protocol (MCP) is an open standard that lets an AI assistant like Claude use external tools. The AXON-AI MCP server exposes your accounts, agents and campaigns: you ask Claude to “launch a back-to-school campaign”, and it actually performs the action inside your AXON-AI workspace."
          )}
        </p>
      </div>

      {/* Étapes d'installation */}
      <div className="card p-5">
        <div className="section-label mb-3">{t("Installation en 4 étapes", "Setup in 4 steps")}</div>
        <ol className="space-y-3 text-sm text-ink">
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">1</span>
            <span>
              {t("Installez ", "Install ")}
              <a href="https://claude.ai/download" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2 hover:no-underline">Claude Desktop</a>
              {t(" et ", " and ")}
              <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2 hover:no-underline">Node.js 18+</a>
              {t(" sur votre ordinateur.", " on your computer.")}
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">2</span>
            <span>
              {t("Compilez le serveur MCP fourni : dans le dossier ", "Build the bundled MCP server: in the ")}
              <code className="rounded bg-canvas px-1 py-0.5 font-mono text-xs">mcp/</code>
              {t(" lancez ", " folder run ")}
              <code className="rounded bg-canvas px-1 py-0.5 font-mono text-xs">npm install && npm run build</code>.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">3</span>
            <span>
              {t(
                "Ouvrez le fichier de configuration de Claude Desktop et collez le bloc ci-dessous dans ",
                "Open the Claude Desktop configuration file and paste the block below inside "
              )}
              <code className="rounded bg-canvas px-1 py-0.5 font-mono text-xs">mcpServers</code>.
              <span className="mt-1 block text-xs text-muted">
                {t("macOS : ", "macOS: ")}<code className="font-mono">~/Library/Application Support/Claude/claude_desktop_config.json</code>
                <br />
                {t("Windows : ", "Windows: ")}<code className="font-mono">%APPDATA%\Claude\claude_desktop_config.json</code>
              </span>
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">4</span>
            <span>{t("Redémarrez Claude Desktop. Le serveur « axon-ai » apparaît dans la liste des outils.", "Restart Claude Desktop. The “axon-ai” server appears in the tools list.")}</span>
          </li>
        </ol>
      </div>

      {/* Bloc de configuration */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="section-label">{t("Configuration à copier", "Configuration to copy")}</div>
          <button className="btn-secondary text-xs" onClick={() => copy(config, t("Configuration", "Configuration"))}>
            {t("Copier", "Copy")}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-lg border border-hair bg-[#1e1b2e] p-4 text-xs leading-relaxed text-[#e9e3f5]">
          <code>{config}</code>
        </pre>
        <div className="mt-3 space-y-1.5 text-xs text-muted">
          <p>{t("• Remplacez le chemin par l'emplacement réel du dossier sur votre machine.", "• Replace the path with the real folder location on your machine.")}</p>
          <p>
            {t("• L'URL ", "• The URL ")}<code className="rounded bg-canvas px-1 py-0.5 font-mono">{origin}</code>
            {t(" est déjà celle de votre espace AXON-AI.", " is already your AXON-AI workspace.")}
          </p>
        </div>
      </div>

      {/* Outils exposés */}
      <div className="card p-5">
        <div className="section-label mb-4">{t("Ce que Claude pourra faire", "What Claude will be able to do")}</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MCP_TOOLS.map((tool) => (
            <div key={tool.name} className="flex items-start gap-2.5 rounded-lg border border-hair bg-canvas px-3 py-2.5">
              <code className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-2xs font-semibold text-primary">{tool.name}</code>
              <span className="text-xs text-ink">{t(tool.fr, tool.en)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Combiner d'autres serveurs */}
      <div className="card p-5">
        <div className="section-label mb-3">{t("Aller plus loin", "Going further")}</div>
        <p className="text-sm leading-relaxed text-muted">
          {t(
            "Vous pouvez brancher plusieurs serveurs MCP en parallèle (par exemple le GitHub MCP Server officiel) pour donner encore plus de capacités à Claude. Pour « ",
            "You can plug several MCP servers in parallel (for example the official GitHub MCP Server) to give Claude even more capabilities. For “"
          )}
          <span className="font-medium text-ink">{company.name}</span>
          {t(" », chaque action effectuée via Claude reste tracée dans votre historique.", "”, every action performed via Claude is logged in your history.")}
        </p>
      </div>

      {toast && <Toast key={toast.key} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}
