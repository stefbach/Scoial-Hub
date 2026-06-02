import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { COMPANY_DATA } from "@/lib/mock-data";
import type { ScheduledPost, Platform, PostSource } from "@/lib/types";
import type { DbScheduledPost } from "@/lib/supabase/db-types";

// ── Mapper DB → type métier ──────────────────────────────────

function rowToScheduledPost(row: DbScheduledPost): ScheduledPost {
  return {
    id: row.id,
    platform: row.platform as Platform,
    title: row.title,
    date: row.date ?? "",
    time: row.time ?? "",
    source: row.source as PostSource,
    status: (row.status as ScheduledPost["status"]) ?? "scheduled",
    needsReview: row.needs_review ?? false,
    body: row.body ?? undefined,
    automationName: row.automation_name ?? undefined,
    media: row.media ?? undefined,
    publishedAt: row.published_at ?? undefined,
  };
}

function scheduledPostToRow(
  companyId: string,
  input: Omit<ScheduledPost, "id">
): Omit<DbScheduledPost, "id" | "created_at"> {
  return {
    company_id: companyId,
    platform: input.platform,
    title: input.title,
    body: input.body ?? null,
    date: input.date ?? null,
    time: input.time ?? null,
    source: input.source,
    status: input.status ?? "scheduled",
    needs_review: input.needsReview ?? false,
    automation_name: input.automationName ?? null,
    media: input.media ?? null,
    published_at: input.publishedAt ?? null,
    external_id: null,
  };
}

// ── Repository ───────────────────────────────────────────────

/**
 * Liste les posts planifiés d'une company.
 * En mode mock, retourne COMPANY_DATA[companyId].scheduled.
 */
export async function listScheduledPosts(
  companyId: string
): Promise<ScheduledPost[]> {
  if (!isSupabaseConfigured) {
    return [...(COMPANY_DATA[companyId]?.scheduled ?? [])];
  }

  const supabase = createClient();
  if (!supabase) return [...(COMPANY_DATA[companyId]?.scheduled ?? [])];

  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("company_id", companyId)
    .order("date", { ascending: true });

  if (error || !data) {
    console.error("[scheduled-posts] listScheduledPosts error:", error);
    return [...(COMPANY_DATA[companyId]?.scheduled ?? [])];
  }

  return (data as DbScheduledPost[]).map(rowToScheduledPost);
}

/**
 * Récupère un post par son id.
 * En mode mock, cherche dans COMPANY_DATA (toutes les companies).
 */
export async function getScheduledPost(id: string): Promise<ScheduledPost | null> {
  if (!isSupabaseConfigured) {
    for (const data of Object.values(COMPANY_DATA)) {
      const post = data.scheduled.find((p) => p.id === id);
      if (post) return post;
    }
    return null;
  }

  const supabase = createClient();
  if (!supabase) {
    for (const data of Object.values(COMPANY_DATA)) {
      const post = data.scheduled.find((p) => p.id === id);
      if (post) return post;
    }
    return null;
  }

  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("[scheduled-posts] getScheduledPost error:", error);
    return null;
  }

  return rowToScheduledPost(data as DbScheduledPost);
}

/**
 * Crée un nouveau post planifié.
 * En mode mock, pousse dans COMPANY_DATA[companyId].scheduled.
 */
export async function createScheduledPost(
  companyId: string,
  input: Omit<ScheduledPost, "id">
): Promise<ScheduledPost> {
  if (!isSupabaseConfigured) {
    const id = `post-${Date.now()}`;
    const post: ScheduledPost = { id, ...input };
    if (COMPANY_DATA[companyId]) {
      COMPANY_DATA[companyId].scheduled.push(post);
    }
    return post;
  }

  const supabase = createClient();
  if (!supabase) {
    const id = `post-${Date.now()}`;
    const post: ScheduledPost = { id, ...input };
    if (COMPANY_DATA[companyId]) {
      COMPANY_DATA[companyId].scheduled.push(post);
    }
    return post;
  }

  const row = scheduledPostToRow(companyId, input);
  const { data, error } = await supabase
    .from("scheduled_posts")
    .insert(row)
    .select()
    .single();

  if (error || !data) {
    console.error("[scheduled-posts] createScheduledPost error:", error);
    throw new Error(error?.message ?? "Failed to create scheduled post");
  }

  return rowToScheduledPost(data as DbScheduledPost);
}

/**
 * Met à jour un post existant.
 * En mode mock, patch dans COMPANY_DATA.
 */
export async function updateScheduledPost(
  id: string,
  patch: Partial<Omit<ScheduledPost, "id">>
): Promise<ScheduledPost> {
  if (!isSupabaseConfigured) {
    for (const data of Object.values(COMPANY_DATA)) {
      const idx = data.scheduled.findIndex((p) => p.id === id);
      if (idx >= 0) {
        data.scheduled[idx] = { ...data.scheduled[idx], ...patch };
        return data.scheduled[idx];
      }
    }
    throw new Error(`ScheduledPost ${id} not found`);
  }

  const supabase = createClient();
  if (!supabase) {
    for (const data of Object.values(COMPANY_DATA)) {
      const idx = data.scheduled.findIndex((p) => p.id === id);
      if (idx >= 0) {
        data.scheduled[idx] = { ...data.scheduled[idx], ...patch };
        return data.scheduled[idx];
      }
    }
    throw new Error(`ScheduledPost ${id} not found`);
  }

  const dbPatch: Partial<Omit<DbScheduledPost, "id" | "company_id" | "created_at">> = {};
  if (patch.platform !== undefined) dbPatch.platform = patch.platform;
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.body !== undefined) dbPatch.body = patch.body ?? null;
  if (patch.date !== undefined) dbPatch.date = patch.date ?? null;
  if (patch.time !== undefined) dbPatch.time = patch.time ?? null;
  if (patch.source !== undefined) dbPatch.source = patch.source;
  if (patch.status !== undefined) dbPatch.status = patch.status ?? "scheduled";
  if (patch.needsReview !== undefined) dbPatch.needs_review = patch.needsReview;
  if (patch.automationName !== undefined) dbPatch.automation_name = patch.automationName ?? null;
  if (patch.media !== undefined) dbPatch.media = patch.media ?? null;
  if (patch.publishedAt !== undefined) dbPatch.published_at = patch.publishedAt ?? null;

  const { data, error } = await supabase
    .from("scheduled_posts")
    .update(dbPatch)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    console.error("[scheduled-posts] updateScheduledPost error:", error);
    throw new Error(error?.message ?? "Failed to update scheduled post");
  }

  return rowToScheduledPost(data as DbScheduledPost);
}

/**
 * Supprime un post planifié.
 * En mode mock, retire de COMPANY_DATA.
 */
export async function deleteScheduledPost(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    for (const data of Object.values(COMPANY_DATA)) {
      const idx = data.scheduled.findIndex((p) => p.id === id);
      if (idx >= 0) {
        data.scheduled.splice(idx, 1);
        return;
      }
    }
    return; // post inexistant — pas d'erreur
  }

  const supabase = createClient();
  if (!supabase) {
    for (const data of Object.values(COMPANY_DATA)) {
      const idx = data.scheduled.findIndex((p) => p.id === id);
      if (idx >= 0) {
        data.scheduled.splice(idx, 1);
        return;
      }
    }
    return;
  }

  const { error } = await supabase
    .from("scheduled_posts")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[scheduled-posts] deleteScheduledPost error:", error);
    throw new Error(error.message ?? "Failed to delete scheduled post");
  }
}
