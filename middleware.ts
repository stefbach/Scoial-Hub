import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_COOKIE, verifyAdminSessionEdge } from "@/lib/admin-edge";

// Routes publiques : pas de redirection quelle que soit la config
const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth"];

function isPublicPath(pathname: string): boolean {
  // Landing, auth pages, auth callback, API routes, assets
  if (pathname === "/") return true;
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/signup")) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/legal")) return true; // pages légales publiques (Meta/LinkedIn)
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.includes(".")) return true; // fichiers statiques
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Console ADMIN : protection par cookie admin ───────────────
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    // Vérifie la signature + expiration du token de session (pas une constante).
    // Version Edge-safe (Web Crypto) : le module Node `crypto` n'existe pas ici.
    const isAdmin = await verifyAdminSessionEdge(request.cookies.get(ADMIN_COOKIE)?.value);
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // Mode démo : Supabase non configuré → aucune protection
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Mode démo ouvert : on laisse tout passer sans interférence
    return NextResponse.next();
  }

  // Supabase configuré : on rafraîchit la session SSR
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Rafraîchit le token de session si nécessaire
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Si route publique, on laisse passer (session rafraîchie)
  if (isPublicPath(pathname)) {
    return response;
  }

  // Verrou d'accès : l'application N'EST PAS accessible sans connexion.
  // Activé par défaut dès que Supabase est configuré. Échappatoire d'urgence :
  // AUTH_DISABLED=true rouvre l'accès (ex : dépannage).
  const authRequired = process.env.AUTH_DISABLED !== "true";
  if (authRequired && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * On traite toutes les routes sauf les fichiers statiques Next.js internes.
     * Le pattern exclut _next/static, _next/image et les icônes.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
