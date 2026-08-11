-- =====================================================================
-- 0001 — Comptes, données utilisateur et quotas IA
--
-- Spécification : docs/superpowers/specs/2026-08-10-auth-database-design.md
-- Plan          : docs/superpowers/plans/2026-08-10-auth-database-implementation.md (Task 0)
--
-- Ce fichier est la SOURCE DE VÉRITÉ du schéma. Ne jamais modifier la base
-- à la main dans l'interface Supabase : le prochain environnement (préprod,
-- test, réinstallation) divergerait sans que personne ne le sache.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROFILS
-- ---------------------------------------------------------------------
CREATE TABLE public.profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT NOT NULL,
  display_name        TEXT,
  avatar_url          TEXT,
  plan_tier           TEXT NOT NULL DEFAULT 'free'
                        CHECK (plan_tier IN ('free', 'pro', 'unlimited')),
  monthly_quota_limit INT  NOT NULL DEFAULT 15 CHECK (monthly_quota_limit >= 0),
  ai_provider         TEXT NOT NULL DEFAULT 'gemini'
                        CHECK (ai_provider IN ('gemini', 'anthropic', 'deepseek')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.profiles.plan_tier IS
  'Modifiable uniquement par le service_role (cf. trigger guard_profile_privileges).';
COMMENT ON COLUMN public.profiles.monthly_quota_limit IS
  'Crédits IA offerts par mois calendaire. Protégé par le même trigger.';

-- ---------------------------------------------------------------------
-- 2..5. DONNÉES UTILISATEUR
--
-- PK composite (user_id, id) : l'identifiant vient du navigateur, il n'est
-- unique que par utilisateur. Avec une PK globale, deux utilisateurs important
-- le même fichier de sauvegarde entrent en collision sur une ligne qu'ils ne
-- peuvent pas voir (RLS), avec une erreur indébogable.
--
-- client_updated_at : horloge du navigateur, arbitre les conflits (last-write-wins).
-- updated_at        : horloge du serveur (trigger), sert de curseur de pull.
--                     Sans elle, la synchronisation descendante est impossible
--                     et une horloge client déréglée corrompt les données.
-- deleted_at        : suppression douce. Une suppression réelle ne laisse aucune
--                     trace à répliquer, et le document ressuscite au pull suivant.
-- ---------------------------------------------------------------------
CREATE TABLE public.resumes (
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id                TEXT NOT NULL,
  title             TEXT NOT NULL,
  content           JSONB NOT NULL,
  is_primary        BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at        TIMESTAMPTZ,
  client_updated_at TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE public.letters (
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id                TEXT NOT NULL,
  title             TEXT NOT NULL,
  company           TEXT,
  job_title         TEXT,
  content           JSONB NOT NULL,
  deleted_at        TIMESTAMPTZ,
  client_updated_at TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE public.applications (
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id                TEXT NOT NULL,
  company           TEXT NOT NULL,
  job_title         TEXT NOT NULL,
  url               TEXT,
  status            TEXT NOT NULL DEFAULT 'draft',
  notes             TEXT,
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_at        TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ,
  client_updated_at TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

COMMENT ON COLUMN public.applications.payload IS
  'Journal d''événements local (Application.events côté Dexie), répliqué tel quel.';

-- saved_jobs possède bien un updated_at : le statut d'une offre est mutable,
-- et le delta de synchronisation en dépend.
CREATE TABLE public.saved_jobs (
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id                TEXT NOT NULL,
  job_data          JSONB NOT NULL,
  deleted_at        TIMESTAMPTZ,
  client_updated_at TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- ---------------------------------------------------------------------
-- 6. COMPTEURS DE QUOTA
-- ---------------------------------------------------------------------
CREATE TABLE public.api_usage (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW()),
  count        INT NOT NULL DEFAULT 0 CHECK (count >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, endpoint, period_start)
);

COMMENT ON TABLE public.api_usage IS
  'Lecture seule pour l''utilisateur. Écrit exclusivement par consume_ai_credit().';

-- ---------------------------------------------------------------------
-- INDEX — le curseur de pull est (user_id, updated_at)
-- ---------------------------------------------------------------------
CREATE INDEX idx_resumes_pull      ON public.resumes(user_id, updated_at);
CREATE INDEX idx_letters_pull      ON public.letters(user_id, updated_at);
CREATE INDEX idx_applications_pull ON public.applications(user_id, updated_at);
CREATE INDEX idx_saved_jobs_pull   ON public.saved_jobs(user_id, updated_at);

-- ---------------------------------------------------------------------
-- TRIGGER : updated_at serveur
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_resumes_touch      BEFORE UPDATE ON public.resumes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_letters_touch      BEFORE UPDATE ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_applications_touch BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_saved_jobs_touch   BEFORE UPDATE ON public.saved_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_touch     BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------
-- TRIGGER : création automatique du profil à l'inscription
--
-- SET search_path = '' sur toutes les fonctions SECURITY DEFINER : sans ça,
-- l'audit de sécurité Supabase les signale (function_search_path_mutable)
-- comme vecteur potentiel d'escalade de privilèges.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.email
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email        = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    avatar_url   = EXCLUDED.avatar_url;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------
-- TRIGGER : garde anti-escalade sur le plan et le quota
--
-- Sans lui, l'utilisateur exécute depuis la console de son navigateur :
--   await supabase.from('profiles').update({ plan_tier: 'unlimited' })
-- et tout le modèle économique tombe. La policy UPDATE reste nécessaire
-- pour qu'il puisse modifier son display_name : c'est ce trigger qui
-- restreint les colonnes, pas la policy.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  NEW.id                  := OLD.id;
  NEW.plan_tier           := OLD.plan_tier;
  NEW.monthly_quota_limit := OLD.monthly_quota_limit;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();

-- ---------------------------------------------------------------------
-- FONCTION : consommation atomique d'un crédit IA
--
-- La vérification ET l'incrément sont dans la même transaction. Un contrôle
-- côté application suivi d'un incrément séparé laisse une fenêtre de course :
-- deux clics simultanés passent tous les deux la vérification.
-- Le FOR UPDATE sur le profil sérialise les appels concurrents du même
-- utilisateur ; les appels d'utilisateurs différents ne se bloquent pas.
--
-- Retourne (allowed, used, quota_limit). Ne lève que sur erreur d'appel.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_ai_credit(p_endpoint TEXT, p_cost INT DEFAULT 1)
RETURNS TABLE (allowed BOOLEAN, used INT, quota_limit INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user   UUID := auth.uid();
  v_limit  INT;
  v_used   INT;
  v_period TIMESTAMPTZ := date_trunc('month', NOW());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_cost < 1 THEN
    RAISE EXCEPTION 'invalid_cost';
  END IF;

  SELECT p.monthly_quota_limit INTO v_limit
  FROM public.profiles p
  WHERE p.id = v_user
  FOR UPDATE;

  IF v_limit IS NULL THEN
    RAISE EXCEPTION 'profile_missing';
  END IF;

  SELECT COALESCE(SUM(u.count), 0)::INT INTO v_used
  FROM public.api_usage u
  WHERE u.user_id = v_user
    AND u.period_start = v_period;

  IF v_used + p_cost > v_limit THEN
    RETURN QUERY SELECT FALSE, v_used, v_limit;
    RETURN;
  END IF;

  INSERT INTO public.api_usage (user_id, endpoint, count, period_start)
  VALUES (v_user, p_endpoint, p_cost, v_period)
  ON CONFLICT (user_id, endpoint, period_start)
  DO UPDATE SET count = api_usage.count + p_cost;

  RETURN QUERY SELECT TRUE, v_used + p_cost, v_limit;
END;
$$;

-- ---------------------------------------------------------------------
-- FONCTION : consommation du mois en cours (affichage du compteur)
--
-- LANGUAGE sql, pas plpgsql : un corps SELECT nu déclaré en plpgsql sans
-- BEGIN/END fait échouer CREATE FUNCTION. C'était le cas dans la première
-- version de la spécification.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_monthly_ai_usage()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(SUM(count), 0)::INT
  FROM public.api_usage
  WHERE user_id = auth.uid()
    AND period_start = date_trunc('month', NOW());
$$;

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
--
-- (SELECT auth.uid()) plutôt que auth.uid() : recommandation de performance
-- officielle Supabase — la valeur est évaluée une fois, pas par ligne.
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letters      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage    ENABLE ROW LEVEL SECURITY;

-- Profil : lecture et mise à jour de ses propres champs éditables.
-- Pas de policy INSERT ni DELETE : le profil naît et meurt avec le compte auth.
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING ((SELECT auth.uid()) = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Données utilisateur : contrôle total sur ses propres lignes.
CREATE POLICY "resumes_own" ON public.resumes
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "letters_own" ON public.letters
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "applications_own" ON public.applications
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "saved_jobs_own" ON public.saved_jobs
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Compteurs : LECTURE SEULE.
-- Aucune policy d'écriture n'est déclarée, donc INSERT/UPDATE/DELETE sont
-- refusés à l'utilisateur. Seule consume_ai_credit() (SECURITY DEFINER) écrit.
CREATE POLICY "api_usage_select_own" ON public.api_usage
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- DROITS D'EXÉCUTION
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.consume_ai_credit(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit(TEXT, INT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_monthly_ai_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_monthly_ai_usage() TO authenticated;
