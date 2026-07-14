import { NextRequest, NextResponse } from "next/server";
import { isValidAdmin, isAdminConfigured, ADMIN_COOKIE, createAdminSession, ADMIN_SESSION_MAX_AGE } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // Verrou de production : tant que ADMIN_EMAIL / ADMIN_PASSWORD /
    // ADMIN_SECRET ne sont pas configures dans Vercel, la console est fermee
    // (les identifiants de repli dev sont publics — depot open source).
    if (process.env.NODE_ENV === "production" && !isAdminConfigured) {
      return NextResponse.json(
        { error: "Console admin non configuree : definissez ADMIN_EMAIL, ADMIN_PASSWORD et ADMIN_SECRET dans Vercel, puis redeployez." },
        { status: 503 }
      );
    }
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
