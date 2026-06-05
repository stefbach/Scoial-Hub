import { NextRequest, NextResponse } from "next/server";
import { listCompanies, createCompany } from "@/lib/repositories/companies";
import { isSupabaseConfigured } from "@/lib/env";

// GET /api/companies[?orgId=...]
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId") ?? undefined;
    const companies = await listCompanies(orgId);
    return NextResponse.json(companies);
  } catch (err) {
    console.error("[GET /api/companies]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/companies
// Body: { orgId?: string, name, code, brandVoice, accent, ... }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orgId: rawOrgId, ...input } = body;
    const orgId: string | undefined =
      typeof rawOrgId === "string" && rawOrgId.trim() ? rawOrgId.trim() : undefined;

    if (!input.name || !input.code) {
      return NextResponse.json(
        { error: "name and code are required" },
        { status: 400 }
      );
    }

    // En mode Supabase, l'orgId doit être fourni explicitement : on ne crée
    // jamais d'organisation "mock-org" en dur côté prod. En mode mock, l'orgId
    // est ignoré par le repository — un placeholder local suffit.
    if (isSupabaseConfigured && !orgId) {
      return NextResponse.json(
        { error: "orgId is required" },
        { status: 400 }
      );
    }

    const company = await createCompany(orgId ?? "local-dev", {
      name: input.name,
      code: input.code,
      brandVoice: input.brandVoice ?? "",
      accent: input.accent ?? "#2563eb",
      logoUrl: input.logoUrl,
      defaultPlatforms: input.defaultPlatforms,
      defaultPostingTime: input.defaultPostingTime,
      defaultNeedsReview: input.defaultNeedsReview ?? false,
    });

    return NextResponse.json(company, { status: 201 });
  } catch (err) {
    console.error("[POST /api/companies]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
