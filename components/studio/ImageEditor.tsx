"use client";

// ── ImageEditor — retouche IA façon vrai studio ───────────────────────────────
// On part du visuel courant et on le MODIFIE par consignes successives
// (« enlève le texte », « fond plus sombre », « ajoute un reflet doré »…) via
// les modèles d'édition (Flux Kontext, Qwen Edit, Nano-Banana), ou on
// l'améliore (upscale Real-ESRGAN / Clarity). Historique de versions : chaque
// résultat s'empile, on peut revenir à n'importe quelle version d'un clic.

import { useEffect, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { useT } from "@/lib/i18n";
import { EDIT_MODELS, UPSCALE_MODELS } from "@/lib/ai/model-catalog";

export function ImageEditor({
  imageUrl,
  aspect,
  onResult,
}: {
  /** Visuel courant (URL https ou data-URI). */
  imageUrl: string;
  aspect?: string;
  /** Nouvelle version produite (ou restaurée) → à appliquer au studio. */
  onResult: (url: string) => void;
}) {
  const { company } = useCompany();
  const t = useT();
  const [instruction, setInstruction] = useState("");
  const [editModel, setEditModel] = useState(EDIT_MODELS[0].id);
  const [upModel, setUpModel] = useState(UPSCALE_MODELS[0].id);
  const [busy, setBusy] = useState<"edit" | "upscale" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [versions, setVersions] = useState<string[]>([]);

  // Nouveau visuel de base (généré/uploadé ailleurs) → on repart de lui.
  useEffect(() => {
    setVersions((v) => (v[0] === imageUrl ? v : [imageUrl]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl.slice(0, 80)]);

  async function run(mode: "edit" | "upscale") {
    if (busy) return;
    if (mode === "edit" && !instruction.trim()) {
      setNote(t("Décrivez la retouche à appliquer.", "Describe the edit to apply."));
      return;
    }
    setBusy(mode); setNote(null);
    try {
      const current = versions[versions.length - 1] ?? imageUrl;
      const r = await fetch("/api/ai/edit-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          imageUrl: current,
          mode,
          prompt: mode === "edit" ? instruction.trim() : undefined,
          model: mode === "edit" ? editModel : upModel,
          aspect,
        }),
      });
      const d = await r.json();
      if (d.simulated) { setNote(t("Édition IA non configurée (REPLICATE_API_TOKEN).", "AI editing not configured (REPLICATE_API_TOKEN).")); return; }
      if (!r.ok || !d.url) { setNote((d.error as string) || t("Échec de la retouche.", "Edit failed.")); return; }
      setVersions((v) => [...v, d.url]);
      onResult(d.url);
      if (mode === "edit") setInstruction("");
    } catch {
      setNote(t("Erreur réseau.", "Network error."));
    } finally { setBusy(null); }
  }

  function restore(i: number) {
    const url = versions[i];
    if (!url) return;
    setVersions((v) => v.slice(0, i + 1));
    onResult(url);
  }

  const inputCls = "input text-xs";

  return (
    <div className="studio-card p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="studio-badge">✎</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink">{t("Retouche IA du visuel", "AI visual editing")}</h3>
          <p className="text-2xs text-muted">{t("Modifiez par consignes, comme dans un vrai studio — chaque version est conservée.", "Edit with instructions, like a real studio — every version is kept.")}</p>
        </div>
      </div>

      {/* Retouche guidée */}
      <div className="space-y-2">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={2}
          placeholder={t("Ex : « rends le fond plus sombre et ajoute un reflet doré », « enlève le texte »", "E.g. “make the background darker and add a golden glow”, “remove the text”")}
          className="input resize-none text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select value={editModel} onChange={(e) => setEditModel(e.target.value)} className={`${inputCls} flex-1 min-w-[180px]`} title={t("Modèle d'édition", "Edit model")}>
            {EDIT_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}{m.note ? ` — ${m.note}` : ""}</option>)}
          </select>
          <button type="button" onClick={() => run("edit")} disabled={busy !== null || !instruction.trim()} className="btn-primary shrink-0 text-xs disabled:opacity-50">
            {busy === "edit" ? t("Retouche…", "Editing…") : t("✨ Appliquer", "✨ Apply")}
          </button>
        </div>
      </div>

      {/* Upscale */}
      <div className="flex flex-wrap items-center gap-2 border-t border-hair pt-3">
        <select value={upModel} onChange={(e) => setUpModel(e.target.value)} className={`${inputCls} flex-1 min-w-[180px]`} title={t("Modèle d'amélioration", "Upscale model")}>
          {UPSCALE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}{m.note ? ` — ${m.note}` : ""}</option>)}
        </select>
        <button type="button" onClick={() => run("upscale")} disabled={busy !== null} className="btn-secondary shrink-0 text-xs disabled:opacity-50">
          {busy === "upscale" ? t("Amélioration…", "Upscaling…") : t("⬆ Améliorer (HD)", "⬆ Upscale (HD)")}
        </button>
      </div>

      {note && <p className="rounded-lg bg-canvas px-3 py-2 text-2xs text-muted">{note}</p>}

      {/* Historique de versions */}
      {versions.length > 1 && (
        <div className="border-t border-hair pt-2">
          <p className="section-label mb-1.5">{t("Versions", "Versions")}</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {versions.map((u, i) => (
              <button key={`${i}-${u.slice(-12)}`} type="button" onClick={() => restore(i)}
                title={i === 0 ? t("Original", "Original") : t(`Version ${i}`, `Version ${i}`)}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2 transition-all ${i === versions.length - 1 ? "ring-page" : "ring-hair hover:ring-page/60"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-full w-full object-cover" />
                <span className="absolute bottom-0 right-0 rounded-tl bg-ink/70 px-1 text-[9px] text-white">{i === 0 ? "v0" : `v${i}`}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
