import { NextRequest, NextResponse } from "next/server";
import { isValidAdmin, ADMIN_COOKIE, createAdminSession, ADMIN_SESSION_MAX_AGE } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!isValidAdmin(email ?? "", password ?? "")) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    // Cookie = token signé (HMAC) horodaté, pas une constante devinable.
    res.cookies.set(ADMIN_COOKIE, createAdminSession(), {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE, // 7 j
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
}
