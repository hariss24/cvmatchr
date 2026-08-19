-- =====================================================================
-- Test de la reconnaissance des comptes Google (migration 0005)
--
-- Ce que ce test COUVRE :
--   1. Une adresse liée à Google renvoie vrai
--   2. Une adresse à mot de passe renvoie faux
--   3. Une adresse inconnue renvoie faux (indistinguable du cas 2)
--   4. La casse de l'adresse n'a aucune influence
--   5. `anon` et `authenticated` ne peuvent pas exécuter la fonction
--
-- Ce que ce test NE couvre PAS : la limitation de débit et le moment de
-- l'appel, qui vivent côté Next.js (src/lib/security/rateLimit.test.ts et
-- src/app/api/auth/methode/route.ts).
-- =====================================================================

\set ON_ERROR_STOP on

-- Deux comptes de test : un Google, un à mot de passe.
INSERT INTO auth.users (id, email)
VALUES ('11111111-1111-1111-1111-111111111111', 'google@test.fr'),
       ('22222222-2222-2222-2222-222222222222', 'motdepasse@test.fr');

INSERT INTO auth.identities (id, user_id, provider, provider_id)
VALUES ('aaaaaaaa-1111-1111-1111-111111111111',
        '11111111-1111-1111-1111-111111111111', 'google', 'google-123'),
       ('bbbbbbbb-2222-2222-2222-222222222222',
        '22222222-2222-2222-2222-222222222222', 'email', 'motdepasse@test.fr');

DO $$
BEGIN
  IF NOT public.identite_est_google('google@test.fr') THEN
    RAISE EXCEPTION 'TEST 1 ÉCHEC : un compte Google n''est pas reconnu';
  END IF;

  IF public.identite_est_google('motdepasse@test.fr') THEN
    RAISE EXCEPTION 'TEST 2 ÉCHEC : un compte à mot de passe est pris pour un compte Google';
  END IF;

  IF public.identite_est_google('inconnu@test.fr') THEN
    RAISE EXCEPTION 'TEST 3 ÉCHEC : une adresse inconnue renvoie vrai';
  END IF;

  IF NOT public.identite_est_google('GOOGLE@Test.FR') THEN
    RAISE EXCEPTION 'TEST 4 ÉCHEC : la casse de l''adresse change la réponse';
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- TEST 5 — la fonction est fermée aux rôles du navigateur
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT unnest(ARRAY['anon', 'authenticated']) AS role_nom LOOP
    IF has_function_privilege(r.role_nom,
                              'public.identite_est_google(text)',
                              'EXECUTE') THEN
      RAISE EXCEPTION 'TEST 5 ÉCHEC : le rôle % peut exécuter la fonction', r.role_nom;
    END IF;
  END LOOP;
END
$$;

SELECT 'TOUS_LES_TESTS_OK' AS resultat;
