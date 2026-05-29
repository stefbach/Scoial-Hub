"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Pills } from "@/components/ui/Tabs";
import { MediaUpload, type UploadedMedia } from "@/components/ui/MediaUpload";
import { updateTemplate } from "@/lib/template-store";

export function GenerateImageModal({
  companyId,
  templateId,
  onClose,
  onSaved,
}: {
  companyId: string;
  templateId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [upload, setUpload] = useState<UploadedMedia | null>(null);

  const save = () => {
    if (upload) {
      updateTemplate(companyId, templateId, {
        media: { kind: upload.kind, ready: true, url: upload.url },
      });
      onSaved();
    }
    onClose();
  };

  return (
    <Modal open onClose={onClose} width="max-w-md">
      <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">
        Add an image
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-4">
        {/* Purple AI visuals panel */}
        <div className="rounded-lg border-hair border-ai-visual/20 bg-ai-visualbg p-3">
          <div className="mb-2 text-xs font-medium text-ai-visual">AI assist · Visuals</div>
          <textarea
            placeholder="Describe the image — subject, mood, lighting, style…"
            className="h-14 w-full resize-none rounded-md border-hair border-hair bg-card p-2 text-xs text-ink placeholder:text-muted focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <Pills
              options={[
                { id: "photo", label: "Photo" },
                { id: "illustration", label: "Illustration" },
                { id: "poster", label: "Poster" },
              ]}
              tone="ai"
            />
            <span className="text-2xs text-muted">~EUR 0.06/img</span>
          </div>
          <button
            disabled
            title="AI generation will be enabled when the backend is connected"
            className="mt-2 cursor-not-allowed rounded-md bg-ai-visual/40 px-2.5 py-1 text-2xs font-medium text-white"
          >
            Generate 4 options
          </button>
        </div>

        <div className="my-3 text-center text-2xs text-muted">— or —</div>

        <MediaUpload media={upload} onChange={setUpload} />
      </div>
      <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!upload} onClick={save}>Save</Button>
      </div>
    </Modal>
  );
}
