import { COMPANY_DATA } from "./mock-data";
import type { Audience } from "./types";

export function addAudience(companyId: string, audience: Audience) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.audiences.list = [audience, ...data.audiences.list];
  data.audiences.total = data.audiences.list.length;
}

export function findAudience(companyId: string, audienceId: string) {
  return COMPANY_DATA[companyId]?.audiences.list.find((a) => a.id === audienceId);
}
