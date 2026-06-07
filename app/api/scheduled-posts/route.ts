import { NextRequest, NextResponse } from "next/server";
import {
  listScheduledPosts,
  createScheduledPost,
} from "@/lib/repositories/scheduled-posts";
import type { Platform, PostSource } from "@/lib/types";
import { requireCompanyAccess } from "@/lib/auth/guard";

// GET /api/scheduled-posts?companyId=...
export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json(
        { error: "companyId query parameter is required" },
        { status: 400 }
      );
    }

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const posts = await listScheduledPosts(companyId);
    return NextResponse.json(posts);
  } catch (err) {
    console.error("[GET /api/scheduled-posts]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/scheduled-posts
// Body: { companyId, platform, title, date, time, source, body?, status?, ... }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, ...input } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    if (!input.platform || !input.title) {
      return NextResponse.json(
        { error: "platform and title are required" },
        { status: 400 }
      );
    }

    const guard = await requireCompanyAccess(companyId, { mode: "edit" });
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const post = await createScheduledPost(companyId, {
      platform: input.platform as Platform,
      title: input.title,
      date: input.date ?? "",
      time: input.time ?? "",
      source: (input.source ?? "manual") as PostSource,
      status: input.status ?? "scheduled",
      needsReview: input.needsReview ?? false,
      body: input.body,
      automationName: input.automationName,
      media: input.media,
      publishedAt: input.publishedAt,
    });

    return NextResponse.json(post, { status: 201 });
  } catch (err) {
    console.error("[POST /api/scheduled-posts]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
