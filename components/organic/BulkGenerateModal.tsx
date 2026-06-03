"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TagInput } from "@/components/ui/TagInput";
import { useT } from "@/lib/i18n";

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
  const t = useT();
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState(titleCase(brandVoice));
  const [quantity, setQuantity] = useState(10);
  const [platforms, setPlatforms] = useState<string[]>(["facebook"]);
  const [tags, setTags] = useState<string[]>([]);

  const togglePlatform = (p: string) =>
    setPlatforms((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));

  const canGenerate = topic.trim().length > 0 && platforms.length > 0 && quantity >= 1;

  return (
    <Modal open onClose={onClose} width="max-w-lg">
      <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">
        {t("Génération en masse (texte + image)", "Bulk generate (text + image)")}
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-4">
        <label className="text-2xs font-medium text-muted">{t("Sujet", "Topic")}</label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={t("ex., conseils bien-être pour la gestion du poids", "e.g., wellness tips for weight management")}
          className="mb-3 mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
        />

        <label className="text-2xs font-medium text-muted">{t("Ton", "Tone")}</label>
        <input
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="mb-3 mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
        />

        <label className="text-2xs font-medium text-muted">{t("Quantité", "Quantity")}</label>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="mb-3 mt-1 block w-28 rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
        />

        <div className="mb-3">
          <div className="mb-1 text-2xs font-medium text-muted">{t("Pour les plateformes", "For platforms")}</div>
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
              title={t("LinkedIn n'est pas encore connecté pour cette entreprise", "LinkedIn not yet connected for this company")}
            >
              <input type="checkbox" disabled />
              LinkedIn
            </label>
          </div>
        </div>

        <label className="text-2xs font-medium text-muted">{t("Les tagger comme", "Tag them as")}</label>
        <div className="mt-1">
          <TagInput tags={tags} onChange={setTags} />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="secondary" onClick={onClose}>{t("Annuler", "Cancel")}</Button>
        <Button
          variant="primary"
          disabled={!canGenerate}
          onClick={onClose}
          title={
            canGenerate
              ? t("Générer", "Generate")
              : t("Renseignez un sujet et au moins une plateforme", "Enter a topic and at least one platform")
          }
        >
          {t("Générer", "Generate")}
        </Button>
      </div>
    </Modal>
  );
}
