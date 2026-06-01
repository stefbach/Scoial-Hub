"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Pills } from "@/components/ui/Tabs";
import { Toggle } from "@/components/ui/Toggle";
import { MediaUpload, type UploadedMedia } from "@/components/ui/MediaUpload";
import { useCompany } from "@/lib/company-context";
import { hydrateCampaigns } from "@/lib/campaign-store";

const PLACEMENTS = [
  { id: "fb", label: "FB Feed 1.91:1", tint: "bg-[#eef4fe]" },
  { id: "ig", label: "IG Feed 1:1", tint: "bg-[#fdeef5]" },
  { id: "stories", label: "Stories 9:16", tint: "bg-canvas" },
];

export function CreateAdModal({
  open,
  onClose,
  lockedCampaignId,
  lockedAdSetId,
}: {
  open: boolean;
  onClose: () => void;
  lockedCampaignId?: string;
  lockedAdSetId?: string;
}) {
  const router = useRouter();
  const { company, data } = useCompany();

  // Make sure we read enriched campaigns (ad sets always present).
  if (open) hydrateCampaigns(company.id);

  const campaigns = data.campaigns.list;
  const initialCampaign =
    lockedCampaignId ??
    campaigns.find((c) => c.adSets.length > 0)?.id ??
    campaigns[0]?.id ??
    "";
  const [campaignId, setCampaignId] = useState(initialCampaign);

  const currentCampaign = campaigns.find((c) => c.id === campaignId);
  const initialAdSet =
    lockedAdSetId ?? currentCampaign?.adSets[0]?.id ?? "";
  const [adSetId, setAdSetId] = useState(initialAdSet);

  const adSetOptions = useMemo(() => currentCampaign?.adSets ?? [], [currentCampaign]);
  const noAdSets = adSetOptions.length === 0;
  const locked = !!(lockedCampaignId && lockedAdSetId);
  const [upload, setUpload] = useState<UploadedMedia | null>(null);

  return (
    <Modal open={open} onClose={onClose} width="max-w-2xl">
      <div className="border-b-hair border-hair px-4 py-3">
        <div className="text-sm font-semibold text-ink">New ad</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label className="text-2xs font-medium text-muted">Campaign</label>
            <div className="relative mt-1">
              <select
                value={campaignId}
                disabled={locked}
                onChange={(e) => {
                  setCampaignId(e.target.value);
                  const nextSet = campaigns.find((c) => c.id === e.target.value)?.adSets[0]?.id ?? "";
                  setAdSetId(nextSet);
                }}
                className={`block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none ${
                  locked ? "cursor-not-allowed pr-7 opacity-70" : ""
                }`}
                title={locked ? "Locked — opened from ad set detail page" : undefined}
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {locked && (
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted">
                  <LockIcon />
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="text-2xs font-medium text-muted">Ad set</label>
            <div className="relative mt-1">
              <select
                value={adSetId}
                disabled={locked || noAdSets}
                onChange={(e) => setAdSetId(e.target.value)}
                className={`block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none ${
                  locked ? "cursor-not-allowed pr-7 opacity-70" : ""
                }`}
                title={locked ? "Locked — opened from ad set detail page" : undefined}
              >
                {adSetOptions.length === 0 ? (
                  <option value="">No ad sets</option>
                ) : (
                  adSetOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                )}
              </select>
              {locked && (
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted">
                  <LockIcon />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto p-4">
        {noAdSets && currentCampaign ? (
          <div className="rounded-md border-hair border-amber-200 bg-amber-50 p-3">
            <div className="text-sm font-medium text-amber-700">
              This campaign has no ad sets yet. Create one first.
            </div>
            <Button
              variant="secondary"
              className="mt-2 py-1 text-2xs"
              onClick={() => {
                onClose();
                router.push(`/campaigns/${currentCampaign.id}`);
              }}
            >
              Go to campaign
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ad name" value="Hydration tip — FB Feed" />
              <Field label="Call-to-action" value="Book now" />
            </div>
            <Field className="mt-3" label="Headline" value="Reclaim your energy this January" />
            <div className="mt-3">
              <label className="text-2xs font-medium text-muted">Body text</label>
              <textarea
                defaultValue="Our supervised January Detox Program helps reset your metabolism with personalized care. Free initial consultation this month."
                className="mt-1 h-16 w-full resize-none rounded-md border-hair border-hair bg-card p-2 text-xs text-ink focus:outline-none"
              />
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                variant="secondary"
                disabled
                title="AI will be enabled when the backend is connected"
                className="py-1 text-2xs"
              >
                Generate copy
              </Button>
              <Button
                variant="secondary"
                disabled
                title="AI will be enabled when the backend is connected"
                className="py-1 text-2xs"
              >
                Rewrite
              </Button>
            </div>

            {/* AI Creative */}
            <div className="mt-4 rounded-lg border-hair border-ai-visual/20 bg-ai-visualbg p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-ai-visual">AI Creative</span>
                <span className="text-2xs text-ai-visual">
                  EUR {data.library.aiBudgetUsed.toFixed(2)} / {data.library.aiBudgetCap} this month
                </span>
              </div>

              <div className="mb-2 rounded-md border-hair border-amber-200 bg-amber-50 px-3 py-2 text-2xs text-amber-700">
                OCC is a medical/wellness brand. Avoid before/after body imagery — Meta restricts this. AI follows these rules automatically.
              </div>

              <div className="mb-1 text-2xs text-muted">Generate creatives for:</div>
              <div className="mb-2">
                <Pills options={PLACEMENTS.map((p) => ({ id: p.id, label: p.label }))} tone="ai" />
              </div>
              <Pills
                options={[
                  { id: "photo", label: "Photo" },
                  { id: "illustration", label: "Illustration" },
                  { id: "poster", label: "Poster with text" },
                  { id: "video", label: "Video" },
                ]}
              />
              <textarea
                defaultValue="A vibrant glass of water with fresh lemon and mint, warm morning light, professional wellness photography, clean wooden table."
                className="mt-2 h-12 w-full resize-none rounded-md border-hair border-hair bg-card p-2 text-xs text-ink focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-between">
                <button
                  disabled
                  title="AI generation will be enabled when the backend is connected"
                  className="cursor-not-allowed rounded-md bg-ai-visual/40 px-2.5 py-1 text-2xs font-medium text-white"
                >
                  Generate 4 creatives
                </button>
                <span className="text-2xs text-muted">~EUR 0.44 (3 sizes x 4)</span>
              </div>

              {PLACEMENTS.slice(0, 2).map((p) => (
                <div key={p.id} className="mt-3">
                  <div className="mb-1 text-2xs text-muted">{p.label}</div>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        title="AI generation will be enabled when the backend is connected"
                        className="flex aspect-square cursor-not-allowed flex-col items-center justify-center rounded-md border border-dashed border-ai-visual/30 bg-ai-visualbg/40 text-ai-visual/70"
                      >
                        <SparkleIcon />
                        <span className="mt-1 text-[10px] leading-tight text-muted">
                          AI will generate here
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="mt-3 text-2xs text-muted">
                <span className="font-medium text-ink">No variants yet.</span> Each generated creative becomes a separate ad — Meta auto-rotates and learns the winner.
              </div>
            </div>

            {/* Manual upload */}
            <div className="mt-4">
              <div className="mb-1 text-2xs text-muted">Or upload your own creative</div>
              <MediaUpload media={upload} onChange={setUpload} />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t-hair border-hair px-4 py-3">
        <div className="flex items-center gap-2 text-2xs text-muted">
          <Toggle defaultOn={false} />
          Launch immediately
          <span className="ml-2">Safeguards active · Read-only off · EUR 500/day double-confirm</span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!upload && !noAdSets}
            title={
              noAdSets
                ? undefined
                : upload
                ? undefined
                : "Generate or upload at least one creative first"
            }
          >
            {upload ? "Create ad" : "Create ad"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-2xs font-medium text-muted">{label}</label>
      <input
        defaultValue={value}
        className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
      />
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M19 14l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
