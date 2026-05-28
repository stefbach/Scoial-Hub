"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Pills } from "@/components/ui/Tabs";
import { Toggle } from "@/components/ui/Toggle";
import { useCompany } from "@/lib/company-context";

const PLACEMENTS = [
  { id: "fb", label: "FB Feed 1.91:1", tint: "bg-[#eef4fe]" },
  { id: "ig", label: "IG Feed 1:1", tint: "bg-[#fdeef5]" },
  { id: "stories", label: "Stories 9:16", tint: "bg-canvas" },
];

export function CreateAdModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useCompany();

  return (
    <Modal open={open} onClose={onClose} width="max-w-2xl">
      <div className="border-b-hair border-hair px-4 py-3">
        <div className="text-sm font-semibold text-ink">New ad</div>
        <div className="text-2xs text-muted">
          Campaign: January Detox · Ad Set: Women 35-55 Mauritius
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto p-4">
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
          <Button variant="secondary" className="py-1 text-2xs">Generate copy</Button>
          <Button variant="secondary" className="py-1 text-2xs">Rewrite</Button>
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
            <Pills
              options={PLACEMENTS.map((p) => ({ id: p.id, label: p.label }))}
              tone="ai"
            />
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
            <button className="rounded-md bg-ai-visual px-2.5 py-1 text-2xs font-medium text-white">
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
                    className={`aspect-square rounded-md border-hair ${
                      i === 0 ? "border-ai-visual" : "border-hair"
                    } ${i === 0 || i === 2 ? p.tint : "bg-card"}`}
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="mt-3 text-2xs text-muted">
            <span className="font-medium text-ink">3 variants selected.</span> Each becomes a separate ad — Meta auto-rotates and learns the winner.
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t-hair border-hair px-4 py-3">
        <div className="flex items-center gap-2 text-2xs text-muted">
          <Toggle defaultOn={false} />
          Launch immediately
          <span className="ml-2">Safeguards active · Read-only off · EUR 500/day double-confirm</span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary">Create 3 ads</Button>
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
