"use client";

// Médiathèque : galerie des visuels & vidéos de la marque (bibliothèque média),
// filtrable, avec actions « Décliner (IA) » et « Créer une pub » sur chaque média.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner, BusyHint } from "@/components/ui/Spinner";

interface Asset { url: string; type: "image" | "video"; format?: string; source?: string; createdAt?: string }
type Filter = "all" | "image" | "video";

const DERIVE_FORMATS = ["match", "1:1", "4:5", "9:16", "1.91:1"];

export default function MediaLibraryPage() {
  const { company } = useCompany();
  const companyId = company.id;
  const t = useT();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [note, setNote] = useState<string | null>(null);

  // Ajout par URL
  const [addUrl, setAddUrl] = useState("");

  // Déclinaison (img2img)
  const [derivingFrom, setDerivingFrom] = useState<string | null>(null);
  const [derivePrompt, setDerivePrompt] = useState("");
  const [deriveFormat, setDeriveFormat] = useState("match");
  const [deriving, setDeriving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/media?companyId=${encodeURIComponent(companyId)}`);
      const d = await r.json();
      setAssets(Array.isArray(d.assets) ? d.assets : []);
    } catch {
      setAssets([]);
    } finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function addByUrl() {
    const url = addUrl.trim();
    if (!url || !/^https?:\/\//i.test(url)) { setNote(t("URL invalide.", "Invalid URL.")); return; }
    const type: "image" | "video" = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url) ? "video" : "image";
    await fetch("/api/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, url, type, source: "import" }) });
    setAddUrl(""); setNote(t("Ajouté ✓", "Added ✓")); load();
  }

  async function derive() {
    if (!derivingFrom || !derivePrompt.trim()) { setNote(t("Écrivez un prompt de déclinaison.", "Write a derivation prompt.")); return; }
    setDeriving(true); setNote(null);
    try {
      const r = await fetch("/api/ai/generate-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: derivePrompt, imageUrl: derivingFrom, companyId, format: deriveFormat === "match" ? undefined : deriveFormat }),
      });
      const raw = await r.text();
      let d: { images?: Array<string | { url?: string }>; error?: string; simulated?: boolean } = {};
      try { d = raw ? JSON.parse(raw) : {}; } catch { setNote(t("Réponse inattendue.", "Unexpected response.")); return; }
      if (!r.ok) { setNote(d.error || t("Échec de la déclinaison.", "Derivation failed.")); return; }
      if (d.simulated) { setNote(t("Génération non configurée (REPLICATE_API_TOKEN).", "Generation not configured.")); return; }
      setDerivingFrom(null); setDerivePrompt("");
      setNote(t("Déclinaison créée ✓", "Variation created ✓"));
      load(); // l'asset est déjà enregistré côté serveur (companyId)
    } catch {
      setNote(t("Échec de la déclinaison.", "Derivation failed."));
    } finally { setDeriving(false); }
  }

  const shown = assets.filter((a) => filter === "all" || a.type === filter);
  const campaignHref = (a: Asset) => `/campaigns/new?${a.type === "video" ? "video" : "image"}=${encodeURIComponent(a.url)}`;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t("Médiathèque", "Media library")}
        actions={
          <div className="inline-flex rounded-lg border border-hair bg-canvas p-0.5">
            {(["all", "image", "video"] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${filter === f ? "bg-primary-600 text-white" : "text-muted hover:text-ink"}`}>
                {f === "all" ? t("Tout", "All") : f === "image" ? t("Images", "Images") : t("Vidéos", "Videos")}
              </button>
            ))}
          </div>
        }
      />

      <p className="mb-2 max-w-2xl text-sm text-muted">
        {t(
          "Tous vos visuels et vidéos créés (studios, campagnes, IA) — réutilisables : créez une pub d'un clic, ou déclinez une variante.",
          "All your created visuals and videos (studios, campaigns, AI) — reusable: create an ad in one click, or derive a variation."
        )}
      </p>
      <p className="mb-4 text-2xs text-muted">
        {t("Vous cherchez vos modèles de posts (texte) ?", "Looking for your post templates (text)?")}{" "}
        <Link href="/library" className="text-primary-600 hover:underline">{t("→ Modèles", "→ Templates")}</Link>
      </p>

      {/* Ajout par URL */}
      <div className="mb-5 flex flex-col gap-2 sm:flex-row">
        <input value={addUrl} onChange={(e) => setAddUrl(e.target.value)} placeholder={t("Ajouter un média par URL (https://…)", "Add media by URL (https://…)")}
          className="w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400" />
        <button onClick={addByUrl} className="btn-secondary shrink-0 text-sm">{t("Ajouter", "Add")}</button>
      </div>

      {note && <p className="mb-4 rounded-lg bg-canvas px-3 py-2 text-xs text-ink ring-1 ring-hair">{note}</p>}

      {/* Panneau de déclinaison */}
      {derivingFrom && (
        <div className="mb-5 rounded-xl border border-ai-text/30 bg-ai-textbg/30 p-4">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={derivingFrom} alt="" className="h-20 w-20 rounded-lg border border-hair object-cover" />
            <div className="min-w-0 flex-1">
              <span className="section-label text-ai-text">{t("Décliner ce visuel (IA)", "Derive this visual (AI)")}</span>
              <textarea value={derivePrompt} onChange={(e) => setDerivePrompt(e.target.value)} rows={2}
                placeholder={t("Ex : même style, fond bleu, format story…", "E.g. same style, blue background, story format…")}
                className="mt-2 w-full rounded-lg border border-hair bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400" />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select value={deriveFormat} onChange={(e) => setDeriveFormat(e.target.value)} className="rounded-lg border border-hair bg-canvas px-2 py-1 text-2xs text-ink">
                  {DERIVE_FORMATS.map((f) => <option key={f} value={f}>{f === "match" ? t("Garder le format", "Keep format") : f}</option>)}
                </select>
                <button onClick={derive} disabled={deriving} className="btn-primary inline-flex items-center gap-1.5 text-xs disabled:opacity-50">
                  {deriving && <Spinner size={14} className="text-white" />}
                  {deriving ? t("Génération…", "Generating…") : t("Générer la déclinaison", "Generate variation")}
                </button>
                <button onClick={() => setDerivingFrom(null)} className="btn-secondary text-xs">{t("Annuler", "Cancel")}</button>
              </div>
              {deriving && <BusyHint className="mt-2" label={t("Déclinaison en cours…", "Deriving…")} eta={t("~20–60 s", "~20–60 s")} />}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card flex items-center justify-center gap-2 py-16 text-sm text-muted">
          <Spinner size={18} className="text-primary-600" /> {t("Chargement…", "Loading…")}
        </div>
      ) : shown.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <p className="text-sm font-semibold text-ink">{t("Médiathèque vide", "Empty library")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            {t("Générez des visuels (Studio Affiches/Vidéo, page campagne) — ils apparaîtront ici, réutilisables.", "Generate visuals (Poster/Video Studio, campaign page) — they'll appear here, reusable.")}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/studio-affiche" className="btn-secondary text-sm">{t("Studio Affiches", "Poster Studio")}</Link>
            <Link href="/studio-video" className="btn-secondary text-sm">{t("Studio Vidéo", "Video Studio")}</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((a, i) => (
            <div key={i} className="card overflow-hidden p-0">
              <div className="relative aspect-square bg-canvas">
                {a.type === "video" ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={a.url} controls className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt="" className="h-full w-full object-cover" />
                )}
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {a.type === "video" ? "▶ " + t("vidéo", "video") : (a.format || "image")}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 p-2.5">
                <Link href={campaignHref(a)} className="btn-primary w-full justify-center text-2xs">{t("Créer une pub", "Create ad")}</Link>
                {a.type === "image" && (
                  <button onClick={() => { setDerivingFrom(a.url); setDerivePrompt(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="btn-secondary w-full justify-center text-2xs">{t("⤳ Décliner", "⤳ Derive")}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
