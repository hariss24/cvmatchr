-- =====================================================================
-- Test d'étanchéité et d'infalsifiabilité — exécutable sur PostgreSQL nu
--
-- Vérifie que les garanties de sécurité annoncées dans la spécification
-- tiennent réellement, plutôt que de supposer qu'un `CREATE POLICY` réussi
-- suffit. Chaque assertion échoue bruyamment (RAISE EXCEPTION) et interrompt
-- le script grâce à ON_ERROR_STOP.
--
-- Usage : cf. web/supabase/README.md, section « Valider la syntaxe SQL en local ».
--
-- Ce que ce test COUVRE :
--   1. Étanchéité RLS entre deux utilisateurs
--   2. Compteur de quota non falsifiable par l'utilisateur
--   3. Impossibilité de s'auto-promouvoir en plan illimité
--   4. Quota réellement appliqué (refus au dépassement)
--   5. Création automatique du profil à l'inscription
--
-- Ce que ce test NE couvre PAS : le flux OAuth, les cookies de session, la
-- couche applicative Next.js. Ces points restent à vérifier manuellement.
-- =====================================================================

\set ON_ERROR_STOP on

-- Deux utilisateurs. Le trigger on_auth_user_created doit créer leurs profils.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111', 'a@example.test', '{"full_name":"Utilisateur A"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'b@example.test', '{"full_name":"Utilisateur B"}'::jsonb);

DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.profiles;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'TEST 5 ÉCHEC : le trigger n''a pas créé les 2 profils (trouvé %)', v_count;
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.profiles
   WHERE plan_tier = 'free' AND monthly_quota_limit = 15;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'TEST 5 ÉCHEC : plan/quota par défaut incorrects';
  END IF;
  RAISE NOTICE 'TEST 5 OK — profils créés automatiquement avec free/15';
END
$$;

-- ---------------------------------------------------------------------
-- On quitte le rôle propriétaire : le RLS ne s'applique pas au propriétaire
-- des tables. Sans ce SET ROLE, le test passerait sans rien prouver.
-- ---------------------------------------------------------------------
SET ROLE authenticated;

-- --- Utilisateur A crée un CV -----------------------------------------
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

INSERT INTO public.resumes (user_id, id, title, content, client_updated_at)
VALUES ('11111111-1111-1111-1111-111111111111', 'cv-local-1', 'CV de A',
        '{"nom":"A"}'::jsonb, NOW());

-- --- Utilisateur B crée un CV portant le MÊME identifiant local --------
-- Vérifie au passage la clé primaire composite : avec une PK globale, cet
-- INSERT échouerait sur une ligne que B ne peut même pas voir.
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);

INSERT INTO public.resumes (user_id, id, title, content, client_updated_at)
VALUES ('22222222-2222-2222-2222-222222222222', 'cv-local-1', 'CV de B',
        '{"nom":"B"}'::jsonb, NOW());

-- --- TEST 1 : étanchéité ----------------------------------------------
DO $$
DECLARE v_count INT; v_title TEXT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.resumes;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST 1 ÉCHEC : B voit % CV au lieu du sien uniquement', v_count;
  END IF;

  SELECT title INTO v_title FROM public.resumes;
  IF v_title <> 'CV de B' THEN
    RAISE EXCEPTION 'TEST 1 ÉCHEC : B lit « % »', v_title;
  END IF;

  -- Lecture ciblée du CV de A par son identifiant : doit ne rien renvoyer.
  SELECT COUNT(*) INTO v_count FROM public.resumes
   WHERE user_id = '11111111-1111-1111-1111-111111111111';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST 1 ÉCHEC : B atteint les CV de A';
  END IF;

  RAISE NOTICE 'TEST 1 OK — étanchéité RLS et PK composite';
END
$$;

