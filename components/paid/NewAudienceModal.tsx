"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Pills } from "@/components/ui/Tabs";
import { addAudience } from "@/lib/audience-store";
import type { Audience, AudienceType } from "@/lib/types";

const TYPES = [
  { id: "saved", label: "Saved" },
  { id: "custom", label: "Custom" },
  { id: "lookalike", label: "Lookalike" },
];

export function NewAudienceModal({
  companyId,
  onClose,
  onCreated,
}: {
  companyId: string;
  onClose: () => void;
  onCreated: (audience: Audience) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AudienceType>("saved");
  const [definition, setDefinition] = useState("");

  const save = () => {
    if (!name.trim()) return;
    const audience: Audience = {
      id: `aud-${Date.now()}`,
      type,
      name: name.trim(),
      description: definition.trim() || "Custom definition",
      detail: type === "saved" ? "Built from interests + demographics" : "—",
      reach: type === "lookalike" ? "~12K" : "150K-200K",
      created: "Created just now",
      inUse: 0,
    };
    addAudience(companyId, audience);
    onCreated(audience);
    onClose();
  };

  return (
    <Modal open onClose={onClose} width="max-w-md">
      <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">
        New audience
      </div>
      <div className="space-y-3 p-4">
        <div>
          <label className="text-2xs font-medium text-muted">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Women 35-55 Mauritius — Wellness"
            className="mt-1 w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-2xs font-medium text-muted">Type</label>
          <Pills
            options={TYPES}
            defaultId={type}
            onChange={(id) => setType(id as AudienceType)}
          />
        </div>
        <div>
          <label className="text-2xs font-medium text-muted">Definition</label>
          <textarea
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
            placeholder={
              type === "saved"
                ? "Demographics + interests — e.g. female, 35-55, Mauritius, interested in nutrition"
                : type === "custom"
                ? "Uploaded list or pixel-based definition"
                : "Source audience to model from"
            }
            className="mt-1 h-20 w-full resize-none rounded-md border-hair border-hair bg-card p-2 text-sm text-ink placeholder:text-muted focus:outline-none"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!name.trim()} onClick={save}>
          Create audience
        </Button>
      </div>
    </Modal>
  );
}
