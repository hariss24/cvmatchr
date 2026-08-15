-- ---------------------------------------------------------------------
-- 0002 — Réglages utilisateur répliqués (profil « Mes infos », critères
-- de recherche d'offres).
--
-- Calquée sur les tables de 0001_auth_quotas.sql :
--   client_updated_at : horloge du navigateur, arbitre last-write-wins.
--   updated_at        : horloge serveur (trigger), curseur de pull.
--   deleted_at        : suppression douce.
--
-- La colonne s'appelle `id` (et non `key`) parce que filterOutStalePush()
-- interroge la colonne `id` pour toutes les tables répliquées.
-- Valeurs attendues : 'profile' | 'jobProfile'.
--
-- `templates` n'est PAS répliquée : la table locale s'auto-alimente avec les
-- modèles par défaut, dont l'horodatage frais gagnerait l'arbitrage contre les
-- modèles réels du compte (spec du 15/08/2026, §4.3).
-- ---------------------------------------------------------------------
CREATE TABLE public.user_settings (
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id                TEXT NOT NULL CHECK (id IN ('profile', 'jobProfile')),
  content           JSONB NOT NULL,
  deleted_at        TIMESTAMPTZ,
  client_updated_at TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TRIGGER trg_user_settings_touch BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_own" ON public.user_settings
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
