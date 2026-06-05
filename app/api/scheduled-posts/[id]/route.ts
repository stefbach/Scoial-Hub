import { NextRequest, NextResponse } from "next/server";
import {
  updateScheduledPost,
  deleteScheduledPost,
} from "@/lib/repositories/scheduled-posts";
import type { Platform, PostSource } from "@/lib/types";
import { requireUser } from "@/lib/auth/guard";

// PATCH /api/scheduled-posts/[id]
// Body: partial ScheduledPost fields to update
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireUser();
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const { id } = params;
    const body = await req.json();

    const patch: Parameters<typeof updateScheduledPost>[1] = {};
    if (body.platform !== undefined) patch.platform = body.platform as Platform;
    if (body.title !== undefined) patch.title = body.title;
    if (body.date !== undefined) patch.date = body.date;
    if (body.time !== undefined) patch.time = body.time;
    if (body.source !== undefined) patch.source = body.source as PostSource;
    if (body.status !== undefined) patch.status = body.status;
    if (body.needsReview !== undefined) patch.needsReview = body.needsReview;
    if (body.body !== undefined) patch.body = body.body;
    if (body.automationName !== undefined) patch.automationName = body.automationName;
    if (body.media !== undefined) patch.media = body.media;
    if (body.publishedAt !== undefined) patch.publishedAt = body.publishedAt;

    const updated = await updateScheduledPost(id, patch);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("not found") ? 404 : 500;
    console.error(`[PATCH /api/scheduled-posts/${params.id}]`, err);
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/scheduled-posts/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requireUser();
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    await deleteScheduledPost(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(`[DELETE /api/scheduled-posts/${params.id}]`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
