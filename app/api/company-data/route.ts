// GET /api/company-data?companyId=…
// Renvoie l'objet CompanyData reconstruit depuis les tables sh_* réelles.

import { NextRequest, NextResponse } from "next/server";
import { getCompanyData } from "@/lib/repositories/company-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    }
    const data = await getCompanyData(companyId);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[GET /api/company-data]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
