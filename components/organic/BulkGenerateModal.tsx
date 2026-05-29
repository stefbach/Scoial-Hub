"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TagInput } from "@/components/ui/TagInput";

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function BulkGenerateModal({
  brandVoice,
  onClose,
}: {
  brandVoice: string;
  onClose: () => void;
}) {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState(titleCase(brandVoice));
  const [quantity, setQuantity] = useState(10);
  const [platforms, setPlatforms] = useState<string[]>(["facebook"]);
  const [tags, setTags] = useState<string[]>([]);

  const togglePlatform = (p: string) =>
    setPlatforms((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));

  return (
    <Modal open onClose={onClose} width="max-w-lg">
      <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">
        Bulk generate (text + image)
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-4">
        <label className="text-2xs font-medium text-muted">Topic</label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., wellness tips for weight management"
          className="mb-3 mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
        />

        <label className="text-2xs font-medium text-muted">Tone</label>
        <input
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="mb-3 mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
        />

        <label className="text-2xs font-medium text-muted">Quantity</label>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="mb-3 mt-1 block w-28 rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
        />

        <div className="mb-3">
          <div className="mb-1 text-2xs font-medium text-muted">For platforms</div>
          <div className="flex flex-wrap gap-3 text-sm text-ink">
            {[
              { id: "facebook", label: "Facebook" },
              { id: "instagram", label: "Instagram" },
            ].map((p) => (
              <label key={p.id} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={platforms.includes(p.id)}
                  onChange={() => togglePlatform(p.id)}
                />
                {p.label}
              </label>
            ))}
            <label
              className="flex cursor-not-allowed items-center gap-1.5 text-muted"
              title="LinkedIn not yet connected for this company"
            >
              <input type="checkbox" disabled />
              LinkedIn
            </label>
          </div>
        </div>

        <label className="text-2xs font-medium text-muted">Tag them as</label>
        <div className="mt-1">
          <TagInput tags={tags} onChange={setTags} />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled
          title="AI generation will be enabled when the backend is connected"
        >
          Generate
        </Button>
      </div>
    </Modal>
  );
}