-- --- TEST 4 : le quota est réellement appliqué ------------------------
DO $$
DECLARE v_allowed BOOLEAN; v_used INT; v_limit INT; i INT;
BEGIN
  FOR i IN 1..15 LOOP
    SELECT allowed, used, quota_limit INTO v_allowed, v_used, v_limit
    FROM public.consume_ai_credit('tailor-resume', 1);
    IF NOT v_allowed THEN
      RAISE EXCEPTION 'TEST 4 ÉCHEC : refus prématuré au crédit % (used=%)', i, v_used;
    END IF;
  END LOOP;

  IF v_used <> 15 THEN
    RAISE EXCEPTION 'TEST 4 ÉCHEC : compteur à % après 15 appels', v_used;
  END IF;

  -- 16e appel : doit être refusé.
  SELECT allowed, used INTO v_allowed, v_used
  FROM public.consume_ai_credit('tailor-resume', 1);
  IF v_allowed THEN
    RAISE EXCEPTION 'TEST 4 ÉCHEC : le 16e appel est passé (quota non appliqué)';
  END IF;
  IF v_used <> 15 THEN
    RAISE EXCEPTION 'TEST 4 ÉCHEC : un appel refusé a quand même débité (used=%)', v_used;
  END IF;

  RAISE NOTICE 'TEST 4 OK — 15 crédits accordés, 16e refusé, pas de débit sur refus';
END
$$;

-- --- TEST 2 : le compteur n'est pas falsifiable -----------------------
DO $$
DECLARE v_rows INT; v_count INT;
BEGIN
  BEGIN
    UPDATE public.api_usage SET count = 0
     WHERE user_id = '22222222-2222-2222-2222-222222222222';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN insufficient_privilege THEN
    v_rows := 0;  -- refus franc : c'est le résultat souhaité
  END;

  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'TEST 2 ÉCHEC : % ligne(s) de compteur modifiées par l''utilisateur', v_rows;
  END IF;

  SELECT COALESCE(SUM(count), 0) INTO v_count FROM public.api_usage;
  IF v_count <> 15 THEN
    RAISE EXCEPTION 'TEST 2 ÉCHEC : compteur à % après tentative de fraude', v_count;
  END IF;

  -- Tentative de suppression pure et simple de la ligne de compteur.
  BEGIN
    DELETE FROM public.api_usage;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN insufficient_privilege THEN
    v_rows := 0;
  END;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'TEST 2 ÉCHEC : l''utilisateur a supprimé % ligne(s) de compteur', v_rows;
  END IF;

  RAISE NOTICE 'TEST 2 OK — compteur en lecture seule pour l''utilisateur';
END
$$;

-- --- TEST 3 : pas d'auto-promotion ------------------------------------
DO $$
DECLARE v_plan TEXT; v_limit INT;
BEGIN
  UPDATE public.profiles
     SET plan_tier = 'unlimited', monthly_quota_limit = 999999, display_name = 'B modifié'
   WHERE id = '22222222-2222-2222-2222-222222222222';

  SELECT plan_tier, monthly_quota_limit INTO v_plan, v_limit
  FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222';

  IF v_plan <> 'free' THEN
    RAISE EXCEPTION 'TEST 3 ÉCHEC : auto-promotion réussie (plan_tier = %)', v_plan;
  END IF;
  IF v_limit <> 15 THEN
    RAISE EXCEPTION 'TEST 3 ÉCHEC : quota auto-relevé à %', v_limit;
  END IF;

  -- Le champ légitime, lui, doit bien avoir changé.
  IF (SELECT display_name FROM public.profiles
       WHERE id = '22222222-2222-2222-2222-222222222222') <> 'B modifié' THEN
    RAISE EXCEPTION 'TEST 3 ÉCHEC : le trigger bloque aussi les champs légitimes';
  END IF;

  RAISE NOTICE 'TEST 3 OK — plan et quota neutralisés, display_name modifiable';
END
$$;

RESET ROLE;

-- --- Le service_role, lui, doit pouvoir promouvoir un compte ----------
DO $$
DECLARE v_plan TEXT;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', false);
  UPDATE public.profiles SET plan_tier = 'pro', monthly_quota_limit = 200
   WHERE id = '22222222-2222-2222-2222-222222222222';
  SELECT plan_tier INTO v_plan FROM public.profiles
   WHERE id = '22222222-2222-2222-2222-222222222222';
  IF v_plan <> 'pro' THEN
    RAISE EXCEPTION 'TEST 3b ÉCHEC : le service_role ne peut pas promouvoir (plan = %)', v_plan;
  END IF;
  RAISE NOTICE 'TEST 3b OK — le service_role peut promouvoir un compte';
END
$$;

SELECT 'TOUS_LES_TESTS_OK' AS resultat;
