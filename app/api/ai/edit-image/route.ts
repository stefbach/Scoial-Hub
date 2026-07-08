// POST /api/ai/edit-image
// { companyId, imageUrl, mode: "edit"|"upscale", prompt?, model? }
// Retouche guidée (image + consigne → image) ou amélioration (upscale) via
// les catalogues EDIT_MODELS / UPSCALE_MODELS. Accepte URLs https et data-URI.

export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { runReplicateUrl, isReplicateConfigured } from "@/lib/ai/replicate";
import { EDIT_MODELS, UPSCALE_MODELS, DEFAULT_EDIT_MODEL_ID } from "@/lib/ai/model-catalog";
import { persistRemoteMedia } from "@/lib/repositories/media";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      imageUrl?: string;
      mode?: "edit" | "upscale";
      prompt?: string;
      model?: string;
      aspect?: string;
    };
    const { companyId, imageUrl, mode = "edit", prompt, aspect } = body;
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    if (!imageUrl?.trim()) return NextResponse.json({ error: "imageUrl requis" }, { status: 400 });
    if (mode === "edit" && !prompt?.trim()) {
      return NextResponse.json({ error: "Consigne de retouche requise" }, { status: 400 });
    }

    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    if (!isReplicateConfigured) {
      return NextResponse.json({ simulated: true, message: "Édition IA non configurée (REPLICATE_API_TOKEN)." });
    }

    const pool = mode === "upscale" ? UPSCALE_MODELS : EDIT_MODELS;
    const modelId = pool.some((m) => m.id === body.model)
      ? body.model!
      : mode === "upscale" ? UPSCALE_MODELS[0].id : DEFAULT_EDIT_MODEL_ID;
    const model = pool.find((m) => m.id === modelId)!;

    const input = model.buildInput((prompt ?? "").trim(), { imageUrl: imageUrl.trim(), aspect });
    const url = await runReplicateUrl(modelId, input);
    if (!url) {
      return NextResponse.json({ error: "Aucune image renvoyée par le modèle. Réessayez." }, { status: 502 });
    }
    // Persiste le résultat sur notre stockage (les URLs Replicate expirent ~1 h) :
    // sans cela, la retouche « disparaissait » à la prochaine ouverture/retouche.
    const durable = await persistRemoteMedia(companyId, url, "image");
    return NextResponse.json({ url: durable, model: modelId, mode });
  } catch (e) {
    console.error("[POST /api/ai/edit-image]", e);
    const msg = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
