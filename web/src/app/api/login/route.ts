import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export async function POST(req: Request) {
  // Le compteur de tentatives vivait dans une `Map` en mémoire. Sur Vercel,
  // chaque requête peut atterrir sur une instance différente et la mémoire
  // disparaît à froid : le seuil « 5 essais par minute » repartait de zéro sans
  // arrêt, et ne freinait donc aucune attaque par force brute. Le compteur est
  // désormais partagé en base (cf. lib/security/rateLimit.ts).
  const limite = await enforceRateLimit(req, "login");
  if (limite) return limite;

  // Ralentit la force brute et lisse les écarts de temps de réponse entre un
  // mot de passe correct et un mot de passe faux.
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const { password } = await req.json();
    const authPassword = process.env.REMOTE_AUTH_PASSWORD || process.env.AUTH_PASSWORD;

    if (!authPassword) {
      return NextResponse.json({ success: true, message: "No auth required." });
    }

    if (password === authPassword) {
      const encoder = new TextEncoder();
      const data = encoder.encode(authPassword);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const token = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      const response = NextResponse.json({ success: true });
      response.cookies.set("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
      return response;
    } else {
      return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
}
