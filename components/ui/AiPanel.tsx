import { Pills } from "./Tabs";

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
        <label className="flex items-center gap-1.5 text-2xs text-ai-text">
          Use {brandVoiceLabel} brand voice
          <span className="relative inline-flex h-4 w-7 items-center rounded-full bg-ai-text">
            <span className="ml-3.5 h-3 w-3 rounded-full bg-white" />
          </span>
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
  return (
    <div className="rounded-lg border-hair border-ai-visual/20 bg-ai-visualbg p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-ai-visual">AI assist · Visuals</span>
        <span className="text-2xs text-ai-visual">
          EUR {used.toFixed(2)} / {cap} used this month
        </span>
      </div>
      <div className="mb-2 flex gap-3 text-2xs">
        <button className="font-medium text-ai-visual underline">Image</button>
        <button className="text-muted">Video</button>
      </div>
      <textarea
        placeholder="A glass of water with lemon and cucumber, soft morning light, professional wellness photography"
        className="h-12 w-full resize-none rounded-md border-hair border-hair bg-card p-2 text-xs text-ink placeholder:text-muted focus:outline-none"
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
      <div className="mt-2 flex gap-1.5">
        <button className="rounded-md bg-ai-visual px-2.5 py-1 text-2xs font-medium text-white">
          Generate 4 options
        </button>
        <button className="rounded-md border-hair border-ai-visual/30 bg-card px-2.5 py-1 text-2xs font-medium text-ai-visual">
          Variations
        </button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`aspect-square rounded-md border-hair ${
              i === 0 ? "border-ai-visual bg-ai-visualbg" : "border-hair bg-card"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
