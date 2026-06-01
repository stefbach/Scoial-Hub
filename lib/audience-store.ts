import { COMPANY_DATA } from "./mock-data";
import type { Audience } from "./types";

function recount(companyId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  const list = data.audiences.list;
  data.audiences.total = list.length;
  data.audiences.inUse = list.filter((a) => a.inUse > 0).length;
}

export function addAudience(companyId: string, audience: Audience) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.audiences.list = [audience, ...data.audiences.list];
  recount(companyId);
}

export function findAudience(companyId: string, audienceId: string) {
  return COMPANY_DATA[companyId]?.audiences.list.find((a) => a.id === audienceId);
}

export function deleteAudience(companyId: string, audienceId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.audiences.list = data.audiences.list.filter((a) => a.id !== audienceId);
  recount(companyId);
}

export function duplicateAudience(companyId: string, audienceId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return undefined;
  const orig = data.audiences.list.find((a) => a.id === audienceId);
  if (!orig) return undefined;
  const copy: Audience = {
    ...orig,
    id: `aud-${Date.now()}`,
    name: `${orig.name} (copy)`,
    inUse: 0,
    usedByAdSetIds: [],
    created: "Created just now",
    createdAt: new Date().toISOString().slice(0, 10),
    config: orig.type === "custom" && orig.config
      ? { ...orig.config, duplicatedFrom: orig.name }
      : orig.config && { ...orig.config },
  };
  data.audiences.list = [copy, ...data.audiences.list];
  recount(companyId);
  return copy;
}
