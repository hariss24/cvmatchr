import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/security/rateLimit';
import { createServerClientHelper } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Suppression définitive du compte de la personne connectée.
 *
 * ⚠️ Côté serveur obligatoirement : supprimer un utilisateur exige la clé
 * d'administration, qui contourne toutes les règles d'accès de la base et n'a
 * donc rien à faire dans un navigateur.
 *
 * ⚠️ L'identité vient de la SESSION, jamais du corps de la requête. Accepter un
 * identifiant fourni par l'appelant reviendrait à laisser n'importe qui
 * supprimer le compte de n'importe qui d'autre.
 *
 * Les données suivent d'elles-mêmes : les neuf tables applicatives référencent
 * `auth.users(id)` en `ON DELETE CASCADE` (migrations 0001 à 0003). C'est ce
 * qui rend tenable l'engagement pris dans la politique de confidentialité.
 */
export async function POST(req: Request) {
  // Une session valide est déjà exigée plus bas : ce plafond ne protège pas
  // d'un inconnu, il borne les dégâts d'un jeton volé sur une action
  // irréversible.
  const limite = await enforceRateLimit(req, 'compte-supprimer');
  if (limite) return limite;

  const supabase = await createServerClientHelper();
  if (!supabase) {
    return NextResponse.json({ error: 'Service indisponible.' }, { status: 500 });
  }

  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) {
    return NextResponse.json({ error: 'Connectez-vous pour supprimer votre compte.' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    // Répondre 200 ferait croire à un effacement qui n'a pas eu lieu.
    console.error("Suppression de compte impossible : SUPABASE_SERVICE_ROLE_KEY absente.");
    return NextResponse.json({ error: 'Suppression indisponible. Écrivez-nous.' }, { status: 500 });
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('Suppression de compte refusée :', error.message);
    return NextResponse.json({ error: 'Suppression impossible. Écrivez-nous.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
