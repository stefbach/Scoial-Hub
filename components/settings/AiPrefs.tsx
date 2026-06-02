"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { Meter } from "@/components/ui/Meter";
import { Toast } from "@/components/ui/Toast";
import { SubHeader, SectionLabel } from "./shared";
import { AI_GENERATION_LOGS, type AiGenLog } from "@/lib/mock-data";
import { useCompany } from "@/lib/company-context";
import { eur } from "@/lib/format";

const IMAGE_MODELS = ["Flux 2 Pro", "Ideogram v3", "GPT Image Mini"];
const VIDEO_MODELS = ["Kling 3.0", "Veo 3.1 Fast"];

export function AiPrefs() {
  const { company, data } = useCompany();

  const [imageModel, setImageModel] = useState(IMAGE_MODELS[0]);
  const [videoModel, setVideoModel] = useState(VIDEO_MODELS[0]);
  const [brandVoiceDefault, setBrandVoiceDefault] = useState(true);

  // Spend caps (auto-save acceptable per spec).
  const [textCap, setTextCap] = useState(10);
  const [imageCap, setImageCap] = useState(data.library.aiBudgetCap > 0 ? 25 : 25);
  const [videoCap, setVideoCap] = useState(40);
  const [toast, setToast] = useState<string | null>(null);
  const [openLog, setOpenLog] = useState<AiGenLog | null>(null);

  // Current usage from existing mock data.
  const textSpend = 1.5; // placeholder — no per-type breakdown in mock
  const imageSpend = data.library.imageSpend;
  const videoSpend = data.library.videoSpend;

  // Filter generation history to this company.
  const history = useMemo(
    () => AI_GENERATION_LOGS.filter((g) => g.companyId === company.id).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt)
    ),
    [company.id]
  );

  const saveCap = (kind: "text" | "image" | "video", v: number) => {
    if (kind === "text") setTextCap(v);
    if (kind === "image") setImageCap(v);
    if (kind === "video") setVideoCap(v);
    setToast(`${kind === "text" ? "Text" : kind === "image" ? "Image" : "Video"} cap updated.`);
  };

  return (
    <div>
      <SubHeader title="AI preferences" scope="company" scopeLabel={company.name} />
      <p className="mb-4 text-sm text-muted">Default models, monthly spend caps, and recent AI activity.</p>

      <SectionLabel>Default models</SectionLabel>
      <div className="space-y-2">
        <div className="rounded-md border-hair border-hair p-3 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-ink">AI text</div>
              <div className="text-2xs text-muted">Used for captions, ad copy, rewrites</div>
            </div>
            <span className="text-ink">Anthropic Claude</span>
          </div>
        </div>
        <ModelRow label="AI images" options={IMAGE_MODELS} value={imageModel} onChange={setImageModel} />
        <ModelRow label="AI video" options={VIDEO_MODELS} value={videoModel} onChange={setVideoModel} />
      </div>
      <div className="mt-1 text-2xs text-muted">
        Models can be overridden per generation in the Compose and Create Ad screens.
      </div>

      <SectionLabel>Monthly spend caps</SectionLabel>
      <div className="grid grid-cols-3 gap-3">
        <CapCard label="Text" used={textSpend} cap={textCap} onChange={(v) => saveCap("text", v)} />
        <CapCard label="Images" used={imageSpend} cap={imageCap} onChange={(v) => saveCap("image", v)} />
        <CapCard label="Video" used={videoSpend} cap={videoCap} onChange={(v) => saveCap("video", v)} />
      </div>
      <div className="mt-1 text-2xs text-muted">Caps reset on the 1st of each month.</div>

      <SectionLabel>Brand voice defaults</SectionLabel>
      <div className="flex items-center justify-between rounded-md border-hair border-hair p-3">
        <div>
          <div className="text-sm font-medium text-ink">Use brand voice by default</div>
          <div className="text-2xs text-muted">
            When ON, AI text generation automatically applies {company.code}&apos;s brand voice. Can be overridden per generation.
          </div>
        </div>
        <Toggle key={String(brandVoiceDefault)} defaultOn={brandVoiceDefault} onChange={setBrandVoiceDefault} />
      </div>

      <SectionLabel>Recent AI generations</SectionLabel>
      <div className="card divide-y divide-hair">
        {history.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted">No AI generations yet.</div>
        ) : (
          history.slice(0, 8).map((g) => (
            <button
              key={g.id}
              onClick={() => setOpenLog(g)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-canvas"
            >
              <div className="flex items-center gap-3">
                <TypeBadge type={g.type} />
                <div>
                  <div className="text-ink">{g.description}</div>
                  <div className="text-2xs text-muted">{format(new Date(g.createdAt), "d MMM HH:mm")} · {g.model}</div>
                </div>
              </div>
              <span className="text-2xs text-muted">{eur(g.costEur, { decimals: true })}</span>
            </button>
          ))
        )}
      </div>
      {history.length > 8 && (
        <button className="mt-2 text-2xs text-ai-text hover:underline">View all →</button>
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
    <div className="flex items-center justify-between rounded-md border-hair border-hair p-3 text-sm">
      <div className="font-medium text-ink">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border-hair border-hair bg-card px-3 py-1.5 text-sm text-ink focus:outline-none"
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
  return (
    <Modal open onClose={onClose} width="max-w-md">
      <div className="border-b-hair border-hair px-4 py-3">
        <div className="text-sm font-semibold text-ink">{log.description}</div>
        <div className="text-2xs text-muted">{format(new Date(log.createdAt), "d MMM yyyy HH:mm")}</div>
      </div>
      <div className="space-y-2 p-4 text-sm">
        <dl className="space-y-1 text-2xs">
          <Row label="Type" value={log.type} />
          <Row label="Model" value={log.model} />
          <Row label="Cost" value={eur(log.costEur, { decimals: true })} />
        </dl>
        <div>
          <div className="section-label mb-1">Prompt</div>
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
