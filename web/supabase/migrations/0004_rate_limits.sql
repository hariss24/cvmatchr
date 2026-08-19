-- ---------------------------------------------------------------------
-- 0004 — Compteur d'appels partagé, pour limiter le débit des routes API
-- ouvertes aux visiteurs non connectés.
--
-- POURQUOI EN BASE, ET PAS EN MÉMOIRE
--
-- `/api/login` comptait ses tentatives dans une `Map` JavaScript. Sur Vercel,
-- chaque requête peut atterrir sur une instance différente, et la mémoire d'une
-- instance disparaît à froid : le compteur repartait de zéro en permanence. La
-- protection existait dans le code sans exister dans les faits.
--
-- Un compteur n'a de sens que s'il est partagé par toutes les instances. La base
-- est le seul entrepôt commun déjà présent — pas de service supplémentaire à
-- payer ni à surveiller.
--
-- CE QUE ÇA PROTÈGE
--
-- Les routes concernées dépensent des ressources facturées à chaque appel :
-- Google Maps (`/api/jobs/commute`), France Travail / Adzuna / JSearch
-- (`/api/jobs/search`), Brandfetch (`/api/jobs/logos`), ou du temps machine
-- (`/api/extract-job`). Sans limite, une simple boucle produit une facture.
--
-- FENÊTRE FIXE, PAS GLISSANTE
--
-- Le compteur repart à zéro à l'expiration de la fenêtre. Un attaquant peut donc
-- envoyer 2× la limite à cheval sur deux fenêtres. C'est assumé : la fenêtre
-- glissante coûte une ligne par appel, là où celle-ci en coûte une par IP et par
-- route. On cherche à rendre l'abus non rentable, pas à le rendre impossible.
-- ---------------------------------------------------------------------
CREATE TABLE public.rate_limits (
  -- « <route>:<ip> ». Composé côté serveur : jamais alimenté par le client.
  bucket       TEXT PRIMARY KEY,
  hits         INT NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purge manuelle des fenêtres dormantes (voir README).
CREATE INDEX idx_rate_limits_window ON public.rate_limits (window_start);

-- RLS activée SANS AUCUNE POLICY : ni `anon` ni `authenticated` ne peuvent lire
-- ni écrire cette table directement. Seule consume_rate_limit() y touche, et
-- elle est SECURITY DEFINER. Sans ça, n'importe quel visiteur remettrait son
-- propre compteur à zéro depuis la console de son navigateur.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- FONCTION : consommer un appel et dire s'il est autorisé
--
-- Renvoie `allowed` = false quand la limite est dépassée, plus `retry_after`
-- (secondes) pour l'en-tête HTTP du même nom.
--
-- Tout tient dans un seul INSERT ... ON CONFLICT : l'incrément est atomique, donc
-- deux requêtes simultanées ne peuvent pas lire la même valeur et l'écraser
-- (même raison que consume_ai_credit dans 0001).
--
-- SET search_path = '' : exigé par l'audit de sécurité Supabase sur toute
-- fonction SECURITY DEFINER (function_search_path_mutable).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_bucket         TEXT,
  p_limit          INT,
  p_window_seconds INT
)
RETURNS TABLE (allowed BOOLEAN, used INT, retry_after INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now    TIMESTAMPTZ := now();
  v_expiry TIMESTAMPTZ := now() - make_interval(secs => p_window_seconds);
  v_hits   INT;
  v_start  TIMESTAMPTZ;
BEGIN
  INSERT INTO public.rate_limits AS rl (bucket, hits, window_start)
  VALUES (p_bucket, 1, v_now)
  ON CONFLICT (bucket) DO UPDATE SET
    -- Fenêtre expirée : on recommence à 1 au lieu d'incrémenter.
    hits         = CASE WHEN rl.window_start < v_expiry THEN 1     ELSE rl.hits + 1 END,
    window_start = CASE WHEN rl.window_start < v_expiry THEN v_now ELSE rl.window_start END
  RETURNING rl.hits, rl.window_start INTO v_hits, v_start;

  RETURN QUERY SELECT
    v_hits <= p_limit,
    v_hits,
    GREATEST(
      0,
      CEIL(EXTRACT(EPOCH FROM (v_start + make_interval(secs => p_window_seconds) - v_now)))
    )::INT;
END;
$$;

-- ---------------------------------------------------------------------
-- DROITS D'EXÉCUTION
--
-- `anon` est inclus : les routes protégées servent aussi les visiteurs non
-- connectés — c'est précisément eux qu'il faut compter.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INT, INT) TO anon, authenticated;
