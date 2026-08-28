// Genere une CHARTE GRAPHIQUE complete a partir du LOGO (Claude vision) :
// palette avec roles, typographies, ton de voix, regles d'usage du logo,
// do/don't, style d'image et baseline. Le resultat structure est ensuite
// affiche et exporte (charte visuelle) cote client, et memorise dans le kit.

export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCompanyUuid } from "@/lib/repositories/resolve-company";
import { isAiConfigured, env } from "@/lib/env";
import { isSafeRemoteUrl } from "@/lib/security/url-guard";
import { normalizeLang, langName, langRule, pick } from "@/lib/ai/lang";
import type { BrandChart } from "@/lib/brand-kit/types";

const SUPPORTED = ["image/png", "image/jpeg", "image/gif", "image/webp"];

function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mediaType: m[1], data: m[2] };
}

// Recupere une image https et la convertit en base64 (pour la vision).
async function fetchAsBase64(url: string): Promise<{ mediaType: string; data: string } | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "image/png").split(";")[0].trim();
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 6_500_000) return null;
    return { mediaType: SUPPORTED.includes(ct) ? ct : "image/png", data: buf.toString("base64") };
  } catch {
    return null;
  }
}

function normHex(c: unknown, fallback: string): string {
  return typeof c === "string" && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : fallback;
}
function strArr(v: unknown, max: number): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, max) : [];
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, imageDataUrl, logoUrl, lang: rawLang } = (await req.json()) as {
      companyId?: string; imageDataUrl?: string; logoUrl?: string; lang?: string;
    };
    const lang = normalizeLang(rawLang);
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    // Source de l'image : data URL de session, sinon logo heberge (https).
    let img: { mediaType: string; data: string } | null = null;
    if (imageDataUrl) {
      const p = parseDataUrl(imageDataUrl);
      if (p) img = { mediaType: SUPPORTED.includes(p.mediaType) ? p.mediaType : "image/png", data: p.data };
    }
    if (!img && logoUrl && isSafeRemoteUrl(logoUrl)) img = await fetchAsBase64(logoUrl);
    if (!img) {
      return NextResponse.json(
        { error: pick(lang, "Logo introuvable — importez d'abord un logo.", "Logo not found — upload a logo first.") },
        { status: 400 }
      );
    }

    // Contexte marque (nom) pour une charte coherente.
    let name = "";
    try {
      const uuid = await resolveCompanyUuid(companyId);
      const sb = createAdminClient();
      if (sb) {
        const { data: c } = await sb.from("sh_companies").select("name").eq("id", uuid).maybeSingle();
        if (c) name = String(c.name ?? "");
      }
    } catch { /* degradation */ }

    const empty: BrandChart = {
      palette: [], headingFont: "", bodyFont: "", typographyNote: "", toneWords: [], voice: "",
      logoUsage: [], dos: [], donts: [], imagery: "", tagline: "", aiGenerated: false, generatedAt: null,
    };
    if (!isAiConfigured) return NextResponse.json({ chart: empty });

    // La charte est AFFICHÉE telle quelle : ses textes suivent la langue de
    // l'interface, jamais le français par défaut (recette R24 #7).
    const L = langName(lang);
    const roles = pick(
      lang,
      "Principale|Secondaire|Accent|Fond|Texte",
      "Primary|Secondary|Accent|Background|Text"
    );
    const prompt = `Tu es directeur artistique senior. A partir de CE LOGO${name ? ` de la marque « ${name} »` : ""}, construis une CHARTE GRAPHIQUE professionnelle et coherente.
Deduis les couleurs de marque depuis le logo et complete par des couleurs neutres/fonctionnelles harmonieuses.
${langRule(lang)}
Retourne STRICTEMENT ce JSON (sans texte autour) :
{
  "palette": [{"hex":"#xxxxxx","name":"nom de la couleur en ${L}","role":"${roles}"}],
  "headingFont": "police de titres (Google Fonts, ex. Poppins)",
  "bodyFont": "police de texte (Google Fonts, ex. Inter)",
  "typographyNote": "1 phrase en ${L} sur l'usage typographique",
  "toneWords": ["3 a 5 mots de ton en ${L}"],
  "voice": "1-2 phrases en ${L} decrivant la voix de marque",
  "logoUsage": ["3-4 regles en ${L} (zone de protection, taille mini, fonds autorises)"],
  "dos": ["3 bonnes pratiques en ${L}"],
  "donts": ["3 erreurs a eviter en ${L}"],
  "imagery": "1-2 phrases en ${L} sur le style d'images/photos",
  "tagline": "une baseline courte en ${L} alignee a la marque"
}`;

    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const { createClaudeMessage } = await import("@/lib/ai/anthropic");
      const client = new Anthropic({ apiKey: env.anthropicKey });
      const msg = await createClaudeMessage(client, {
        model: env.anthropicModel,
        max_tokens: 1200,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: img.mediaType as "image/png", data: img.data } },
            { type: "text", text: prompt },
          ],
        }],
      });
      const raw = msg.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("");
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return NextResponse.json({ chart: empty });
      const p = JSON.parse(match[0]) as Record<string, unknown>;
      const palette = (Array.isArray(p.palette) ? p.palette : [])
        .map((c) => {
          const o = c as Record<string, unknown>;
          return { hex: normHex(o.hex, ""), name: typeof o.name === "string" ? o.name : "", role: typeof o.role === "string" ? o.role : "" };
        })
        .filter((c) => c.hex)
        .slice(0, 6);
      const chart: BrandChart = {
        palette,
        headingFont: typeof p.headingFont === "string" ? p.headingFont : "Poppins",
        bodyFont: typeof p.bodyFont === "string" ? p.bodyFont : "Inter",
        typographyNote: typeof p.typographyNote === "string" ? p.typographyNote : "",
        toneWords: strArr(p.toneWords, 6),
        voice: typeof p.voice === "string" ? p.voice : "",
        logoUsage: strArr(p.logoUsage, 5),
        dos: strArr(p.dos, 5),
        donts: strArr(p.donts, 5),
        imagery: typeof p.imagery === "string" ? p.imagery : "",
        tagline: typeof p.tagline === "string" ? p.tagline : "",
        aiGenerated: true,
        generatedAt: new Date().toISOString(),
      };
      return NextResponse.json({ chart });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.warn("[generate-brand-chart] fallback:", detail);
      return NextResponse.json({
        chart: {
          ...empty,
          voice: pick(lang, `Génération indisponible : ${detail}.`, `Generation unavailable: ${detail}.`),
        },
      });
    }
  } catch (e) {
    console.error("[POST /api/ai/generate-brand-chart]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
