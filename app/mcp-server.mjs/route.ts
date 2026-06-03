// Sert le serveur MCP AXON-AI en un seul fichier (téléchargé par l'installeur).
// Le serveur tourne sur la machine du client, en stdio, et appelle /api/mcp
// avec la clé API personnelle. Aucune dépendance hormis @modelcontextprotocol/sdk.

export const runtime = "nodejs";

const SERVER_SOURCE = String.raw`#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const API_URL = (process.env.AXON_API_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.AXON_API_KEY || "";

if (!API_URL || !API_KEY) {
  console.error("[axon-mcp] AXON_API_URL et AXON_API_KEY sont requis.");
  process.exit(1);
}

async function call(tool, args) {
  try {
    const res = await fetch(API_URL + "/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + API_KEY },
      body: JSON.stringify({ tool, args: args || {} }),
    });
    const text = await res.text();
    if (!res.ok) return "Erreur (" + res.status + ") : " + text;
    return text;
  } catch (e) {
    return "Erreur réseau : " + (e && e.message ? e.message : String(e));
  }
}

const TOOLS = [
  {
    name: "list_companies",
    description: "Liste les comptes / entités AXON-AI accessibles avec cette clé.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_dashboard",
    description: "Récupère l'entité courante et ses informations de pilotage.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "run_agents",
    description: "Lance l'orchestration multi-agent sur un objectif (stratégie, contenus, plan média).",
    inputSchema: {
      type: "object",
      properties: {
        objective: { type: "string", description: "Objectif en langage naturel." },
        autonomy: { type: "number", description: "Niveau d'autonomie 1 (reco), 2 (semi), 3 (auto). Défaut 2." },
      },
      required: ["objective"],
    },
  },
  {
    name: "run_veille",
    description: "Déclenche une analyse de veille concurrentielle pour l'entité.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "generate_post",
    description: "Génère un post organique prêt à publier.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Sujet / intention du post." },
        platform: { type: "string", description: "facebook | instagram | linkedin | tiktok" },
        brandVoice: { type: "string", description: "Ton de marque." },
      },
      required: ["prompt"],
    },
  },
];

const server = new Server(
  { name: "axon-ai", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = req.params.arguments || {};
  const out = await call(name, args);
  return { content: [{ type: "text", text: out }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[axon-mcp] serveur AXON-AI prêt (" + API_URL + ")");
`;

export async function GET() {
  return new Response(SERVER_SOURCE, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
