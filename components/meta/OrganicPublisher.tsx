"use client";

// Publication ORGANIQUE (normale) sur la Page Facebook + Instagram connectés,
// directement depuis le hub « Mes Pages ». Rédaction IA optionnelle + visuel IA.

import { useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";

function extractImageUrls(data: unknown): string[] {
  const d = data as { images?: Array<string | { url?: string }> };
  if (!Array.isArray(d?.images)) return [];
  return d.images.map((i) => (typeof i === "string" ? i : i?.url ?? "")).filter(Boolean);
}

export function OrganicPublisher() {
  const t = useT();
  const { company } = useCompany();
  const companyId = company.id;

  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [toFb, setToFb] = useState(true);
  const [toIg, setToIg] = useState(false);

  const [writing, setWriting] = useState(false);
  const [imaging, setImaging] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function writeWithAI() {
    setWriting(true); setError(null);
    try {
      const r = await fetch("/api/ai/generate-post", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text || t("Rédige un post engageant pour notre Page.", "Write an engaging post for our Page."), platform: "facebook", brandVoice: company.brandVoice ?? "", action: text ? "rewrite" : "generate", companyId }),
      });
      const d = await r.json();
      if (d.text) setText(d.text);
      if (d.mock) setError(t("Démo — IA texte non configurée.", "Demo — text AI not configured."));
    } catch {
      setError(t("Échec de la rédaction IA.", "AI writing failed."));
    } finally { setWriting(false); }
  }

  async function imageWithAI() {
    setImaging(true); setError(null);
    try {
      const r = await fetch("/api/ai/generate-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text || "social media brand visual, professional, high quality", platform: "facebook", n: 1 }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || t("Échec de génération d'image.", "Image generation failed.")); return; }
      const urls = extractImageUrls(d);
      if (urls[0]) setImageUrl(urls[0]);
      else if (d.simulated) setError(t("Génération d'image non configurée (REPLICATE_API_TOKEN).", "Image generation not configured (REPLICATE_API_TOKEN)."));
      else setError(t("Aucune image renvoyée. Réessayez.", "No image returned. Try again."));
    } finally { setImaging(false); }
  }

  async function publish() {
    if (!text.trim() && !imageUrl) { setError(t("Écrivez un texte ou ajoutez une image.", "Write text or add an image.")); return; }
    if (toIg && !imageUrl) { setError(t("Instagram exige une image.", "Instagram requires an image.")); return; }
    setPublishing(true); setError(null); setResult(null);
    try {
      const r = await fetch("/api/meta/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, text, imageUrl: imageUrl || undefined, targets: { facebook: toFb, instagram: toIg } }),
      });
      const d = await r.json();
      if (d.connected === false) { setError(t("Page Meta non connectée — connectez-la d'abord.", "Meta Page not connected — connect it first.")); return; }
      if (!r.ok) { setError(d.error ?? t("Échec.", "Failed.")); return; }
      const parts: string[] = [];
      if (d.results?.facebook) parts.push(`Facebook : ${d.results.facebook.ok ? t("publié ✓", "published ✓") : `✗ ${d.results.facebook.error}`}`);
      if (d.results?.instagram) parts.push(`Instagram : ${d.results.instagram.ok ? t("publié ✓", "published ✓") : `✗ ${d.results.instagram.error}`}`);
      setResult(parts.join(" · ") || t("Aucune cible sélectionnée.", "No target selected."));
      if (d.results?.facebook?.ok || d.results?.instagram?.ok) { setText(""); setImageUrl(""); }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Échec de la publication.", "Publish failed."));
    } finally { setPublishing(false); }
  }

  const inputCls = "w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400";

  return (
    <div className="space-y-3">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
        placeholder={t("Rédigez votre publication… (ou laissez l'IA écrire)", "Write your post… (or let the AI write it)")} className={inputCls} />

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={writeWithAI} disabled={writing} className="btn-secondary text-xs disabled:opacity-50">
          {writing ? t("Rédaction…", "Writing…") : t("✨ Rédiger avec l'IA", "✨ Write with AI")}
        </button>
        <button onClick={imageWithAI} disabled={imaging} className="btn-secondary text-xs disabled:opacity-50">
          {imaging ? t("Visuel…", "Visual…") : t("🖼 Générer un visuel", "🖼 Generate a visual")}
        </button>
      </div>

      <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder={t("URL d'image (optionnel — requis pour Instagram)", "Image URL (optional — required for Instagram)")} className={inputCls} />
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="max-h-48 rounded-lg border border-hair object-contain" />
      )}

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 text-sm text-ink">
          <input type="checkbox" checked={toFb} onChange={(e) => setToFb(e.target.checked)} className="accent-primary-600" /> Facebook
        </label>
        <label className="flex items-center gap-1.5 text-sm text-ink">
          <input type="checkbox" checked={toIg} onChange={(e) => setToIg(e.target.checked)} className="accent-primary-600" /> Instagram
          <span className="text-2xs text-muted">{t("(image requise)", "(image required)")}</span>
        </label>
        <button onClick={publish} disabled={publishing} className="btn-primary ml-auto text-sm disabled:opacity-50">
          {publishing ? t("Publication…", "Publishing…") : t("Publier maintenant", "Publish now")}
        </button>
      </div>

      {result && <p className="rounded-lg bg-success-50 px-3 py-2 text-xs text-success-700">{result}</p>}
      {error && <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{error}</p>}
    </div>
  );
}
