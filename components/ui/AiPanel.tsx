"use client";

import { useState } from "react";
import { Pills } from "./Tabs";
import { Toggle } from "./Toggle";

// Blue = AI text
export function AiTextPanel({
  brandVoiceLabel,
}: {
  brandVoiceLabel: string;
}) {
  return (
    <div className="rounded-lg border-hair border-ai-text/20 bg-ai-textbg p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-ai-text">AI assist · Text</span>
        <label className="flex cursor-pointer items-center gap-1.5 text-2xs text-ai-text">
          Use {brandVoiceLabel} brand voice
          <Toggle defaultOn />
        </label>
      </div>
      <textarea
        placeholder="Describe what to post — angle, tone, call-to-action…"
        className="h-16 w-full resize-none rounded-md border-hair border-hair bg-card p-2 text-xs text-ink placeholder:text-muted focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["Generate", "Rewrite tone", "Make shorter", "Add hashtags"].map((b) => (
          <button
            key={b}
            className="rounded-md border-hair border-ai-text/30 bg-card px-2.5 py-1 text-2xs font-medium text-ai-text hover:bg-ai-textbg"
          >
            {b}
          </button>
        ))}
      </div>
    </div>
  );
}

// Purple = AI visuals
export function AiVisualsPanel({
  used,
  cap,
}: {
  used: number;
  cap: number;
}) {
  const [mode, setMode] = useState<"image" | "video">("image");
  const isVideo = mode === "video";

  return (
    <div className="rounded-lg border-hair border-ai-visual/20 bg-ai-visualbg p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-ai-visual">AI assist · Visuals</span>
        <span className="text-2xs text-ai-visual">
          EUR {used.toFixed(2)} / {cap} used this month
        </span>
      </div>
      <div className="mb-2 flex gap-3 text-2xs">
        <button
          onClick={() => setMode("image")}
          className={mode === "image" ? "font-medium text-ai-visual underline" : "text-muted"}
        >
          Image
        </button>
        <button
          onClick={() => setMode("video")}
          className={mode === "video" ? "font-medium text-ai-visual underline" : "text-muted"}
        >
          Video
        </button>
      </div>
      <textarea
        placeholder={
          isVideo
            ? "A slow pan over a glass of water with lemon and mint, soft morning light, calming wellness mood"
            : "A glass of water with lemon and cucumber, soft morning light, professional wellness photography"
        }
        className="h-12 w-full resize-none rounded-md border-hair border-hair bg-card p-2 text-xs text-ink placeholder:text-muted focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between">
        <Pills
          key={mode}
          options={
            isVideo
              ? [
                  { id: "photo", label: "Realistic" },
                  { id: "cinematic", label: "Cinematic" },
                  { id: "animated", label: "Animated" },
                ]
              : [
                  { id: "photo", label: "Photo" },
                  { id: "illustration", label: "Illustration" },
                  { id: "poster", label: "Poster with text" },
                ]
          }
          tone="ai"
        />
        <span className="text-2xs text-muted">
          {isVideo ? "~EUR 0.50 / 5s clip" : "~EUR 0.06/img"}
        </span>
      </div>
      <div className="mt-2 flex gap-1.5">
        <button className="rounded-md bg-ai-visual px-2.5 py-1 text-2xs font-medium text-white">
          {isVideo ? "Generate video" : "Generate 4 options"}
        </button>
        <button
          disabled
          title="Select an image first to generate variations"
          className="cursor-not-allowed rounded-md border-hair border-ai-visual/20 bg-card px-2.5 py-1 text-2xs font-medium text-ai-visual/40"
        >
          Variations
        </button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`rounded-md border-hair ${isVideo ? "aspect-video" : "aspect-square"} ${
              i === 0 ? "border-ai-visual bg-ai-visualbg" : "border-hair bg-card"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
