"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { Meter } from "@/components/ui/Meter";
import { Toast } from "@/components/ui/Toast";
import { SubHeader, SectionLabel } from "./shared";
import { AI_GENERATION_LOGS, type AiGenLog } from "@/lib/mock-data";
import { useCompany } from "@/lib/company-context";
import { eur } from "@/lib/format";
import { useT } from "@/lib/i18n";

interface MediaAssetRow {
  url: string;
  type: "image" | "video";
  format?: string;
  source?: string;
  prompt?: string;
  createdAt?: string;
}

const IMAGE_MODELS = ["Flux 2 Pro", "Ideogram v3", "GPT Image Mini"];
const VIDEO_MODELS = ["Kling 3.0", "Veo 3.1 Fast"];

export function AiPrefs() {
  const t = useT();
  const { company, data } = useCompany();

  const [imageModel, setImageModel] = useState(IMAGE_MODELS[0]);
  const [videoModel, setVideoModel] = useState(VIDEO_MODELS[0]);
  const [brandVoiceDefault, setBrandVoiceDefault] = useState(true);

  // Spend caps (auto-save acceptable per spec).
  const [textCap, setTextCap] = useState(10);
  const [imageCap, setImageCap] = useState(25);
  const [videoCap, setVideoCap] = useState(40);
  const [toast, setToast] = useState<string | null>(null);
  const [openLog, setOpenLog] = useState<AiGenLog | null>(null);

  // Dépenses IA RÉELLES de la société (depuis les données hydratées). Pas de
  // placeholder fictif : le suivi par-type texte n'existe pas encore → 0 honnête.
  const textSpend = 0;
  const imageSpend = data.library.imageSpend;
  const videoSpend = data.library.videoSpend;

  // UAT #17 — l'historique IA lisait un mock vide, d'où « Aucune génération »
  // alors que des centaines existaient. On lit désormais la VRAIE source
  // (sh_media_assets via /api/media) : visuels et vidéos réellement générés.
  // `realLoaded` distingue « pas encore chargé » de « réellement vide ».
  const [realAssets, setRealAssets] = useState<MediaAssetRow[] | null>(null);

  useEffect(() => {
    if (!company.id) { setRealAssets([]); return; }
    let cancelled = false;
    setRealAssets(null);
    fetch(`/api/media?companyId=${encodeURIComponent(company.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setRealAssets(Array.isArray(d?.assets) ? (d.assets as MediaAssetRow[]) : []);
      })
      .catch(() => { if (!cancelled) setRealAssets([]); });
    return () => { cancelled = true; };
  }, [company.id]);

  // Convertit les assets média (générés par IA) en lignes d'historique IA.
  // On exclut les éléments du brand kit (logo/charte) qui ne sont pas des générations.
  const realHistory = useMemo<AiGenLog[]>(() => {
    if (!realAssets) return [];
    return realAssets
      .filter((a) => !(a.source ?? "").startsWith("brand-kit"))
      .map<AiGenLog>((a, i) => ({
        id: `${a.url}-${i}`,
        companyId: company.id,
        type: a.type === "video" ? "video" : "image",
        description: a.prompt || (a.type === "video" ? t("Vidéo générée", "Generated video") : t("Image générée", "Generated image")),
        model: a.source || (a.type === "video" ? t("Vidéo IA", "AI video") : t("Image IA", "AI image")),
        prompt: a.prompt || "",
        costEur: 0,
        createdAt: a.createdAt || new Date().toISOString(),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [realAssets, company.id, t]);

  // Source affichée : réelle si disponible, sinon repli sur le mock (mode démo).
  const mockHistory = useMemo(
    () => AI_GENERATION_LOGS.filter((g) => g.companyId === company.id).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt)
    ),
    [company.id]
  );
  const history = realHistory.length > 0 ? realHistory : mockHistory;
  const usageLoading = realAssets === null;
  const totalGenerations = realHistory.length > 0 ? realHistory.length : mockHistory.length;

  const saveCap = (kind: "text" | "image" | "video", v: number) => {
    if (kind === "text") setTextCap(v);
    if (kind === "image") setImageCap(v);
    if (kind === "video") setVideoCap(v);
    setToast(t(
      `Plafond ${kind === "text" ? "texte" : kind === "image" ? "image" : "vidéo"} mis à jour.`,
      `${kind === "text" ? "Text" : kind === "image" ? "Image" : "Video"} cap updated.`
    ));
  };

  return (
    <div>
      <SubHeader title={t("Préférences IA", "AI preferences")} scope="company" scopeLabel={company.name} />
      <p className="mb-4 text-sm text-muted">{t("Modèles par défaut, plafonds de dépenses mensuels et activité IA récente.", "Default models, monthly spend caps, and recent AI activity.")}</p>

      <SectionLabel>{t("Modèles par défaut", "Default models")}</SectionLabel>
      <div className="space-y-2">
        <div className="rounded-md border-hair border-hair p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink">{t("Texte IA", "AI text")}</div>
              <div className="text-2xs text-muted">{t("Utilisé pour les légendes, copies publicitaires, reformulations", "Used for captions, ad copy, rewrites")}</div>
            </div>
            <span className="shrink-0 text-ink">Anthropic Claude</span>
          </div>
        </div>
        <ModelRow label={t("Images IA", "AI images")} options={IMAGE_MODELS} value={imageModel} onChange={setImageModel} />
        <ModelRow label={t("Vidéo IA", "AI video")} options={VIDEO_MODELS} value={videoModel} onChange={setVideoModel} />
      </div>
      <div className="mt-1 text-2xs text-muted">
        {t("Les modèles peuvent être remplacés par génération dans les écrans Composer et Créer une annonce.", "Models can be overridden per generation in the Compose and Create Ad screens.")}
      </div>

      <SectionLabel>{t("Plafonds de dépenses mensuels", "Monthly spend caps")}</SectionLabel>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CapCard label={t("Texte", "Text")} used={textSpend} cap={textCap} onChange={(v) => saveCap("text", v)} />
        <CapCard label={t("Images", "Images")} used={imageSpend} cap={imageCap} onChange={(v) => saveCap("image", v)} />
        <CapCard label={t("Vidéo", "Video")} used={videoSpend} cap={videoCap} onChange={(v) => saveCap("video", v)} />
      </div>
      <div className="mt-1 text-2xs text-muted">{t("Les plafonds sont réinitialisés le 1er de chaque mois.", "Caps reset on the 1st of each month.")}</div>

      <SectionLabel>{t("Voix de marque par défaut", "Brand voice defaults")}</SectionLabel>
      <div className="flex items-center justify-between gap-3 rounded-md border-hair border-hair p-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink">{t("Utiliser la voix de marque par défaut", "Use brand voice by default")}</div>
          <div className="text-2xs text-muted">
            {t(`Quand activé, la génération de texte IA applique automatiquement la voix de marque de ${company.code}. Peut être remplacé par génération.`, `When ON, AI text generation automatically applies ${company.code}'s brand voice. Can be overridden per generation.`)}
          </div>
        </div>
        <Toggle key={String(brandVoiceDefault)} defaultOn={brandVoiceDefault} onChange={setBrandVoiceDefault} />
      </div>

      <SectionLabel>
        {t("Générations IA récentes", "Recent AI generations")}
        {!usageLoading && totalGenerations > 0 && (
          <span className="ml-1 font-normal text-muted">({totalGenerations})</span>
        )}
      </SectionLabel>
      <div className="card divide-y divide-hair">
        {usageLoading ? (
          <div className="px-3 py-6 text-center text-sm text-muted">{t("Chargement de l'activité IA…", "Loading AI activity…")}</div>
        ) : history.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted">
            {t(
              "Aucune génération d'image ou de vidéo enregistrée pour le moment.",
              "No image or video generations recorded yet.",
            )}
          </div>
        ) : (
          history.slice(0, 8).map((g) => (
            <button
              key={g.id}
              onClick={() => setOpenLog(g)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-canvas"
            >
              <div className="flex min-w-0 items-center gap-3">
                <TypeBadge type={g.type} />
                <div className="min-w-0">
                  <div className="truncate text-ink">{g.description}</div>
                  <div className="text-2xs text-muted">{format(new Date(g.createdAt), "d MMM HH:mm")} · {g.model}</div>
                </div>
              </div>
              <span className="shrink-0 text-2xs text-muted">{eur(g.costEur, { decimals: true })}</span>
            </button>
          ))
        )}
      </div>
      {history.length > 8 && (
        <button className="mt-2 text-2xs text-ai-text hover:underline">{t("Voir tout →", "View all →")}</button>
      )}

      {openLog && <LogDetailModal log={openLog} onClose={() => setOpenLog(null)} />}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function ModelRow({
  label, options, value, onChange,
}: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border-hair border-hair p-3 text-sm">
      <div className="min-w-0 font-medium text-ink">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 shrink-0 rounded-md border-hair border-hair bg-card px-3 py-1.5 text-sm text-ink focus:outline-none"
      >
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function CapCard({
  label, used, cap, onChange,
}: { label: string; used: number; cap: number; onChange: (v: number) => void }) {
  const pct = cap > 0 ? Math.round((used / cap) * 100) : 0;
  const tone =
    pct >= 90 ? "border-red-200 bg-red-50/40 text-red-700" :
    pct >= 70 ? "border-amber-200 bg-amber-50/40 text-amber-700" :
    "border-green-200 bg-green-50/40 text-green-700";
  return (
    <div className="rounded-md border-hair border-hair p-3">
      <div className="text-2xs text-muted">{label}</div>
      <div className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-2xs font-medium ${tone}`}>
        EUR {used.toFixed(2)} / {cap} · {pct}%
      </div>
      <div className="mt-2">
        <Meter value={used} max={cap} />
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm text-ink">
        <span className="text-2xs text-muted">Cap</span>
        <span className="text-2xs text-muted">EUR</span>
        <input
          type="number"
          min={0}
          value={cap}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 rounded-md border-hair border-hair bg-card px-2 py-1 text-right text-ink focus:outline-none"
        />
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: AiGenLog["type"] }) {
  const map: Record<AiGenLog["type"], { label: string; bg: string; text: string }> = {
    text:  { label: "Text",  bg: "bg-ai-textbg",   text: "text-ai-text" },
    image: { label: "Image", bg: "bg-ai-visualbg", text: "text-ai-visual" },
    video: { label: "Video", bg: "bg-amber-50",    text: "text-amber-700" },
  };
  const m = map[type];
  return (
    <span className={`rounded px-1.5 py-0.5 text-2xs font-medium ${m.bg} ${m.text}`}>{m.label}</span>
  );
}

function LogDetailModal({ log, onClose }: { log: AiGenLog; onClose: () => void }) {
  const t = useT();
  return (
    <Modal open onClose={onClose} width="max-w-md">
      <div className="border-b-hair border-hair px-4 py-3">
        <div className="text-sm font-semibold text-ink">{log.description}</div>
        <div className="text-2xs text-muted">{format(new Date(log.createdAt), "d MMM yyyy HH:mm")}</div>
      </div>
      <div className="space-y-2 p-4 text-sm">
        <dl className="space-y-1 text-2xs">
          <Row label={t("Type", "Type")} value={log.type} />
          <Row label={t("Modèle", "Model")} value={log.model} />
          <Row label={t("Coût", "Cost")} value={eur(log.costEur, { decimals: true })} />
        </dl>
        <div>
          <div className="section-label mb-1">{t("Prompt", "Prompt")}</div>
          <div className="rounded-md border-hair border-hair bg-canvas p-2 text-xs text-ink">{log.prompt}</div>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[100px_1fr]">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right capitalize text-ink">{value}</dd>
    </div>
  );
}
