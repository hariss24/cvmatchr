import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Rafraîchit la session Supabase, sauf sur /api/* : un aller-retour réseau
// vers Supabase sur chaque appel IA ralentirait ces routes pour rien.
// L'authentification des routes API se fait par un guard dédié qui lit la
// session directement (Task 3 du plan), pas par ce middleware.
function passThrough(req: NextRequest, path: string) {
  if (path.startsWith("/api/")) return NextResponse.next();
  return updateSession(req, NextResponse.next({ request: req }));
}

export async function middleware(req: NextRequest) {
  const authPassword = process.env.REMOTE_AUTH_PASSWORD || process.env.AUTH_PASSWORD;
  const path = req.nextUrl.pathname;

  // Si pas de mot de passe requis (mode local), on laisse tout passer
  if (!authPassword) {
    return passThrough(req, path);
  }

  // Ne pas bloquer la page de login, les assets statiques et Next.js internals
  if (
    path === "/login" ||
    path.startsWith("/_next/") ||
    path.startsWith("/static/") ||
    path === "/favicon.ico" ||
    path === "/api/login"
  ) {
    return passThrough(req, path);
  }

  const token = req.cookies.get("auth_token")?.value;

  // On compare le token de manière basique. Le token est généré par l'API login.
  // Pour éviter d'embarquer des librairies complexes au Edge, on s'attend à ce que le token 
  // soit simplement le SHA-256 du mot de passe (généré par l'API de login).
  if (!token) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Pour la vérification au Edge sans librairie externe, on recalcule le SHA-256 du mot de passe
  const encoder = new TextEncoder();
  const data = encoder.encode(authPassword);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const expectedToken = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  if (token !== expectedToken) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // Supprime le token invalide
    const response = NextResponse.redirect(url);
    response.cookies.delete("auth_token");
    return response;
  }

  return passThrough(req, path);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
