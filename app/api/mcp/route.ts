/**
 * POST /api/mcp
 * Endpoint unique appelé par le serveur MCP (Claude Desktop).
 * Authentification : header `Authorization: Bearer axon_...`.
 * Body : { tool: string, args?: object }
 *
 * La clé API est liée à UNE entité — toutes les actions sont exécutées
 * dans le périmètre de cette entité.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/api-keys";
import { listCompanies } from "@/lib/repositories/companies";
import { env } from "@/lib/env";

function bearer(req: NextRequest): string {
  const h = req.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
}

export async function POST(req: NextRequest) {
  const key = bearer(req);
  const auth = await verifyApiKey(key);
  if (!auth) {
    return NextResponse.json({ error: "Clé API invalide ou révoquée." }, { status: 401 });
  }
  const { companyId } = auth;

  let body: { tool?: string; args?: Record<string, unknown> } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body JSON invalide." }, { status: 400 });
  }

  const tool = body.tool ?? "";
  const args = body.args ?? {};

  try {
    switch (tool) {
      case "list_companies": {
        const companies = await listCompanies();
        return NextResponse.json({ companies });
      }

      case "get_dashboard": {
        const companies = await listCompanies();
        const company = companies.find((c) => c.id === companyId) ?? companies[0] ?? null;
        return NextResponse.json({ company });
      }

      case "run_agents": {
        const objective = String(args.objective ?? "").trim();
        if (!objective) return NextResponse.json({ error: "objective requis" }, { status: 400 });
        const res = await fetch(`${env.appUrl}/api/agents/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objective,
            companyId,
            autonomy: typeof args.autonomy === "number" ? args.autonomy : 2,
          }),
        });
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.ok ? 200 : 502 });
      }

      case "run_veille": {
        const res = await fetch(`${env.appUrl}/api/veille/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId }),
        });
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.ok ? 200 : 502 });
      }

      case "generate_post": {
        const res = await fetch(`${env.appUrl}/api/ai/generate-post`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: String(args.prompt ?? ""),
            platform: String(args.platform ?? "linkedin"),
            brandVoice: String(args.brandVoice ?? "professional"),
            action: "generate",
          }),
        });
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.ok ? 200 : 502 });
      }

      default:
        return NextResponse.json({ error: `Outil inconnu : ${tool}` }, { status: 400 });
    }
  } catch (err) {
    console.error("[POST /api/mcp]", err);
    return NextResponse.json({ error: "Erreur serveur MCP." }, { status: 500 });
  }
}
