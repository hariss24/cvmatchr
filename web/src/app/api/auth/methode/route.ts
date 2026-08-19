import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * « Cette adresse passe-t-elle par Google ? »
 *
 * Appelée par la page /connexion UNIQUEMENT après un échec de mot de passe,
 * jamais à la frappe : on ne répond donc jamais à quelqu'un qui n'a pas déjà
 * soumis une tentative. La limitation de débit borne ce que cette réponse
 * permet d'apprendre.
 *
 * En cas de doute — clé d'administration absente, migration 0005 non appliquée,
 * base muette — la réponse est `false`. L'interface affiche alors le message
 * générique : on préfère un message moins utile à une affirmation fausse.
 */
export async function POST(req: Request) {
  const limite = await enforceRateLimit(req, 'auth-methode');
  if (limite) return limite;

  let email: unknown;
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  if (typeof email !== 'string' || !email.trim() || email.length > 320) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ google: false });

  const { data, error } = await admin.rpc('identite_est_google', {
    p_email: email.trim(),
  });

  if (error) {
    console.warn('Reconnaissance de compte Google indisponible :', error.message);
    return NextResponse.json({ google: false });
  }

  return NextResponse.json({ google: data === true });
}
