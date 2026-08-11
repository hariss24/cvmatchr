import { NextResponse } from 'next/server';
import { createServerClientHelper } from '@/lib/supabase/server';

/**
 * Un `next` non validé permet de fabriquer un lien qui connecte l'utilisateur
 * puis le propulse ailleurs. On n'accepte qu'un chemin interne.
 */
export function safeRedirectPath(next: string | null): string {
  if (!next) return '/';
  if (!next.startsWith('/')) return '/';
  if (next.startsWith('//')) return '/';
  return next;
}

/** Derrière un proxy (Vercel), `origin` n'est pas l'hôte public. */
function resolveOrigin(request: Request, fallbackOrigin: string): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (!forwardedHost) return fallbackOrigin;
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${forwardedHost}`;
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin: rawOrigin } = new URL(request.url);
  const origin = resolveOrigin(request, rawOrigin);
  const next = safeRedirectPath(searchParams.get('next'));

  // L'utilisateur a refusé l'autorisation côté Google.
  if (searchParams.get('error')) {
    return NextResponse.redirect(`${origin}/?auth_error=denied`);
  }

  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
  }

  const supabase = await createServerClientHelper();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/?auth_error=not_configured`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/?auth_error=callback_failed`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
