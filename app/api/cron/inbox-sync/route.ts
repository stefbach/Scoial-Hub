/**
 * GET /api/cron/inbox-sync
 *
 * Synchronisation AUTOMATIQUE de la messagerie Meta (commentaires organiques
 * et publicitaires, DM Messenger/Instagram, avis) pour toutes les sociétés
 * dont une Page Facebook est connectée — déclenchée par Vercel Cron
 * (cf. vercel.json). L'utilisateur n'a plus besoin de cliquer
 * « Synchroniser Meta » : la boîte se remplit toute seule, et l'import étant
 * idempotent chaque passage reprend là où le précédent s'est arrêté.
 *
 * Le budget temps de la route (60 s) est partagé entre les sociétés ;
 * chaque société reçoit au moins 12 s. Les résultats sont journalisés
 * ([inbox/cron]) pour le diagnostic.
 *
 * Sécurité : valide `Authorization: Bearer <CRON_SECRET>` (même convention
 * que /api/cron/publish-due). Sans CRON_SECRET (dev/local), laisse passer.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { syncMetaComments } from "@/lib/inbox/meta-sync";

export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ ok: false, note: "Supabase non configuré." });

  // Sociétés avec une Page Facebook connectée (le contexte Meta complet —
  // IG, comptes pub — est résolu par syncMetaComments).
  const { data, error } = await sb
    .from("sh_channel_connections")
    .select("company_id")
    .eq("channel", "facebook")
    .eq("status", "connected");
  if (error) {
    console.error("[inbox/cron] lecture connexions:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const companyIds = [...new Set((data ?? []).map((r) => String(r.company_id)))];
  const overallDeadline = Date.now() + 52_000; // marge sous les 60 s Vercel
  const results: Array<Record<string, unknown>> = [];

  for (let i = 0; i < companyIds.length; i++) {
    const remainingMs = overallDeadline - Date.now();
    if (remainingMs < 5_000) break; // trop juste : au prochain passage
    const share = Math.max(12_000, Math.floor(remainingMs / (companyIds.length - i)));
    const budget = Math.min(share, remainingMs - 2_000);
    try {
      const r = await syncMetaComments(companyIds[i], budget);
      results.push({ companyId: companyIds[i], imported: r.imported, note: r.note });
    } catch (e) {
      results.push({ companyId: companyIds[i], error: e instanceof Error ? e.message : "échec" });
    }
  }

  console.warn("[inbox/cron]", JSON.stringify(results));
  return NextResponse.json({ ok: true, companies: companyIds.length, results });
}
