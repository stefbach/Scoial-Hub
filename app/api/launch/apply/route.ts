// POST /api/launch/apply { companyId, strategy, productName? }
// Applique la stratégie dans l'app — EN BROUILLONS RÉVERSIBLES (décision produit) :
//   - PUBLICITAIRE : 1 campagne EN PAUSE + 1 ad set par canal (aucun budget engagé)
//   - ORGANIQUE    : 1 post en BROUILLON (needsReview) par canal, à valider
// Garde d'écriture (edit). Aucune dépense ni publication automatique.

export const runtime = "nodejs";
export const maxDuration = 45;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { createCampaign } from "@/lib/repositories/campaigns";
import { createAdSet } from "@/lib/repositories/ad-sets";
import { createScheduledPost } from "@/lib/repositories/scheduled-posts";
import type { ApplyResult, LaunchStrategy } from "@/lib/launch/types";
import type { Platform } from "@/lib/types";

const VALID: Platform[] = ["facebook", "instagram", "linkedin", "tiktok"];
const isPlatform = (c: unknown): c is Platform => typeof c === "string" && VALID.includes(c as Platform);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      strategy?: LaunchStrategy;
      productName?: string;
    };
    const companyId = body.companyId;
    const strategy = body.strategy;
    const product = (body.productName ?? "Lancement").slice(0, 60);
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    if (!strategy) return NextResponse.json({ error: "strategy requise" }, { status: 400 });

    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const result: ApplyResult = { campaignsCreated: 0, adSetsCreated: 0, postsCreated: 0 };

    // ── Publicitaire : 1 campagne en pause + ad sets ────────────────────────
    const paid = (strategy.paid ?? []).filter((p) => isPlatform(p.channel));
    if (paid.length > 0) {
      // Le modèle de campagne pub est centré Meta ("FB"/"IG"). On mappe les canaux
      // Meta ; les ad sets gardent le canal exact en placement (TikTok/LinkedIn inclus).
      const META_MAP: Record<string, "FB" | "IG"> = { facebook: "FB", instagram: "IG" };
      const platforms = Array.from(
        new Set(paid.map((p) => META_MAP[p.channel]).filter(Boolean))
      ) as ("FB" | "IG")[];
      const campaign = await createCampaign(companyId, {
        name: `Lancement — ${product}`,
        objective: paid[0]?.objective || strategy.positioning || "Lancement",
        platforms,
        status: "paused",
        enabled: false,
        spend: 0,
        budget: 0,
      });
      result.campaignsCreated = 1;
      result.campaignId = campaign.id;

      for (const play of paid) {
        const adSet = await createAdSet(campaign.id, {
          name: `${play.channel} · ${(play.angles?.[0] ?? play.objective ?? "").slice(0, 50)}`,
          placement: play.channel,
          targeting: (play.audience ?? "").slice(0, 280),
          dailyBudget: 0,
          budgetType: "daily",
          optimizationGoal: "conversions",
          status: "paused",
          enabled: false,
        });
        if (adSet) result.adSetsCreated += 1;
      }
    }

    // ── Organique : 1 brouillon par canal ───────────────────────────────────
    const organic = (strategy.organic ?? []).filter((p) => isPlatform(p.channel));
    for (const play of organic) {
      const bodyText = [
        play.hooks?.[0] ?? play.angles?.[0] ?? "",
        play.formats?.length ? `Format : ${play.formats.join(", ")}` : "",
        play.postingCadence ? `Cadence : ${play.postingCadence}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      await createScheduledPost(companyId, {
        platform: play.channel,
        title: `${product} — ${(play.objective ?? "Organique").slice(0, 50)}`,
        date: "",
        time: "",
        source: "manual",
        status: "draft",
        needsReview: true,
        body: bodyText.slice(0, 1500),
      });
      result.postsCreated += 1;
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("[POST /api/launch/apply]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
