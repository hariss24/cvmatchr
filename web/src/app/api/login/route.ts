import { NextResponse } from "next/server";

const rateLimits = new Map<string, { count: number; lastAttempt: number }>();

export async function POST(req: Request) {
  // Simple rate limiting by IP (using x-forwarded-for if available)
  const ip = req.headers.get("x-forwarded-for") || "unknown-ip";
  const now = Date.now();

  const record = rateLimits.get(ip);
  if (record) {
    if (now - record.lastAttempt < 60000) {
      if (record.count >= 5) {
        return NextResponse.json({ error: "Trop de tentatives. Réessayez dans une minute." }, { status: 429 });
      }
      record.count += 1;
      record.lastAttempt = now;
    } else {
      record.count = 1;
      record.lastAttempt = now;
    }
  } else {
    rateLimits.set(ip, { count: 1, lastAttempt: now });
  }

  // Artificial delay to mitigate timing attacks and slow down brute-force further
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const { password } = await req.json();
    const authPassword = process.env.REMOTE_AUTH_PASSWORD || process.env.AUTH_PASSWORD;

    if (!authPassword) {
      return NextResponse.json({ success: true, message: "No auth required." });
    }

    if (password === authPassword) {
      // Clear rate limit on success
      rateLimits.delete(ip);

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
