"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Pills } from "@/components/ui/Tabs";
import { MediaUpload, type UploadedMedia } from "@/components/ui/MediaUpload";
import { updateTemplate } from "@/lib/template-store";

function Spinner() {
  return (
    <svg
      className="h-3 w-3 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

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
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("photo");
  const [loading, setLoading] = useState(false);
  const [mockMessage, setMockMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (upload) {
      updateTemplate(companyId, templateId, {
        media: { kind: upload.kind, ready: true, url: upload.url },
      });
      onSaved();
    }
    onClose();
  };

  const handleGenerate = async () => {
    const text = prompt.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    setMockMessage(null);
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, format: "image", style }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { images?: unknown[]; mock?: boolean; message?: string };
      if (data.mock) {
        setMockMessage(data.message ?? "Image generation not configured.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
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
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
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
              onChange={setStyle}
            />
            <span className="text-2xs text-muted">~EUR 0.06/img</span>
          </div>
          <button
            disabled={loading || !prompt.trim()}
            onClick={handleGenerate}
            className="mt-2 flex items-center gap-1 rounded-md bg-ai-visual px-2.5 py-1 text-2xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && <Spinner />}
            Generate 4 options
          </button>

          {/* Mock / not configured message */}
          {mockMessage && (
            <p className="mt-2 rounded-md bg-ai-visualbg px-2 py-1 text-2xs text-ai-visual ring-1 ring-ai-visual/20">
              {mockMessage}
            </p>
          )}

          {/* Error */}
          {error && (
            <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-2xs text-red-600">{error}</p>
          )}
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
