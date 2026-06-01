import { COMPANY_DATA } from "./mock-data";
import type { MetaConnection } from "./types";

export function getMeta(companyId: string): MetaConnection | undefined {
  return COMPANY_DATA[companyId]?.meta;
}

export function setMeta(companyId: string, patch: Partial<MetaConnection>) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.meta = { ...(data.meta ?? { connected: false, readOnly: true, keepReadOnlyAfterSafety: false }), ...patch };
}

export function disconnectMeta(companyId: string) {
  setMeta(companyId, {
    connected: false,
    connectedAt: undefined,
    businessManagerName: undefined,
    facebookPageName: undefined,
    instagramHandle: undefined,
    readOnly: true,
    keepReadOnlyAfterSafety: false,
  });
}
