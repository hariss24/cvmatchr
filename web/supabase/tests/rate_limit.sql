-- =====================================================================
-- Test du compteur de débit (migration 0004) — exécutable sur PostgreSQL nu
--
-- Vérifie que la limite compte, refuse, se réarme, sépare ses compteurs, et
-- qu'un visiteur ne peut pas remettre le sien à zéro. Chaque assertion échoue
-- bruyamment (RAISE EXCEPTION) et interrompt le script grâce à ON_ERROR_STOP.
--
-- Usage : cf. web/supabase/README.md, section « Tester en local ».
--
-- Ce que ce test COUVRE :
--   1. Les appels sous la limite passent, et le compteur s'incrémente
--   2. L'appel de trop est refusé, avec un retry_after exploitable
--   3. Deux seaux (routes ou IP différentes) ne se contaminent pas
--   4. Une fenêtre expirée remet le compteur à 1 au lieu de l'incrémenter
--   5. La table est inaccessible en direct, même à un utilisateur connecté
--
-- Ce que ce test NE couvre PAS : le calcul de l'IP appelante et le choix des
-- plafonds, qui vivent côté Next.js (src/lib/security/rateLimit.test.ts).
-- =====================================================================

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------
-- TEST 1 & 2 — comptage puis refus
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  i INT;
BEGIN
  -- Trois appels autorisés sur une fenêtre d'une heure.
  FOR i IN 1..3 LOOP
    SELECT * INTO r FROM public.consume_rate_limit('test:1.2.3.4', 3, 3600);
    IF NOT r.allowed THEN
      RAISE EXCEPTION 'TEST 1 ÉCHEC : appel % refusé alors que la limite est 3', i;
    END IF;
    IF r.used <> i THEN
      RAISE EXCEPTION 'TEST 1 ÉCHEC : compteur = % au lieu de % à l''appel %', r.used, i, i;
    END IF;
  END LOOP;

  -- Le quatrième doit tomber.
  SELECT * INTO r FROM public.consume_rate_limit('test:1.2.3.4', 3, 3600);
  IF r.allowed THEN
    RAISE EXCEPTION 'TEST 2 ÉCHEC : 4e appel autorisé alors que la limite est 3';
  END IF;
  IF r.retry_after <= 0 OR r.retry_after > 3600 THEN
    RAISE EXCEPTION 'TEST 2 ÉCHEC : retry_after inexploitable (%)', r.retry_after;
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- TEST 3 — les seaux sont indépendants
--
-- Sans ça, une IP bruyante bloquerait tout le monde, ou une route saturée
-- fermerait les autres.
-- ---------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  -- Même route, autre IP : compteur neuf.
  SELECT * INTO r FROM public.consume_rate_limit('test:9.9.9.9', 3, 3600);
  IF NOT r.allowed OR r.used <> 1 THEN
    RAISE EXCEPTION 'TEST 3 ÉCHEC : une autre IP hérite du compteur (used = %)', r.used;
  END IF;

  -- Même IP, autre route : compteur neuf aussi.
  SELECT * INTO r FROM public.consume_rate_limit('autre:1.2.3.4', 3, 3600);
  IF NOT r.allowed OR r.used <> 1 THEN
    RAISE EXCEPTION 'TEST 3 ÉCHEC : une autre route hérite du compteur (used = %)', r.used;
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- TEST 4 — la fenêtre se réarme
--
-- On vieillit artificiellement le seau saturé du TEST 2 : le prochain appel
-- doit repartir à 1, pas continuer à 5.
-- ---------------------------------------------------------------------
UPDATE public.rate_limits
   SET window_start = now() - INTERVAL '2 hours'
 WHERE bucket = 'test:1.2.3.4';

DO $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.consume_rate_limit('test:1.2.3.4', 3, 3600);
  IF NOT r.allowed THEN
    RAISE EXCEPTION 'TEST 4 ÉCHEC : seau toujours bloqué après expiration de la fenêtre';
  END IF;
  IF r.used <> 1 THEN
    RAISE EXCEPTION 'TEST 4 ÉCHEC : compteur non réarmé (used = % au lieu de 1)', r.used;
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- TEST 5 — la table est hors de portée des utilisateurs
--
-- RLS activée sans aucune policy. Le rôle est endossé explicitement : sans
-- SET ROLE, le script tournerait en propriétaire des tables, pour qui le RLS
-- ne s'applique pas — et passerait sans rien prouver.
-- ---------------------------------------------------------------------
SET ROLE authenticated;

DO $$
DECLARE
  v_lus      INT;
  v_modifies INT;
  v_inseres  INT := 0;
BEGIN
  SELECT COUNT(*) INTO v_lus FROM public.rate_limits;
  IF v_lus <> 0 THEN
    RAISE EXCEPTION 'TEST 5 ÉCHEC : % ligne(s) de compteur lisibles par l''utilisateur', v_lus;
  END IF;

  UPDATE public.rate_limits SET hits = 0;
  GET DIAGNOSTICS v_modifies = ROW_COUNT;
  IF v_modifies <> 0 THEN
    RAISE EXCEPTION 'TEST 5 ÉCHEC : % ligne(s) remises à zéro par l''utilisateur', v_modifies;
  END IF;

  BEGIN
    INSERT INTO public.rate_limits (bucket, hits) VALUES ('test:1.2.3.4', 0);
    GET DIAGNOSTICS v_inseres = ROW_COUNT;
  EXCEPTION WHEN insufficient_privilege THEN
    v_inseres := 0;  -- Refus attendu.
  END;
  IF v_inseres <> 0 THEN
    RAISE EXCEPTION 'TEST 5 ÉCHEC : l''utilisateur a pu écrire un compteur';
  END IF;
END
$$;

RESET ROLE;

-- ---------------------------------------------------------------------
-- TEST 5b — mais la fonction, elle, reste appelable par un visiteur anonyme
--
-- C'est tout l'intérêt du SECURITY DEFINER : compter sans donner accès au
-- compteur. Si ce GRANT sautait, toutes les routes publiques échoueraient en
-- silence et repasseraient sans limite (le code applicatif laisse passer en
-- cas d'erreur).
-- ---------------------------------------------------------------------
SET ROLE anon;

DO $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.consume_rate_limit('test:anonyme', 3, 3600);
  IF NOT r.allowed OR r.used <> 1 THEN
    RAISE EXCEPTION 'TEST 5b ÉCHEC : appel anonyme mal compté (used = %)', r.used;
  END IF;
END
$$;

RESET ROLE;

SELECT 'TOUS_LES_TESTS_OK' AS resultat;
