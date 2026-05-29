import { COMPANY_DATA } from "./mock-data";
import type { Template } from "./types";

export function findTemplate(companyId: string, templateId: string) {
  return COMPANY_DATA[companyId]?.library.templates.find((t) => t.id === templateId);
}

export function addTemplate(companyId: string, template: Template) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.library.templates = [template, ...data.library.templates];
}

export function updateTemplate(
  companyId: string,
  templateId: string,
  patch: Partial<Template>
) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.library.templates = data.library.templates.map((t) =>
    t.id === templateId ? { ...t, ...patch } : t
  );
}

export function deleteTemplates(companyId: string, ids: string[]) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  const set = new Set(ids);
  data.library.templates = data.library.templates.filter((t) => !set.has(t.id));
}

export function retagTemplates(companyId: string, ids: string[], tags: string[]) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  const set = new Set(ids);
  data.library.templates = data.library.templates.map((t) =>
    set.has(t.id) ? { ...t, tags } : t
  );
}

export function duplicateTemplate(companyId: string, templateId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return undefined;
  const orig = data.library.templates.find((t) => t.id === templateId);
  if (!orig) return undefined;
  const copy: Template = {
    ...orig,
    id: `tpl-${Date.now()}`,
    status: "unused",
    addedDate: new Date().toISOString().slice(0, 10),
    media: { ...orig.media },
    tags: [...orig.tags],
  };
  data.library.templates = [copy, ...data.library.templates];
  return copy;
}
