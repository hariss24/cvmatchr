-- ---------------------------------------------------------------------
-- 0005 — Reconnaître un compte créé avec Google
--
-- POURQUOI
--
-- Supabase renvoie « Invalid login credentials » de façon identique que le mot
-- de passe soit faux ou que le compte n'ait aucun mot de passe (créé via
-- Google). Le navigateur ne peut donc pas distinguer les deux cas, et une
-- personne venue par Google se retrouve bloquée devant ses propres CV sans
-- comprendre pourquoi.
--
-- CE QUE LA FONCTION DIT, ET RIEN D'AUTRE
--
-- Un booléen. Jamais de nom, jamais de date, jamais d'identifiant. Une adresse
-- inconnue et une adresse à mot de passe renvoient toutes deux `false` : on ne
-- peut pas les distinguer par la réponse.
--
-- POURQUOI PAS `anon`
--
-- Exposée au navigateur, cette fonction serait un testeur d'adresses libre.
-- Seul `service_role` peut l'exécuter, et seule la route /api/auth/methode
-- l'appelle — sous limitation de débit, et uniquement après un échec de mot de
-- passe. La limite vit côté Next.js parce que l'IP appelante n'est pas connue
-- en SQL.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.identite_est_google(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.identities i
    JOIN auth.users u ON u.id = i.user_id
    WHERE lower(u.email) = lower(p_email)
      AND i.provider = 'google'
  );
$$;

-- ---------------------------------------------------------------------
-- DROITS D'EXÉCUTION
--
-- Ni `anon` ni `authenticated`. Contrairement à consume_rate_limit (0004), qui
-- devait servir les visiteurs, celle-ci ne doit jamais être appelable depuis un
-- navigateur.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.identite_est_google(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.identite_est_google(TEXT) TO service_role;
