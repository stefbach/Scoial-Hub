// POST /api/editor/subtitles { companyId, src, lang? }
//   → { segments: [{ start, end, text }] }
//
// Transcrit une piste parlée en segments minutés, que le banc de montage
// transforme en calques de texte ÉDITABLES.
//
// Le sous-titrage existant de la plateforme incruste les sous-titres dans la
// vidéo et rend un fichier fini : impossible de corriger une faute ou de
// recaler un mot. Ici, la transcription est une donnée — l'utilisateur reste
// maître du texte, de son minutage et de son style.

export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { transcribe } from "@/lib/ai/replicate";

/** Longueur au-delà de laquelle un segment devient illisible à l'écran. */
const MAX_CHARS = 90;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { companyId?: string; src?: string; lang?: string };
    const guard = await requireCompanyAccess(body.companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const src = body.src?.trim();
    // Une adresse publique est indispensable : le service de transcription va
    // chercher le fichier lui-même. Une adresse blob: ou un chemin local ne lui
    // dirait rien.
    if (!src || !/^https?:\/\//.test(src)) {
      return NextResponse.json({ error: "Média source publiquement accessible requis." }, { status: 400 });
    }

    const result = await transcribe(src, body.lang === "en" ? "en" : body.lang === "fr" ? "fr" : undefined);
    if (result.error === "not-configured") {
      return NextResponse.json(
        { error: "Transcription non configurée (REPLICATE_API_TOKEN absent)." },
        { status: 503 }
      );
    }
    if (!result.segments) {
      return NextResponse.json({ error: result.error ?? "Transcription impossible." }, { status: 502 });
    }

    // Un sous-titre trop long ne se lit pas : on le coupe à la ponctuation la
    // plus proche du milieu, en répartissant la durée au prorata.
    const segments = result.segments.flatMap((s) => {
      if (s.text.length <= MAX_CHARS) return [s];
      const middle = Math.floor(s.text.length / 2);
      const cut = s.text.lastIndexOf(" ", middle) > 0 ? s.text.lastIndexOf(" ", middle) : middle;
      const ratio = cut / s.text.length;
      const mid = s.start + (s.end - s.start) * ratio;
      return [
        { start: s.start, end: mid, text: s.text.slice(0, cut).trim() },
        { start: mid, end: s.end, text: s.text.slice(cut).trim() },
      ].filter((x) => x.text.length > 0);
    });

    return NextResponse.json({ segments });
  } catch (err) {
    console.error("[POST /api/editor/subtitles]", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
