import { NextResponse } from 'next/server';
import { readAiHeaders } from './http';
import { createServerClientHelper } from '@/lib/supabase/server';
import { evaluateQuotaRules, ENDPOINT_COST, type BillableEndpoint } from './quota';

/**
 * Modèle imposé quand c'est la clé du serveur qui paie.
 *
 * Figé ici, et non réglable par variable d'environnement : le réglage
 * `AI_SERVER_MODEL` pointait sur `gemini-2.5-flash`, que Google a depuis retiré
 * aux nouveaux projets. Tous les appels IA des comptes sans clé personnelle
 * échouaient donc en 404 — une panne totale décidée par une valeur oubliée dans
 * un tableau de bord, invisible depuis le code. Le choix étant de toute façon
 * imposé (cf. plus bas), le rendre réglable n'offrait rien qu'un moyen de casser
 * la production.
 *
 * `flash-lite` est le plus rapide et le moins cher de la gamme : c'est celui qui
 * convient quand c'est nous qui payons.
 */
export const SERVER_MODEL = 'gemini-3.1-flash-lite';

export interface AiGrant {
  /** Clé à utiliser pour l'appel : celle de l'utilisateur, ou celle du serveur. */
  key: string;
  /** Modèle : le choix de l'utilisateur avec sa clé, imposé avec la clé du serveur. */
  model: string | null;
}

/**
 * Autorise ou refuse un appel IA AVANT d'atteindre le fournisseur.
 * Renvoie soit une `Response` d'erreur à retourner telle quelle, soit un `AiGrant`.
 */
export async function guardAiRequest(
  req: Request,
  endpoint: BillableEndpoint,
): Promise<Response | AiGrant> {
  const { key: userKey, model: userModel } = readAiHeaders(req);

  // 1. Clé personnelle : l'utilisateur paie, on ne compte rien.
  if (userKey) return { key: userKey, model: userModel };

  // 2. Pas de clé perso → il faut un compte.
  const supabase = await createServerClientHelper();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const verdict = evaluateQuotaRules({
    hasCustomKey: false,
    isAuthenticated: Boolean(data.user),
  });
  if (!verdict.allowed) {
    return NextResponse.json({ error: verdict.message }, { status: verdict.status });
  }

  // 3. Consommation atomique du crédit (0 = gratuit, on ne consomme pas).
  const cost = ENDPOINT_COST[endpoint];
  if (cost > 0 && supabase) {
    const { data: rows, error } = await supabase.rpc('consume_ai_credit', {
      p_endpoint: endpoint,
      p_cost: cost,
    });
    if (error) {
      return NextResponse.json(
        { error: "Impossible de vérifier votre quota. Réessayez." },
        { status: 503 },
      );
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row?.allowed) {
      return NextResponse.json(
        {
          error:
            'Quota mensuel gratuit atteint. Ajoutez votre clé API dans les Paramètres, ou passez à la formule Pro.',
          used: row?.used,
          limit: row?.quota_limit,
        },
        { status: 429 },
      );
    }
  }

  // 4. La clé du serveur paie → on impose un modèle Gemini, sinon on aurait
  //    débité un crédit pour un appel Anthropic qui échouera faute de clé.
  const serverKey = process.env.GEMINI_API_KEY;
  if (!serverKey) {
    return NextResponse.json(
      { error: "Le service IA n'est pas configuré sur ce serveur." },
      { status: 503 },
    );
  }
  return { key: serverKey, model: SERVER_MODEL };
}
