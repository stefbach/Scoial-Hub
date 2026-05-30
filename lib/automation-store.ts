import { COMPANY_DATA } from "./mock-data";
import type { Automation } from "./types";

export function addAutomation(companyId: string, automation: Automation) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.automations.rules = [automation, ...data.automations.rules];
}

export function updateAutomation(
  companyId: string,
  automationId: string,
  patch: Partial<Automation>
) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.automations.rules = data.automations.rules.map((r) =>
    r.id === automationId ? { ...r, ...patch } : r
  );
}

export function deleteAutomation(companyId: string, automationId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.automations.rules = data.automations.rules.filter((r) => r.id !== automationId);
}

export function toggleAutomation(companyId: string, automationId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.automations.rules = data.automations.rules.map((r) => {
    if (r.id !== automationId) return r;
    const enabled = !r.enabled;
    const status: Automation["status"] = enabled
      ? r.status === "paused"
        ? "active"
        : r.status
      : "paused";
    return {
      ...r,
      enabled,
      status,
      pausedSince: enabled ? undefined : "Paused just now",
    };
  });
}

export function runAutomationNow(companyId: string, automationId: string) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  const nowIso = new Date().toISOString();
  data.automations.rules = data.automations.rules.map((r) =>
    r.id === automationId
      ? {
          ...r,
          lastRunAt: nowIso,
          last: "Just now",
          publishedCount: (r.publishedCount ?? 0) + 1,
        }
      : r
  );
}
