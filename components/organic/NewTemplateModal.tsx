"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TagInput } from "@/components/ui/TagInput";
import { MediaUpload, type UploadedMedia } from "@/components/ui/MediaUpload";
import { useT } from "@/lib/i18n";
import { addTemplate } from "@/lib/template-store";
import type { Platform, Template } from "@/lib/types";

export function NewTemplateModal({
  companyId,
  onClose,
  onSaved,
}: {
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [media, setMedia] = useState<UploadedMedia | null>(null);

  const save = () => {
    const tpl: Template = {
      id: `tpl-${Date.now()}`,
      platform,
      tags,
      body: body.trim(),
      status: "unused",
      addedDate: new Date().toISOString().slice(0, 10),
      media: media
        ? { kind: media.kind, ready: true, url: media.url }
        : { kind: "none", ready: false },
    };
    addTemplate(companyId, tpl);
    onSaved();
    onClose();
  };

  return (
    <Modal open onClose={onClose} width="max-w-lg">
      <div className="border-b-hair border-hair px-4 py-3 text-sm font-semibold text-ink">
        {t("Nouveau modèle", "New template")}
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-4">
        <label className="text-2xs font-medium text-muted">{t("Plateforme", "Platform")}</label>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="mb-3 mt-1 block w-full rounded-md border-hair border-hair bg-card px-3 py-2 text-sm text-ink focus:outline-none"
        >
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
          <option value="linkedin" disabled title={t("LinkedIn n'est pas encore connecté pour cette entreprise", "LinkedIn not yet connected for this company")}>
            LinkedIn ({t("non connecté", "not connected")})
          </option>
        </select>

        <label className="text-2xs font-medium text-muted">{t("Texte du modèle", "Body text")}</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("Rédigez le corps du modèle…", "Write the template body…")}
          className="mb-3 mt-1 h-24 w-full resize-none rounded-md border-hair border-hair bg-card p-2 text-sm text-ink placeholder:text-muted focus:outline-none"
        />

        <label className="text-2xs font-medium text-muted">{t("Tag(s)", "Tag(s)")}</label>
        <div className="mb-3 mt-1">
          <TagInput tags={tags} onChange={setTags} />
        </div>

        <label className="text-2xs font-medium text-muted">{t("Média (optionnel)", "Media (optional)")}</label>
        <div className="mt-1">
          <MediaUpload media={media} onChange={setMedia} />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t-hair border-hair px-4 py-3">
        <Button variant="secondary" onClick={onClose}>{t("Annuler", "Cancel")}</Button>
        <Button variant="primary" disabled={!body.trim()} onClick={save}>
          {t("Enregistrer le modèle", "Save template")}
        </Button>
      </div>
    </Modal>
  );
}
