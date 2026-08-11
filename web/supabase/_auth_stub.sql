-- =====================================================================
-- Bouchon du schéma `auth` de Supabase, pour valider les migrations sur un
-- PostgreSQL nu (cf. README.md). N'est JAMAIS appliqué sur la vraie base :
-- chez Supabase, ce schéma existe déjà et appartient au service d'auth.
--
-- Ne reproduit que ce dont les migrations ont besoin. Ne simule ni les rôles
-- Supabase ni les jetons JWT : ce bouchon valide la syntaxe et la cohérence
-- du schéma, pas le comportement du RLS.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb
);

-- Renvoient NULL hors contexte Supabase, comme les vraies fonctions quand
-- aucun jeton n'est présent (elles utilisent current_setting(..., true)).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
  LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', TRUE), '')::UUID;
  $$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT
  LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.role', TRUE), '')::TEXT;
  $$;

-- Rôle cible des GRANT de la migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;

-- Chez Supabase, `authenticated` reçoit automatiquement les droits sur les
-- tables du schéma public : c'est le RLS qui filtre, pas les GRANT. On
-- reproduit ce comportement, sinon le test d'étanchéité échouerait sur un
-- « permission denied » au niveau table, sans jamais atteindre le RLS —
-- et donnerait donc un faux sentiment de sécurité.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA auth   TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
