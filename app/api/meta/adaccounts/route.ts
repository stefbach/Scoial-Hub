// GET  /api/meta/adaccounts?companyId=…  → { accounts, selectedId, data, needsReconnect }
// POST /api/meta/adaccounts { companyId, adAccountId } → sélectionne un compte pub
//
// Lecture réelle des comptes publicitaires Meta (Marketing API). La CRÉATION de
// campagne payante n'est PAS ici (elle reste sous validation explicite).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  fetchAdAccounts,
  getMetaContext,
  storeMetaAds,
  fetchAdAccountData,
} from "@/lib/connectors/meta-pages";
import { requireCompanyAccess } from "@/lib/auth/guard";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const ctx = await getMetaContext(companyId);
    if (!ctx.userToken) {
      return NextResponse.json({ accounts: [], selectedId: null, data: null, needsReconnect: true });
    }

    const accounts = await fetchAdAccounts(ctx.userToken);
    const selectedId = ctx.adAccountId ?? null;
    const datePreset = req.nextUrl.searchParams.get("datePreset") ?? "maximum";
    const data = selectedId ? await fetchAdAccountData(ctx.userToken, selectedId, datePreset) : null;

    return NextResponse.json({
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        active: a.status === 1,
        amountSpent: a.amountSpent,
      })),
      selectedId,
      data,
      needsReconnect: false,
    });
  } catch (err) {
    console.error("[GET /api/meta/adaccounts]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { companyId, adAccountId } = (await req.json()) as { companyId?: string; adAccountId?: string };
    if (!companyId || !adAccountId) return NextResponse.json({ error: "companyId et adAccountId requis" }, { status: 400 });

    const guard = await requireCompanyAccess(companyId);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 403 });

    const ctx = await getMetaContext(companyId);
    if (!ctx.userToken) return NextResponse.json({ error: "Reconnexion Meta requise" }, { status: 409 });

    const accounts = await fetchAdAccounts(ctx.userToken);
    const acct = accounts.find((a) => a.id === String(adAccountId).replace(/^act_/, ""));
    if (!acct) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    await storeMetaAds(companyId, acct, ctx.userToken);
    return NextResponse.json({ ok: true, selectedId: acct.id, name: acct.name });
  } catch (err) {
    console.error("[POST /api/meta/adaccounts]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
