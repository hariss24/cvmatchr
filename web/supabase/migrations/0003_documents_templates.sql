-- ---------------------------------------------------------------------
-- 0003 — Le serveur devient la source unique.
--
-- `documents` remplace `resumes` + `letters`. Le découpage en deux tables
-- était un héritage du moteur de réplication, qui triait par type à
-- l'envoi. Il a déjà coûté : `DocType` vaut 'CV' | 'Lettre' | 'Maître'
-- (schema.ts:152) et les CV Maîtres, ne correspondant à aucune des deux
-- tables, n'étaient répliqués nulle part.
--
-- Pas de client_updated_at / synced_at / deleted_at : plus de copie
-- concurrente à arbitrer, donc plus rien à horodater côté client.
-- ---------------------------------------------------------------------
CREATE TABLE public.documents (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id             TEXT NOT NULL,
  doc_type       TEXT NOT NULL CHECK (doc_type IN ('CV', 'Lettre', 'Maître')),
  title          TEXT NOT NULL DEFAULT '',
  company        TEXT NOT NULL DEFAULT '',
  role           TEXT NOT NULL DEFAULT '',
  label          TEXT,
  content        JSONB NOT NULL,
  template_id    TEXT,
  application_id TEXT,
  notes          TEXT NOT NULL DEFAULT '',
  job_desc       TEXT NOT NULL DEFAULT '',
  pdf_views      INT NOT NULL DEFAULT 0,
  editor_reloads INT NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- Index de liste : l'écran « Mes candidatures » trie par date décroissante.
CREATE INDEX documents_user_created_idx
  ON public.documents (user_id, created_at DESC);

CREATE TABLE public.templates (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id             TEXT NOT NULL,
  name           TEXT NOT NULL,
  letter_subject TEXT NOT NULL DEFAULT '',
  letter_body    TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TRIGGER trg_documents_touch BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_templates_touch BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_own" ON public.documents
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "templates_own" ON public.templates
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- REPRISE : les lignes déjà répliquées rejoignent `documents`.
-- `resumes` et `letters` sont CONSERVÉES — la bascule reste réversible
-- tant que la vérification manuelle (task 9) n'a pas eu lieu.
-- Les lignes supprimées en douceur (deleted_at) ne sont pas reprises.
-- ---------------------------------------------------------------------
INSERT INTO public.documents (user_id, id, doc_type, title, content, created_at, updated_at)
SELECT user_id, id, 'CV', title, content, created_at, updated_at
FROM public.resumes WHERE deleted_at IS NULL
ON CONFLICT (user_id, id) DO NOTHING;

INSERT INTO public.documents (user_id, id, doc_type, title, company, role, content, created_at, updated_at)
SELECT user_id, id, 'Lettre', title, COALESCE(company, ''), COALESCE(job_title, ''), content, created_at, updated_at
FROM public.letters WHERE deleted_at IS NULL
ON CONFLICT (user_id, id) DO NOTHING;
