import { COMPANY_DATA } from "./mock-data";
import type { ScheduledPost } from "./types";

// Frontend-only mock persistence: appends drafts to the in-memory company
// dataset so the Scheduled screen can show them this session. Real persistence
// arrives with the backend phase.
export function saveDraft(companyId: string, draft: ScheduledPost) {
  const data = COMPANY_DATA[companyId];
  if (!data) return;
  data.scheduled = [...data.scheduled.filter((p) => p.id !== draft.id), draft];
}

export function findDraft(companyId: string, draftId: string) {
  return COMPANY_DATA[companyId]?.scheduled.find(
    (p) => p.id === draftId && p.status === "draft"
  );
}
