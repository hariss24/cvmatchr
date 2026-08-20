import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createServerClientHelper } from '@/lib/supabase/server';
import { safeRedirectPath } from '@/app/auth/callback/route';

/**
 * Confirmation par jeton auto-suffisant — la voie des liens reçus par courriel.
 *
 * ⚠️ À ne pas confondre avec /auth/callback, qui traite le retour de Google.
 * Celui-là échange un `code` contre une session, ce qui exige une clé de
 * vérification stockée dans le navigateur d'origine. Constaté le 20/08/2026 :
 * un lien de réinitialisation ouvert sur un autre appareil que celui de la
 * demande échouait donc systématiquement — or c'est le cas courant, on lit son
 * courriel sur son téléphone. `verifyOtp` ne dépend d'aucun état local : le
 * jeton se suffit à lui-même, le lien fonctionne depuis n'importe où.
 */

/**
 * Le type vient de l'URL, donc de l'extérieur. Le transmettre tel quel
 * laisserait un lien fabriqué choisir n'importe quel flux d'authentification.
 * Seuls les deux que l'application envoie réellement sont acceptés.
 */
export function typeAutorise(brut: string | null): EmailOtpType | null {
  return brut === 'recovery' || brut === 'signup' ? brut : null;
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
  const echoue = NextResponse.redirect(`${origin}/connexion?erreur=lien_expire`);

  const tokenHash = searchParams.get('token_hash');
  const type = typeAutorise(searchParams.get('type'));
  if (!tokenHash || !type) return echoue;

  const supabase = await createServerClientHelper();
  if (!supabase) return echoue;

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return echoue;

  return NextResponse.redirect(`${origin}${safeRedirectPath(searchParams.get('next'))}`);
}
