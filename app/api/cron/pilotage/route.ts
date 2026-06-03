/**
 * GET /api/cron/pilotage
 *
 * Cycle léger de pilotage 24/7, déclenché par Vercel Cron (toutes les 6 h).
 * Pour chaque entité connue :
 *   1. Récupère les KPIs (simulés ou réels à terme)
 *   2. Génère les alertes
 *   3. Journalise un résumé dans sh_audit_log (best-effort)
 * Retourne un résumé JSON (jamais fatal).
 *
 * Sécurité : valide le header `Authorization: Bearer <CRON_SECRET>`.
 * Si CRON_SECRET est absent (dev/local), laisse passer sans contrôle.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { listCompanies } from "@/lib/repositories/companies";
import { generateAlerts, computeNetworkKpis } from "@/lib/pilotage";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

/* ── Auth ──────────────────────────────────────────────────────────────── */

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // Dev local : pas de secret configuré → libre
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

/* ── Journalisation sh_audit_log (best-effort) ─────────────────────────── */

async function logAudit(
  companyId: string,
  event: string,
  details: Record<string, unknown>
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = createAdminClient();
    if (!supabase) return;
    await supabase.from("sh_audit_log").insert({
      company_id: companyId,
      event,
      details,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Silencieux — journalisation non critique
  }
}

/* ── Cycle par entité ──────────────────────────────────────────────────── */

interface CycleResult {
  companyId: string;
  companyName: string;
  alertCount: number;
  criticalCount: number;
  error?: string;
}

async function runCycleForCompany(
  companyId: string,
  companyName: string,
  market: string
): Promise<CycleResult> {
  try {
    const kpis = computeNetworkKpis(companyId, market, 30);
    const alerts = generateAlerts(companyId, market, kpis);

    const criticalCount = alerts.filter((a) => a.level === "critical").length;
    const alertCount = alerts.length;

    // Journalise dans sh_audit_log (best-effort)
    await logAudit(companyId, "cron_pilotage_cycle", {
      market,
      alertCount,
      criticalCount,
      alertTitles: alerts.map((a) => a.title),
      cycledAt: new Date().toISOString(),
    });

    return { companyId, companyName, alertCount, criticalCount };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[cron/pilotage] Erreur entité ${companyId}:`, errorMsg);
    return { companyId, companyName, alertCount: 0, criticalCount: 0, error: errorMsg };
  }
}

/* ── Handler principal ─────────────────────────────────────────────────── */

export async function GET(req: NextRequest): Promise<NextResponse> {
  const startedAt = new Date().toISOString();

  // Vérification de l'autorisation
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Récupérer toutes les entités
    const companies = await listCompanies();

    if (companies.length === 0) {
      return NextResponse.json({
        startedAt,
        finishedAt: new Date().toISOString(),
        entitesTraitees: 0,
        alertesDetectees: 0,
        critiquesDetectees: 0,
        resultats: [],
        message: "Aucune entité à traiter.",
      });
    }

    // Exécuter un cycle pour chaque entité (séquentiel, best-effort)
    const resultats: CycleResult[] = [];
    for (const company of companies) {
      const result = await runCycleForCompany(
        company.id,
        company.name,
        "France" // marché par défaut — extensible via company.defaultMarket
      );
      resultats.push(result);
    }

    const totalAlertes = resultats.reduce((s, r) => s + r.alertCount, 0);
    const totalCritiques = resultats.reduce((s, r) => s + r.criticalCount, 0);

    // Journaliser le cycle global (best-effort)
    await logAudit("system", "cron_pilotage_global", {
      entitesTraitees: companies.length,
      alertesDetectees: totalAlertes,
      critiquesDetectees: totalCritiques,
      finishedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      startedAt,
      finishedAt: new Date().toISOString(),
      entitesTraitees: resultats.length,
      alertesDetectees: totalAlertes,
      critiquesDetectees: totalCritiques,
      resultats,
    });
  } catch (err) {
    // Jamais fatal — retourner un 200 avec l'erreur
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[cron/pilotage] Erreur globale:", errorMsg);
    return NextResponse.json({
      startedAt,
      finishedAt: new Date().toISOString(),
      entitesTraitees: 0,
      alertesDetectees: 0,
      critiquesDetectees: 0,
      resultats: [],
      error: errorMsg,
    });
  }
}
