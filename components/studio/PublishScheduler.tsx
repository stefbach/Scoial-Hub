"use client";

// ── PublishScheduler — publier / programmer / promouvoir un média ─────────────
// Bloc réutilisable depuis n'importe quel studio (vidéo, avatar, affiche…) :
//   • choisir les réseaux (Facebook / Instagram / TikTok),
//   • PUBLIER MAINTENANT (création + publication réelle via les connecteurs),
//   • PROGRAMMER (date + heure → publié automatiquement par le cron),
//   • UTILISER DANS UNE PUB (ouvre la création de pub Meta avec le média prérempli).
// Résultat détaillé par réseau (succès / erreur claire, ex. TikTok non câblé).

import { useState } from "react";
import { useT } from "@/lib/i18n";

const NETS = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
] as const;

export function PublishScheduler({
  companyId,
  mediaUrl,
  mediaKind,
  defaultText = "",
}: {
  companyId: string;
  mediaUrl: string;
  mediaKind: "image" | "video";
  /** Texte/légende par défaut de la publication (modifiable). */
  defaultText?: string;
}) {
  const t = useT();
  const [nets, setNets] = useState<string[]>(["instagram"]);
  const [text, setText] = useState(defaultText);
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00");
  const [busy, setBusy] = useState<"now" | "later" | null>(null);
  const [results, setResults] = useState<{ net: string; ok: boolean; msg: string }[]>([]);

  /** Crée la publication programmée pour un réseau ; renvoie son id. */
  async function createPost(net: string, d: string, tm: string): Promise<string | null> {
    const body = text.trim();
    const r = await fetch("/api/scheduled-posts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId, platform: net,
        title: (body.slice(0, 48) || t("Création studio", "Studio creation")) + (body.length > 48 ? "…" : ""),
        body, date: d, time: tm, status: "scheduled", source: "manual",
        media: { kind: mediaKind, url: mediaUrl },
      }),
    });
    if (!r.ok) return null;
    const dta = await r.json().catch(() => ({}));
    return (dta?.id as string) ?? null;
  }

  async function schedule() {
    if (busy || nets.length === 0) return;
    setBusy("later"); setResults([]);
    const out: { net: string; ok: boolean; msg: string }[] = [];
    for (const net of nets) {
      const id = await createPost(net, date, time).catch(() => null);
      out.push(id
        ? { net, ok: true, msg: t(`programmée le ${date} à ${time}`, `scheduled for ${date} at ${time}`) }
        : { net, ok: false, msg: t("échec de la programmation", "scheduling failed") });
    }
    setResults(out); setBusy(null);
  }

  async function publishNow() {
    if (busy || nets.length === 0) return;
    setBusy("now"); setResults([]);
    const now = new Date();
    const d = now.toISOString().slice(0, 10);
    const tm = now.toTimeString().slice(0, 5);
    const out: { net: string; ok: boolean; msg: string }[] = [];
    for (const net of nets) {
      try {
        const id = await createPost(net, d, tm);
        if (!id) { out.push({ net, ok: false, msg: t("création impossible", "couldn't create the post") }); continue; }
        const pr = await fetch(`/api/scheduled-posts/${id}/publish`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId }),
        });
        const pd = await pr.json().catch(() => ({}));
        out.push(pr.ok
          ? { net, ok: true, msg: pd.simulated ? t("publiée (simulation)", "published (simulated)") : t("publiée ✓", "published ✓") }
          : { net, ok: false, msg: (pd.error as string) || t("échec de la publication", "publish failed") });
      } catch {
        out.push({ net, ok: false, msg: t("erreur réseau", "network error") });
      }
    }
    setResults(out); setBusy(null);
  }

  // ── Utiliser dans une pub Meta ──────────────────────────────────────────────
  // Le média (et sa légende) préremplissent la création de campagne via les query
  // params reconnus par /campaigns/new (?image=… | ?video=… &text=…).
  const adHref = `/campaigns/new?${new URLSearchParams({
    [mediaKind === "video" ? "video" : "image"]: mediaUrl,
    ...(text.trim() ? { text: text.trim() } : {}),
  }).toString()}`;

  return (
    <div className="space-y-2 rounded-xl border border-hair bg-canvas/60 p-3">
      <p className="section-label">{t("Publication organique", "Organic post")}</p>

      {/* Réseaux cibles */}
      <div className="flex flex-wrap gap-1.5">
        {NETS.map((n) => (
          <button key={n.id} type="button"
            onClick={() => setNets((prev) => prev.includes(n.id) ? prev.filter((x) => x !== n.id) : [...prev, n.id])}
            className={`rounded-full px-2.5 py-1 text-2xs font-medium transition-colors ${nets.includes(n.id) ? "bg-page text-white" : "bg-card text-muted ring-1 ring-hair hover:text-ink"}`}>
            {n.label}
          </button>
        ))}
      </div>

      {/* Légende */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder={t("Légende de la publication…", "Post caption…")}
        className="input resize-none text-xs"
      />

      {/* Date + heure (pour la programmation) */}
      <div className="flex items-center gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input flex-1 text-xs" />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input w-24 text-xs" />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={publishNow} disabled={busy !== null || nets.length === 0}
          className="btn-primary flex-1 justify-center text-xs disabled:opacity-50">
          {busy === "now" ? t("Publication…", "Publishing…") : t("🚀 Publier maintenant", "🚀 Publish now")}
        </button>
        <button type="button" onClick={schedule} disabled={busy !== null || nets.length === 0}
          className="btn-secondary flex-1 justify-center text-xs disabled:opacity-50">
          {busy === "later" ? t("Programmation…", "Scheduling…") : t("📅 Programmer", "📅 Schedule")}
        </button>
      </div>

      {/* Utiliser le média dans une publicité Meta (préremplie) */}
      <div className="border-t border-hair pt-2">
        <p className="section-label mb-1">{t("Publicité", "Ad")}</p>
        <a href={adHref}
          className="btn-secondary flex w-full items-center justify-center text-xs">
          {t("📣 Utiliser dans une pub Meta", "📣 Use in a Meta ad")}
        </a>
      </div>

      {/* Résultats par réseau */}
      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((r) => (
            <li key={r.net} className={`text-2xs ${r.ok ? "text-success-600" : "text-danger-600"}`}>
              {r.ok ? "✓" : "✕"} <span className="capitalize">{r.net}</span> — {r.msg}
            </li>
          ))}
        </ul>
      )}
      <p className="text-2xs text-muted">
        {t("Les programmées partent automatiquement (vérification toutes les 10 min) — visibles dans Programmés.", "Scheduled posts go out automatically (checked every 10 min) — visible in Scheduled.")}
      </p>
    </div>
  );
}
