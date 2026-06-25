// GET /api/audit — journal d'audit RÉEL de l'organisation (table sh_audit_log).
// Réservé aux administrateurs du compte (owner/admin). Multi-tenant : on ne
// renvoie que les événements des sociétés de l'org de l'utilisateur.
//
// UAT #18 — l'écran lisait un mock vide ; il lit désormais la vraie table où les
// agents/actions consignent leurs traces. Si la table est réellement vide, l'UI
// affiche un état honnête « aucun événement enregistré » plutôt qu'un bug.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAccountAdmin } from "@/lib/auth/guard";
import { listCompanies } from "@/lib/repositories/companies";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { AuditEntity, AuditEvent, AuditSeverity } from "@/lib/mock-data";

const ENTITIES: AuditEntity[] = ["post", "campaign", "audience", "ad_safety", "team", "settings"];

/** Mappe une valeur libre `entity` de la table vers l'union typée de l'UI. */
function coerceEntity(v: unknown): AuditEntity {
  const s = String(v ?? "").toLowerCase();
  if ((ENTITIES as string[]).includes(s)) return s as AuditEntity;
  if (s.includes("campaign")) return "campaign";
  if (s.includes("audience")) return "audience";
  if (s.includes("safety")) return "ad_safety";
  if (s.includes("team") || s.includes("member") || s.includes("invit")) return "team";
  if (s.includes("post") || s.includes("publi") || s.includes("agent")) return "post";
  return "settings";
}

function coerceSeverity(v: unknown): AuditSeverity {
  const s = String(v ?? "info").toLowerCase();
  if (s === "warning" || s === "warn") return "warning";
  if (s === "danger" || s === "error" || s === "critical") return "danger";
  return "info";
}

/** Nom lisible d'un acteur (`agent:foo` → « Agent foo », sinon brut/Système). */
function actorName(actor: unknown): string {
  const s = String(actor ?? "").trim();
  if (!s) return "System";
  if (s.startsWith("agent:")) return `Agent ${s.slice(6)}`;
  return s;
}

export async function GET() {
  const g = await requireAccountAdmin();
  if (!g.ok || !g.orgId) {
    return NextResponse.json({ error: g.error }, { status: g.status ?? 403 });
  }

  // Sans backend configuré : aucune donnée fictive — liste vide honnête.
  if (!isSupabaseConfigured) return NextResponse.json({ events: [] as AuditEvent[] });
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ events: [] as AuditEvent[] });

  // Sociétés de l'org → restriction multi-tenant + mapping code société.
  const companies = await listCompanies(g.orgId);
  const codeById = new Map(companies.map((c) => [c.id, c.code]));
  const companyIds = companies.map((c) => c.id);
  if (companyIds.length === 0) return NextResponse.json({ events: [] as AuditEvent[] });

  const { data, error } = await sb
    .from("sh_audit_log")
    .select("id, created_at, actor, action, entity, entity_id, company_id, payload")
    .in("company_id", companyIds)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("[GET /api/audit]", error);
    return NextResponse.json({ error: "Lecture du journal impossible" }, { status: 500 });
  }

  const events: AuditEvent[] = (data ?? []).map((r) => {
    const payload = (r.payload ?? {}) as Record<string, unknown>;
    const action = String(r.action ?? "");
    const companyId = r.company_id ? String(r.company_id) : null;
    return {
      id: String(r.id),
      timestamp: String(r.created_at ?? new Date().toISOString()),
      userId: String(r.actor ?? ""),
      userName: actorName(r.actor),
      companyId,
      companyCode: companyId ? codeById.get(companyId) ?? null : null,
      entity: coerceEntity(r.entity),
      description: action || String(r.entity ?? "—"),
      severity: coerceSeverity(payload.severity),
      after: Object.keys(payload).length ? payload : undefined,
      ipAddress: typeof payload.ip === "string" ? payload.ip : "—",
      userAgent: typeof payload.userAgent === "string" ? payload.userAgent : "—",
    };
  });

  return NextResponse.json({ events });
}
