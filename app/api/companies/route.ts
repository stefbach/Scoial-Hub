import { NextRequest, NextResponse } from "next/server";
import { listCompanies, createCompany } from "@/lib/repositories/companies";

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
    const { orgId = "mock-org", ...input } = body;

    if (!input.name || !input.code) {
      return NextResponse.json(
        { error: "name and code are required" },
        { status: 400 }
      );
    }

    const company = await createCompany(orgId, {
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
