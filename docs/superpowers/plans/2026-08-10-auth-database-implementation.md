# Plan d'implémentation — Supabase Auth, Base de données & Quotas IA

> **Pour les agents** : SOUS-COMPÉTENCE REQUISE — utiliser `superpowers:subagent-driven-development`
> (recommandé) ou `superpowers:executing-plans` pour exécuter ce plan tâche par tâche.
> Les étapes utilisent la syntaxe checkbox (`- [ ]`).
>
> ⚠️ **Ce plan remplace la version du 10/08/2026 matin, invalidée par la revue technique.**
> Sur les points suivants, **ce plan fait autorité contre le spec**
> `docs/superpowers/specs/2026-08-10-auth-database-design.md`, qui n'a pas encore été mis à jour :
> SQL (policies RLS, clés primaires, fonctions), colonne `custom_ai_key` (supprimée),
> emplacement du composant `UserMenu`, et format des dates de synchronisation.
> Le spec reste la référence pour les **règles métier** (§1 Modèle économique).

**Objectif** : intégrer Supabase (PostgreSQL + Google OAuth), une application **effective**
des quotas IA côté serveur, et un moteur de synchronisation offline-first bidirectionnel
avec Dexie/IndexedDB.

**Architecture** : `@supabase/ssr` gère les sessions par cookie. Les routes API refusent ou
facturent les appels IA **avant** d'appeler Gemini/Anthropic, via une fonction PostgreSQL
atomique. Un `SyncEngine` réplique IndexedDB ↔ PostgreSQL en delta, avec soft deletes.

**Stack** : Next.js 16 (App Router), TypeScript, `@supabase/ssr`, `@supabase/supabase-js`,
Zustand, Vitest, Dexie.

---

## Contraintes globales

- Conventions Next.js 16 : lire `web/AGENTS.md` avant d'écrire du code serveur.
- TypeScript strict : pas de `any`, pas de `@ts-ignore`, **pas de `!` non-null sur `process.env`**.
- **Zéro régression invité** : sans variables d'environnement Supabase, l'application doit
  démarrer et fonctionner exactement comme aujourd'hui (mode 100 % local). Toute erreur
  `createBrowserClient(undefined)` est un échec de tâche.
- Ne jamais coder une couleur en dur : utiliser les variables de thème.
- Ne jamais envoyer de photo base64 à une API IA (déjà garanti dans les routes existantes,
  ne pas casser).
- **Interdiction de supprimer la protection `REMOTE_AUTH_PASSWORD`** sans la remplacer (Task 1).
- Chaque tâche se termine par `npx tsc --noEmit` **en plus** des tests : Vitest ne typecheck pas.

## Séquencement et pourquoi

Les tâches 0 et 3 sont celles qui font exister le système. Elles étaient absentes de la
version précédente du plan, qui livrait les périphériques (helpers, store, composant) et
aucun mécanisme d'application. **Ne pas réordonner.**

| # | Tâche | Sans elle |
|---|---|---|
| 0 | Base de données et migration | Les tâches 1 à 7 parlent à une base inexistante |
| 1 | Helpers SSR + middleware composé | La protection du déploiement distant disparaît |
| 2 | authStore + callback + montage | `isLoading` reste `true`, rien ne s'affiche |
| 3 | **Application du quota dans les routes** | La clé Gemini de l'app reste gratuite pour tout internet |
| 4 | Dexie v13 + dates + soft deletes | Les documents supprimés ressuscitent |
| 5 | SyncEngine push **et** pull + import | Pas de multi-appareil ; les imports cassent la synchro |
| 6 | UI compte + quota | L'utilisateur ne sait pas où il en est |
| 7 | Vérification finale + étanchéité RLS | On ne saura jamais si A peut lire les CV de B |

---

### Task 0 : Dépendances, migration SQL et environnement

**Fichiers :**
- Créer : `web/supabase/migrations/0001_auth_quotas.sql`
- Créer : `web/supabase/README.md`
- Modifier : `web/package.json` (dépendances)
- Modifier/Créer : `web/.env.example`

**Interfaces :**
- Produit : les 6 tables, les policies RLS, les 4 fonctions et les 3 triggers.
- Consommé par : toutes les tâches suivantes.

**Décisions actées (divergences assumées avec le spec) :**

1. **Clés primaires composites `(user_id, id)`.** Les identifiants sont générés par le
   navigateur. Avec une PK globale, deux utilisateurs important le même fichier de
   sauvegarde entrent en collision sur une ligne qu'ils ne peuvent pas voir (RLS), avec une
   erreur incompréhensible.
2. **`api_usage` est en lecture seule pour l'utilisateur.** Le spec utilisait `FOR ALL`, ce
   qui permettait à n'importe qui de remettre son compteur à zéro depuis la console du
   navigateur. Les écritures passent exclusivement par `consume_ai_credit()`.
3. **`plan_tier` et `monthly_quota_limit` sont protégés par un trigger.** Sinon l'utilisateur
   se déclare `unlimited` en une commande.
4. **La colonne `custom_ai_key` est supprimée.** Le spec la définissait tout en disant que la
   clé transite par l'en-tête `X-Api-Key` — les deux mécanismes faisaient doublon. La clé
   personnelle reste dans le navigateur (comportement actuel, `settingsStore`). Stocker en
   clair des secrets de tiers dans la base ajoute une responsabilité RGPD/sécurité sans
   contrepartie fonctionnelle au MVP. Si le besoin multi-appareil apparaît, ce sera via
   Supabase Vault, dans une migration dédiée.
5. **Deux horodatages distincts** sur les tables synchronisées :
   - `client_updated_at` — posé par le navigateur, sert à arbitrer les conflits (last-write-wins) ;
   - `updated_at` — posé par le serveur via trigger, sert de **curseur de pull** (« donne-moi
     tout ce qui a changé depuis X »). Sans lui, le pull de la Task 5 est impossible, et une
     horloge client déréglée corrompt la synchro.
6. **`ai_provider` accepte `deepseek`** : le code en production supporte trois fournisseurs
   (`web/src/lib/ai/clients.ts`), le spec n'en listait que deux.

- [ ] **Step 1 : Installer les dépendances**

```bash
cd web && npm install @supabase/ssr @supabase/supabase-js
```

Vérifier que `@supabase/ssr` et `@supabase/supabase-js` apparaissent dans `web/package.json`.

- [x] **Step 2 : Écrire et valider la migration** — ✅ fait et vérifié le 10/08/2026

Fichiers créés :
- `web/supabase/migrations/0001_auth_quotas.sql` — la migration ;
- `web/supabase/_auth_stub.sql` — bouchon du schéma `auth` (permet de tourner sur un
  PostgreSQL nu) ;
- `web/supabase/tests/rls_etancheite.sql` — 6 tests de sécurité exécutables ;
- `web/supabase/README.md` — commandes et couverture.

**Vérification réellement exécutée** (PostgreSQL 15 via Docker) :
- la migration s'applique sans erreur ;
- les 6 tests passent (`TOUS_LES_TESTS_OK`) : étanchéité RLS, PK composite, compteur non
  falsifiable, non-escalade de plan, promotion par `service_role`, quota appliqué au 16ᵉ
  appel, création automatique du profil ;
- **validation par mutation** : en réintroduisant `FOR ALL` sur `api_usage`, le TEST 2
  échoue ; en retirant le trigger anti-escalade, le TEST 3 échoue. Les assertions ne sont
  donc pas décoratives.

Cela couvre les points 2 à 6 de la Task 7. Restent manuels : le flux OAuth, le 401 de
l'invité et le 429 applicatif, qui dépendent du garde de la Task 3.

Contenu de la migration (le fichier fait foi en cas de divergence) :

```sql
-- =====================================================================
-- 0001 — Comptes, données utilisateur et quotas IA
-- Corrige la version du spec du 10/08/2026 (voir Task 0 du plan).
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

-- ---------------------------------------------------------------------
-- 2..5. DONNÉES UTILISATEUR
-- PK composite : l'id vient du navigateur, il n'est unique que par utilisateur.
-- client_updated_at = horloge du client (arbitrage de conflit).
-- updated_at        = horloge du serveur (curseur de pull), posé par trigger.
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
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,  -- journal d'événements local
  applied_at        TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ,
  client_updated_at TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- saved_jobs a bien un updated_at : le statut d'une offre est mutable,
-- et le delta de synchro en dépend (le spec ne prévoyait que created_at).
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
-- SET search_path = '' : sans ça, l'audit de sécurité Supabase le signale
-- comme vecteur d'escalade de privilèges.
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
-- Sans lui, `UPDATE profiles SET plan_tier='unlimited'` depuis la console
-- du navigateur suffit à contourner tout le modèle économique.
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
  NEW.plan_tier           := OLD.plan_tier;
  NEW.monthly_quota_limit := OLD.monthly_quota_limit;
  NEW.id                  := OLD.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();

-- ---------------------------------------------------------------------
-- FONCTION : consommation atomique d'un crédit IA
-- Vérification ET incrément dans la même transaction. Un check suivi d'un
-- increment séparé laisse une fenêtre de course : deux clics simultanés
-- passent tous les deux la vérification.
-- FOR UPDATE sur le profil sérialise les appels concurrents du même utilisateur.
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
  FROM public.profiles p WHERE p.id = v_user FOR UPDATE;

  IF v_limit IS NULL THEN
    RAISE EXCEPTION 'profile_missing';
  END IF;

  SELECT COALESCE(SUM(u.count), 0)::INT INTO v_used
  FROM public.api_usage u
  WHERE u.user_id = v_user AND u.period_start = v_period;

  IF v_used + p_cost > v_limit THEN
    RETURN QUERY SELECT FALSE, v_used, v_limit;
    RETURN;
  END IF;

  INSERT INTO public.api_usage (user_id, endpoint, count, period_start)
  VALUES (v_user, p_endpoint, p_cost, v_period)
  ON CONFLICT (user_id, endpoint, period_start)
  -- `api_usage.count` et non `public.api_usage.count` : dans ON CONFLICT DO UPDATE,
  -- la ligne existante se référence par le nom de table, pas par un nom qualifié.
  DO UPDATE SET count = api_usage.count + p_cost;

  RETURN QUERY SELECT TRUE, v_used + p_cost, v_limit;
END;
$$;

-- ---------------------------------------------------------------------
-- FONCTION : consommation du mois en cours (affichage)
-- LANGUAGE sql, pas plpgsql : un corps SELECT nu en plpgsql sans BEGIN/END
-- fait échouer CREATE FUNCTION (bug du spec).
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
-- RLS
-- (SELECT auth.uid()) plutôt que auth.uid() : recommandation de performance
-- officielle Supabase (la valeur est évaluée une fois, pas par ligne).
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letters      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage    ENABLE ROW LEVEL SECURITY;

-- Profil : lecture + mise à jour (le trigger neutralise plan_tier et quota).
-- Pas d'INSERT ni de DELETE : le profil naît et meurt avec le compte auth.
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

-- Compteurs : LECTURE SEULE. Aucune policy d'écriture n'est déclarée, donc
-- INSERT/UPDATE/DELETE sont refusés à l'utilisateur. Seule consume_ai_credit()
-- (SECURITY DEFINER) écrit.
CREATE POLICY "api_usage_select_own" ON public.api_usage
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- DROITS D'EXÉCUTION
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.consume_ai_credit(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit(TEXT, INT) TO authenticated;
REVOKE ALL ON FUNCTION public.get_user_monthly_ai_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_monthly_ai_usage() TO authenticated;
```

- [ ] **Step 3 : Documenter et appliquer**

Créer `web/supabase/README.md` expliquant : (a) que ce dossier est la source de vérité du
schéma, (b) qu'aucune modification ne doit être faite à la main dans l'interface Supabase,
(c) la commande d'application.

Appliquer la migration (CLI recommandée ; à défaut, coller le fichier dans le SQL Editor) :

```bash
cd web && npx supabase db push
```

- [ ] **Step 4 : Vérifier l'installation**

Dans le SQL Editor de Supabase, exécuter et lire la sortie :

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;
SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY 1, 2;
SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace ORDER BY 1;
```

Critères de succès **vérifiables** :
- 6 tables, toutes avec `rowsecurity = true` ;
- `api_usage` n'a **qu'une seule** policy, de type `SELECT` ;
- `profiles` a exactement 2 policies (`SELECT`, `UPDATE`), aucune `INSERT`/`DELETE` ;
- les 5 fonctions existent (`touch_updated_at`, `handle_new_user`,
  `guard_profile_privileges`, `consume_ai_credit`, `get_user_monthly_ai_usage`) ;
- l'onglet **Advisors > Security** de Supabase ne remonte aucun avertissement
  `function_search_path_mutable`.

- [ ] **Step 5 : Variables d'environnement**

Créer/mettre à jour `web/.env.example` :

```env
# Supabase — optionnel : sans ces variables, l'app tourne en mode 100 % local.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Clé IA du serveur, réservée aux utilisateurs connectés dans leur quota.
# JAMAIS de préfixe NEXT_PUBLIC_ : elle serait exposée dans le navigateur.
GEMINI_API_KEY=

# Modèle utilisé quand c'est la clé du serveur qui paie (doit être un modèle Gemini).
AI_SERVER_MODEL=gemini-2.5-flash
```

Vérifier que `.env.local` est bien ignoré par git : `git check-ignore web/.env.local`.

- [ ] **Step 6 : Commit Task 0**

```bash
git add web/supabase/ web/package.json web/package-lock.json web/.env.example
git commit -m "feat(db): migration initiale Supabase — schema, RLS restrictives et quotas atomiques"
```

---

### Task 1 : Helpers Supabase SSR et middleware composé

**Fichiers :**
- Créer : `web/src/lib/supabase/env.ts`
- Créer : `web/src/lib/supabase/client.ts`
- Créer : `web/src/lib/supabase/server.ts`
- Créer : `web/src/lib/supabase/middleware.ts`
- Modifier : `web/src/middleware.ts`
- Test : `web/tests/unit/supabaseEnv.test.ts`

**Interfaces :**
- Consomme : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Produit : `getSupabaseEnv()`, `isSupabaseConfigured()`, `createBrowserClientHelper()`,
  `createServerClientHelper()`, `updateSession()`

⚠️ **Point critique** : `web/src/middleware.ts` contient aujourd'hui la protection par mot
de passe du déploiement distant (`REMOTE_AUTH_PASSWORD` / `AUTH_PASSWORD`, redirection vers
`/login`, 401 sur `/api/*`). La version précédente de ce plan la remplaçait purement et
simplement, supprimant la protection **sans aucun message**. Ici on **compose** les deux :
la porte à mot de passe reste en premier, la session Supabase est rafraîchie ensuite.

- [ ] **Step 1 : Test d'échec sur la garde d'environnement**

```typescript
// web/tests/unit/supabaseEnv.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { isSupabaseConfigured, getSupabaseEnv } from '../../src/lib/supabase/env';

describe('Garde d\'environnement Supabase', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it('signale une configuration absente sans lever', () => {
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseEnv()).toBeNull();
  });

  it('renvoie les valeurs quand les deux variables sont présentes', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-test';
    expect(isSupabaseConfigured()).toBe(true);
    expect(getSupabaseEnv()).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key-test',
    });
  });

  it('considère une seule variable comme non configuré', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    expect(isSupabaseConfigured()).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

```bash
cd web && npx vitest run tests/unit/supabaseEnv.test.ts
```
Attendu : ÉCHEC, module `../../src/lib/supabase/env` introuvable.

- [ ] **Step 3 : Implémenter les helpers**

```typescript
// web/src/lib/supabase/env.ts
/**
 * Accès centralisé aux variables Supabase. Elles sont OPTIONNELLES : sans elles,
 * l'application doit tourner en mode 100 % local, comme avant ce chantier.
 * D'où l'absence de `!` non-null — il ferait planter le mode invité.
 */
export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}
```

```typescript
// web/src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './env';

let cachedClient: SupabaseClient | null = null;

/** Renvoie `null` si Supabase n'est pas configuré : l'appelant doit gérer ce cas. */
export function createBrowserClientHelper(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const env = getSupabaseEnv();
  if (!env) return null;
  cachedClient = createBrowserClient(env.url, env.anonKey);
  return cachedClient;
}
```

```typescript
// web/src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabaseEnv } from './env';

/** Renvoie `null` si Supabase n'est pas configuré. */
export async function createServerClientHelper(): Promise<SupabaseClient | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Appelé depuis un Server Component : les cookies y sont en lecture seule.
        }
      },
    },
  });
}
```

```typescript
// web/src/lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnv } from './env';

/**
 * Rafraîchit la session Supabase et propage les cookies mis à jour.
 * No-op si Supabase n'est pas configuré.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  const env = getSupabaseEnv();
  if (!env) return response;

  let supabaseResponse = response;

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();
  return supabaseResponse;
}
```

- [ ] **Step 4 : Composer le middleware sans supprimer la porte existante**

Modifier `web/src/middleware.ts` : **conserver intégralement** la logique
`REMOTE_AUTH_PASSWORD` actuelle, et n'appeler `updateSession` que sur le chemin où la
requête est autorisée à continuer. Structure attendue :

```typescript
// web/src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(req: NextRequest) {
  // --- 1. Porte à mot de passe du déploiement distant (comportement inchangé) ---
  //     Toute la logique existante est conservée telle quelle : liste blanche
  //     (/login, /_next/, /static/, /favicon.ico, /api/login), 401 sur /api/*,
  //     redirection vers /login, suppression du cookie invalide.
  //     ⚠️ Ne pas simplifier : c'est la seule protection du déploiement distant.
  //
  //     Chaque `return NextResponse.next()` de ce bloc devient :
  //         return await updateSession(req, NextResponse.next({ request: req }));
  //     Les `return NextResponse.redirect(...)` et les 401 restent inchangés :
  //     inutile de rafraîchir une session sur une requête qu'on refuse.

  // --- 2. Rafraîchissement de la session Supabase ---
  return await updateSession(req, NextResponse.next({ request: req }));
}

export const config = {
  matcher: [
    // On exclut les assets ET les routes API : `updateSession` y ajouterait un
    // aller-retour réseau vers Supabase sur chaque appel IA (routes lentes).
    // L'authentification des routes API est faite par le guard de la Task 3,
    // qui lit la session directement.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|woff2|pdf)$).*)",
  ],
};
```

⚠️ Le matcher exclut `api` — mais le bloc de mot de passe protégeait `/api/*`. Si
`REMOTE_AUTH_PASSWORD` est défini, **il faut conserver un matcher qui couvre `/api/`** et
faire le no-op Supabase sur ces chemins. Implémenter ainsi : garder `/api` dans le matcher,
et à l'intérieur du middleware, sauter `updateSession` quand
`req.nextUrl.pathname.startsWith('/api/')`.

- [ ] **Step 5 : Vérifier**

```bash
cd web && npx vitest run tests/unit/supabaseEnv.test.ts && npx tsc --noEmit
```
Attendu : tests au vert, aucune erreur de type.

Vérification manuelle **obligatoire** de la non-régression : lancer `npm run dev`
**sans** `.env.local`, ouvrir l'app, créer un CV, exporter un PDF. Rien ne doit casser.

- [ ] **Step 6 : Commit Task 1**

```bash
git add web/src/lib/supabase/ web/src/middleware.ts web/tests/unit/supabaseEnv.test.ts
git commit -m "feat(auth): helpers Supabase SSR avec garde d'environnement et middleware composé"
```

---

### Task 2 : Store d'authentification, callback OAuth et montage

**Fichiers :**
- Créer : `web/src/state/authStore.ts`
- Créer : `web/src/app/auth/callback/route.ts`
- Créer : `web/src/components/auth/AuthProvider.tsx`
- Modifier : `web/src/app/layout.tsx`
- Test : `web/tests/unit/authStore.test.ts`, `web/tests/unit/authRedirect.test.ts`

**Interfaces :**
- Produit : `useAuthStore` (`user`, `isLoading`, `signInWithGoogle()`, `signOut()`,
  `initAuth()`), `safeRedirectPath()`

⚠️ La version précédente créait le store et le callback mais **n'appelait jamais
`initAuth()`** : `isLoading` restait `true` indéfiniment. D'où l'`AuthProvider` monté dans
le layout.

- [ ] **Step 1 : Tests d'échec**

```typescript
// web/tests/unit/authRedirect.test.ts
import { describe, it, expect } from 'vitest';
import { safeRedirectPath } from '../../src/app/auth/callback/route';

describe('safeRedirectPath', () => {
  it('accepte un chemin interne', () => {
    expect(safeRedirectPath('/mes-cv')).toBe('/mes-cv');
  });
  it('refuse une URL absolue', () => {
    expect(safeRedirectPath('https://evil.example')).toBe('/');
  });
  it('refuse un chemin protocol-relative', () => {
    expect(safeRedirectPath('//evil.example')).toBe('/');
  });
  it('retombe sur la racine si absent', () => {
    expect(safeRedirectPath(null)).toBe('/');
  });
});
```

```typescript
// web/tests/unit/authStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../../src/state/authStore';

describe('AuthStore', () => {
  // Le store est un singleton de module : on le remet à l'état initial
  // explicitement, sinon l'ordre des fichiers de test change le résultat.
  beforeEach(() => {
    useAuthStore.setState({ user: null, session: null, isLoading: true });
  });

  it('démarre non authentifié et en chargement', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  it('sort du chargement quand Supabase n\'est pas configuré', async () => {
    await useAuthStore.getState().initAuth();
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

```bash
cd web && npx vitest run tests/unit/authStore.test.ts tests/unit/authRedirect.test.ts
```

- [ ] **Step 3 : Implémenter**

```typescript
// web/src/state/authStore.ts
import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import { createBrowserClientHelper } from '@/lib/supabase/client';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  /** `false` quand les variables Supabase sont absentes : l'UI masque le bouton. */
  isConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  isConfigured: false,

  signInWithGoogle: async () => {
    const supabase = createBrowserClientHelper();
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  },

  signOut: async () => {
    const supabase = createBrowserClientHelper();
    if (supabase) await supabase.auth.signOut();
    // La purge d'IndexedDB est faite par le SyncEngine (Task 5) : ici on ne
    // touche qu'à l'état d'authentification.
    set({ user: null, session: null, isLoading: false });
  },

  initAuth: async () => {
    if (typeof window === 'undefined') return;
    const supabase = createBrowserClientHelper();
    if (!supabase) {
      set({ isLoading: false, isConfigured: false });
      return;
    }
    const { data } = await supabase.auth.getSession();
    set({
      session: data.session,
      user: data.session?.user ?? null,
      isLoading: false,
      isConfigured: true,
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, isLoading: false });
    });
  },
}));
```

```typescript
// web/src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createServerClientHelper } from '@/lib/supabase/server';

/**
 * Un `next` non validé permet de fabriquer un lien qui connecte l'utilisateur
 * puis le propulse ailleurs. On n'accepte qu'un chemin interne.
 */
export function safeRedirectPath(next: string | null): string {
  if (!next) return '/';
  if (!next.startsWith('/')) return '/';
  if (next.startsWith('//')) return '/';
  return next;
}

/** Derrière un proxy (Vercel), `origin` n'est pas l'hôte public. */
function resolveOrigin(request: Request, fallbackOrigin: string): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (!forwardedHost) return fallbackOrigin;
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${forwardedHost}`;
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin: rawOrigin } = new URL(request.url);
  const origin = resolveOrigin(request, rawOrigin);
  const next = safeRedirectPath(searchParams.get('next'));

  // L'utilisateur a refusé l'autorisation côté Google.
  if (searchParams.get('error')) {
    return NextResponse.redirect(`${origin}/?auth_error=denied`);
  }

  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
  }

  const supabase = await createServerClientHelper();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/?auth_error=not_configured`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/?auth_error=callback_failed`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
```

```tsx
// web/src/components/auth/AuthProvider.tsx
'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/state/authStore';

/** Hydrate le store d'authentification au montage. Sans ce composant,
 *  `isLoading` reste `true` et l'UI affiche « Chargement… » indéfiniment. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void useAuthStore.getState().initAuth();
  }, []);
  return <>{children}</>;
}
```

- [ ] **Step 4 : Monter `AuthProvider` dans `web/src/app/layout.tsx`**

Envelopper le contenu du `<body>` — modification chirurgicale, ne pas toucher au reste
du layout.

- [ ] **Step 5 : Vérifier**

```bash
cd web && npx vitest run tests/unit/authStore.test.ts tests/unit/authRedirect.test.ts && npx tsc --noEmit
```

- [ ] **Step 6 : Commit Task 2**

```bash
git add web/src/state/authStore.ts web/src/app/auth/ web/src/components/auth/ web/src/app/layout.tsx web/tests/unit/authStore.test.ts web/tests/unit/authRedirect.test.ts
git commit -m "feat(auth): store Zustand, callback OAuth durci et montage du provider"
```

---

### Task 3 : Application effective des quotas dans les routes IA

> **C'est la tâche qui justifie tout le chantier.** Sans elle, rien ne change :
> aujourd'hui `requireActiveKey` (`web/src/lib/ai/clients.ts:64`) retombe sur
> `process.env.GEMINI_API_KEY` pour **tout** appelant, y compris un visiteur anonyme sans
> compte ni clé — le store Zustand n'étant jamais hydraté côté serveur. La version
> précédente de ce plan créait une fonction d'évaluation que personne n'appelait.

**Fichiers :**
- Créer : `web/src/lib/ai/quota.ts`
- Créer : `web/src/lib/ai/guard.ts`
- Modifier : `web/src/lib/ai/clients.ts` (suppression du fallback env)
- Modifier : les 8 routes IA (`adapt-letter`, `ats-score`, `editor-chat`, `extract-meta`,
  `pdf-to-resume`, `tailor-resume`, `text-to-letter`, `text-to-resume`)
- Test : `web/tests/unit/quota.test.ts`

**Tarif des endpoints** (décision produit — le spec annonçait « 15 adaptations/mois » alors
qu'une adaptation déclenche plusieurs appels ; sans ce tableau l'utilisateur brûle son quota
en trois adaptations et a le sentiment justifié de s'être fait avoir) :

| Endpoint | Coût | Justification |
|---|---|---|
| `tailor-resume` | 1 | Le travail principal |
| `adapt-letter` | 1 | Le travail principal |
| `text-to-resume` | 1 | Création complète |
| `text-to-letter` | 1 | Création complète |
| `pdf-to-resume` | 1 | Création complète |
| `editor-chat` | 1 | Appel explicite de l'utilisateur |
| `ats-score` | **0** | Accompagne une adaptation déjà facturée |
| `extract-meta` | **0** | Utilitaire, coût dérisoire |

Coût 0 = pas d'appel à `consume_ai_credit`, mais l'authentification (ou la clé perso) reste
exigée.

- [ ] **Step 1 : Tests d'échec sur les règles**

```typescript
// web/tests/unit/quota.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateQuotaRules, ENDPOINT_COST } from '../../src/lib/ai/quota';

describe('Règles de quota', () => {
  it('une clé personnelle court-circuite le quota serveur', () => {
    const r = evaluateQuotaRules({ hasCustomKey: true, isAuthenticated: false });
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('custom_key');
  });

  it('un invité sans clé est refusé en 401', () => {
    const r = evaluateQuotaRules({ hasCustomKey: false, isAuthenticated: false });
    expect(r.allowed).toBe(false);
    expect(r.status).toBe(401);
  });

  it('un utilisateur connecté sans clé passe par le quota serveur', () => {
    const r = evaluateQuotaRules({ hasCustomKey: false, isAuthenticated: true });
    expect(r.allowed).toBe(true);
    expect(r.reason).toBe('server_quota');
  });

  it('tarifie ats-score et extract-meta à zéro', () => {
    expect(ENDPOINT_COST['ats-score']).toBe(0);
    expect(ENDPOINT_COST['extract-meta']).toBe(0);
    expect(ENDPOINT_COST['tailor-resume']).toBe(1);
  });
});
```

Note : le dépassement de quota (429) n'est plus décidé ici. La décision est prise
**atomiquement par PostgreSQL** dans `consume_ai_credit` — un `check` en JS suivi d'un
`increment` séparé laisserait deux clics simultanés passer tous les deux.

- [ ] **Step 2 : Lancer, vérifier l'échec**

```bash
cd web && npx vitest run tests/unit/quota.test.ts
```

- [ ] **Step 3 : Implémenter `quota.ts` et `guard.ts`**

```typescript
// web/src/lib/ai/quota.ts
export type BillableEndpoint =
  | 'tailor-resume' | 'adapt-letter' | 'text-to-resume' | 'text-to-letter'
  | 'pdf-to-resume' | 'editor-chat' | 'ats-score' | 'extract-meta';

/** Coût en crédits. 0 = gratuit mais toujours soumis à authentification. */
export const ENDPOINT_COST: Record<BillableEndpoint, number> = {
  'tailor-resume': 1,
  'adapt-letter': 1,
  'text-to-resume': 1,
  'text-to-letter': 1,
  'pdf-to-resume': 1,
  'editor-chat': 1,
  'ats-score': 0,
  'extract-meta': 0,
};

export interface QuotaCheckParams {
  hasCustomKey: boolean;
  isAuthenticated: boolean;
}

export interface QuotaResult {
  allowed: boolean;
  reason?: 'custom_key' | 'server_quota';
  status?: number;
  message?: string;
}

export function evaluateQuotaRules(params: QuotaCheckParams): QuotaResult {
  if (params.hasCustomKey) return { allowed: true, reason: 'custom_key' };
  if (!params.isAuthenticated) {
    return {
      allowed: false,
      status: 401,
      message:
        'Connectez-vous avec Google, ou ajoutez votre propre clé API dans les Paramètres.',
    };
  }
  return { allowed: true, reason: 'server_quota' };
}
```

```typescript
// web/src/lib/ai/guard.ts
import { NextResponse } from 'next/server';
import { readAiHeaders } from './http';
import { createServerClientHelper } from '@/lib/supabase/server';
import { evaluateQuotaRules, ENDPOINT_COST, type BillableEndpoint } from './quota';

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
  return { key: serverKey, model: process.env.AI_SERVER_MODEL ?? 'gemini-2.5-flash' };
}
```

- [ ] **Step 4 : Couper le fallback d'environnement dans `clients.ts`**

Dans `web/src/lib/ai/clients.ts`, fonction `requireActiveKey` : remplacer

```typescript
const key = geminiKey || process.env.GEMINI_API_KEY || "";
```

par

```typescript
// Plus de repli sur la clé du serveur ici : c'est `guardAiRequest` qui décide
// qui a le droit de l'utiliser, et qui la fournit en `overrideKey`. Sans cette
// coupure, tout visiteur anonyme consommerait la clé de l'application.
const key = geminiKey || "";
```

Modification **chirurgicale** : ne rien changer d'autre dans ce fichier.

- [ ] **Step 5 : Brancher les 8 routes**

Dans chacune, remplacer :

```typescript
const { key: userKey, model: userModel } = readAiHeaders(req);
```

par :

```typescript
const grant = await guardAiRequest(req, "tailor-resume"); // ← nom de l'endpoint
if (grant instanceof Response) return grant;
const { key: userKey, model: userModel } = grant;
```

Placer l'appel **au même endroit** que l'ancien `readAiHeaders` (après la validation du
corps de requête) : inutile de débiter un crédit pour une requête malformée.

- [ ] **Step 6 : Vérifier**

```bash
cd web && npx vitest run tests/unit/quota.test.ts && npx tsc --noEmit
```

Vérification manuelle **obligatoire** (c'est le cœur du chantier) :
1. Sans `.env.local`, sans clé perso → un appel IA doit renvoyer **401**, pas un résultat.
2. Avec une clé perso dans les Paramètres → l'appel passe.
3. Connecté avec Supabase configuré → l'appel passe, et
   `SELECT * FROM api_usage` montre une ligne à `count = 1`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/tailor-resume \
  -H "Content-Type: application/json" \
  -d '{"resume":{},"job_desc":"test"}'
```
Attendu : `401`.

- [ ] **Step 7 : Commit Task 3**

```bash
git add web/src/lib/ai/ web/src/app/api/ web/tests/unit/quota.test.ts
git commit -m "feat(ai): application effective des quotas serveur et fin du repli sur la cle integree"
```

---

### Task 4 : Dexie v13 — horodatages de synchro et soft deletes

**Fichiers :**
- Modifier : `web/src/lib/storage/db.ts`
- Créer : `web/src/lib/storage/syncFields.ts`
- Test : `web/tests/unit/syncFields.test.ts`

⚠️ **Le format de dates du plan précédent ne correspondait à aucune table réelle** :
- `HistoryEntry` n'a **pas** de `updated_at` — seulement `created_at`, une chaîne ISO ;
- `Application` et `JobEntry` utilisent `createdAt`/`updatedAt` en **`number`** (ms).

D'où une couche d'adaptation explicite plutôt qu'une interface `SyncableItem` universelle
qui ne compilerait pas.

- [ ] **Step 1 : Test d'échec**

```typescript
// web/tests/unit/syncFields.test.ts
import { describe, it, expect } from 'vitest';
import { toIso, pendingPush, markDeleted } from '../../src/lib/storage/syncFields';

describe('Champs de synchronisation', () => {
  it('normalise un timestamp numérique en ISO', () => {
    expect(toIso(1754784000000)).toBe(new Date(1754784000000).toISOString());
  });
  it('laisse une chaîne ISO inchangée', () => {
    expect(toIso('2026-08-10T00:00:00.000Z')).toBe('2026-08-10T00:00:00.000Z');
  });
  it('retient les éléments jamais synchronisés', () => {
    const items = [
      { id: '1', updated_at: '2026-08-10T00:00:00Z', synced_at: null },
      { id: '2', updated_at: '2026-08-10T00:00:00Z', synced_at: '2026-08-10T01:00:00Z' },
      { id: '3', updated_at: '2026-08-10T02:00:00Z', synced_at: '2026-08-10T01:00:00Z' },
    ];
    expect(pendingPush(items).map((i) => i.id)).toEqual(['1', '3']);
  });
  it('marque une suppression sans effacer la ligne', () => {
    const marked = markDeleted({ id: '1', updated_at: '2026-01-01T00:00:00Z', synced_at: 'x' });
    expect(marked.deleted_at).not.toBeNull();
    expect(marked.synced_at).toBeNull();
    expect(marked.id).toBe('1');
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

```bash
cd web && npx vitest run tests/unit/syncFields.test.ts
```

- [ ] **Step 3 : Implémenter `syncFields.ts` et la migration v13**

```typescript
// web/src/lib/storage/syncFields.ts
/** Champs de synchronisation ajoutés à toutes les entités répliquées. */
export interface SyncMeta {
  /** Horloge du client, ISO. Arbitre les conflits (last-write-wins). */
  updated_at: string;
  /** Dernière réplication réussie. `null` = jamais envoyé. */
  synced_at?: string | null;
  /** Suppression douce : la ligne survit pour que la suppression se propage. */
  deleted_at?: string | null;
}

/** Les tables du projet mélangent timestamps numériques et chaînes ISO. */
export function toIso(value: string | number): string {
  return typeof value === 'number' ? new Date(value).toISOString() : value;
}

export function pendingPush<T extends SyncMeta & { id: string }>(items: T[]): T[] {
  return items.filter((i) =>
    !i.synced_at || new Date(i.updated_at).getTime() > new Date(i.synced_at).getTime(),
  );
}

export function touch<T extends SyncMeta>(item: T): T {
  return { ...item, updated_at: new Date().toISOString(), synced_at: null };
}

export function markDeleted<T extends SyncMeta>(item: T): T {
  const now = new Date().toISOString();
  return { ...item, deleted_at: now, updated_at: now, synced_at: null };
}
```

Dans `web/src/lib/storage/db.ts`, ajouter la v13 **à la suite** de la v12 (ne jamais
modifier une version existante — elle a déjà tourné chez les utilisateurs) :

```typescript
// v13 : champs de synchronisation Supabase. `updated_at` (ISO) est ajouté aux
// entrées d'historique, qui n'avaient que `created_at`. Les tables applications
// et jobs gardent leurs timestamps numériques ; la conversion se fait à la volée
// dans le SyncEngine (cf. syncFields.toIso).
this.version(13).stores({
  history:      "id, created_at, updated_at, company, role, doc_type, synced_at, deleted_at",
  applications: "id, normKey, createdAt, updatedAt, synced_at, deleted_at",
  jobs:         "id, score, status, createdAt, updatedAt, synced_at, deleted_at",
}).upgrade(async (tx) => {
  // Sans updated_at, chaque entrée existante paraîtrait « jamais modifiée ».
  await tx.table("history").toCollection().modify((h) => {
    if (!h.updated_at) h.updated_at = h.created_at;
    h.synced_at = null;
  });
  await tx.table("applications").toCollection().modify((a) => {
    if (!a.updatedAt) a.updatedAt = a.createdAt ?? Date.now();
    a.synced_at = null;
  });
  await tx.table("jobs").toCollection().modify((j) => {
    if (!j.updatedAt) j.updatedAt = j.createdAt ?? Date.now();
    j.synced_at = null;
  });
});
```

Ajouter les champs correspondants aux interfaces `HistoryEntry`, `Application` et
`JobEntry` (en optionnel, pour ne pas casser le code existant).

- [ ] **Step 4 : Convertir les suppressions dures en suppressions douces**

`deleteHistoryEntry` (`db.ts:329`) et `deleteApplicationRecord` (`db.ts:628`) font
aujourd'hui un `.delete()` réel. Une suppression réelle ne laisse **aucune trace à
synchroniser** : l'autre appareil ne voit qu'une absence, l'interprète comme « jamais
envoyé » et **renvoie le document**. Les CV supprimés ressuscitent.

Remplacer le `.delete()` par un `.put()` de l'élément marqué via `markDeleted()`, et
ajouter un filtre `deleted_at == null` dans **toutes** les fonctions de lecture de ces
tables (`listHistory`, `listApplications`, `listHistoryByApplication`, comptages, etc.).

⚠️ Passer en revue chaque lecteur : un filtre oublié fait réapparaître des documents
supprimés dans l'interface. Vérifier avec :

```bash
cd web && grep -rn "db.history\.\|db.applications\.\|db.jobs\." src/ | grep -v "syncEngine"
```

- [ ] **Step 5 : Vérifier**

```bash
cd web && npx vitest run tests/unit/syncFields.test.ts && npx tsc --noEmit && npm test
```

Vérification manuelle : ouvrir l'app avec des données existantes (migration v12 → v13),
supprimer un CV, recharger la page. Il ne doit pas réapparaître, et
`db.history.count()` dans la console doit être inchangé (la ligne survit, masquée).

- [ ] **Step 6 : Commit Task 4**

```bash
git add web/src/lib/storage/db.ts web/src/lib/storage/syncFields.ts web/tests/unit/syncFields.test.ts
git commit -m "feat(sync): migration Dexie v13, horodatages de synchro et suppressions douces"
```

---

### Task 5 : SyncEngine bidirectionnel et sanitization d'import

**Fichiers :**
- Créer : `web/src/lib/storage/syncEngine.ts`
- Créer : `web/src/lib/storage/syncMapping.ts`
- Modifier : `web/src/lib/storage/backup.ts`
- Test : `web/tests/unit/syncEngine.test.ts`

⚠️ Le plan précédent n'implémentait que le **push**. Sans **pull**, il n'y a pas de
multi-appareil : on se connecte sur un second appareil et l'écran reste vide, alors que le
spec le promet explicitement.

**Décisions actées :**

1. **Résolution de conflit : last-write-wins sur `client_updated_at`.** Simple, suffisant
   pour un usage mono-utilisateur multi-appareils. À écrire dans `LIMITES.md` : une
   modification concurrente hors-ligne sur deux appareils est perdue silencieusement.
2. **Curseur de pull : `updated_at` serveur**, stocké dans `localStorage` par table.
   L'horloge du serveur est la seule commune aux deux appareils.
3. **Purge locale à la déconnexion et au changement de compte.** Sans elle : A se
   déconnecte, B se connecte sur le même navigateur, voit les CV de A, et la synchro les
   **réplique sur le compte de B**. Fuite de données réelle. On stocke le `user_id`
   propriétaire du contenu local ; s'il diffère de l'utilisateur qui se connecte, on purge.
4. **`importDatabase` fait aujourd'hui `clear()` puis `bulkAdd()`** — un import écrase tout.
   Après import, **la totalité** du contenu local est donc « nouvelle » : on remet
   `synced_at = null` et `updated_at = maintenant` sur chaque élément, sinon le contenu
   importé n'est jamais envoyé et le contenu remplacé n'est jamais supprimé côté serveur.
   Le `user_id` n'est **pas** stocké dans Dexie (il est ajouté au moment du push, à partir
   de la session) — contrairement à ce qu'annonçait le spec §3.2, qui décrivait un champ
   inexistant.

- [ ] **Step 1 : Tests d'échec**

```typescript
// web/tests/unit/syncEngine.test.ts
import { describe, it, expect } from 'vitest';
import { resolveConflict, sanitizeImportedItem } from '../../src/lib/storage/syncEngine';

describe('SyncEngine', () => {
  it('garde la version la plus récente en cas de conflit', () => {
    const local = { id: '1', updated_at: '2026-08-10T02:00:00Z' };
    const remote = { id: '1', client_updated_at: '2026-08-10T01:00:00Z' };
    expect(resolveConflict(local, remote)).toBe('local');
  });

  it('garde la version distante si elle est plus récente', () => {
    const local = { id: '1', updated_at: '2026-08-10T01:00:00Z' };
    const remote = { id: '1', client_updated_at: '2026-08-10T03:00:00Z' };
    expect(resolveConflict(local, remote)).toBe('remote');
  });

  it('remet synced_at à null et rafraîchit updated_at à l\'import', () => {
    const raw = { id: 'old', synced_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
    const s = sanitizeImportedItem(raw);
    expect(s.synced_at).toBeNull();
    expect(new Date(s.updated_at).getTime()).toBeGreaterThan(new Date('2026-01-01').getTime());
  });

  it('préserve deleted_at à l\'import (une suppression importée reste une suppression)', () => {
    const raw = { id: 'x', updated_at: '2026-01-01T00:00:00Z', deleted_at: '2026-01-02T00:00:00Z' };
    expect(sanitizeImportedItem(raw).deleted_at).toBe('2026-01-02T00:00:00Z');
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

```bash
cd web && npx vitest run tests/unit/syncEngine.test.ts
```

- [ ] **Step 3 : Implémenter le mapping et le moteur**

`syncMapping.ts` — conversions explicites dans les deux sens, table par table :
- `history` où `doc_type === "CV"` ↔ `resumes`
- `history` où `doc_type === "Lettre"` ↔ `letters`
- `applications` ↔ `applications` (timestamps `number` → ISO via `toIso`)
- `jobs` ↔ `saved_jobs`

`syncEngine.ts` — surface publique :
- `resolveConflict(local, remote): 'local' | 'remote'`
- `sanitizeImportedItem(item)`
- `pushAll()` : envoie les éléments de `pendingPush()` en `upsert`, puis pose `synced_at`
- `pullAll()` : lit `updated_at > curseur`, applique `resolveConflict`, avance le curseur
- `syncAll()` : `pushAll()` puis `pullAll()`
- `purgeLocalData()` : appelée à la déconnexion et au changement de compte

Contraintes d'implémentation :
- ne rien faire si `createBrowserClientHelper()` renvoie `null` ou si aucune session ;
- ne jamais lancer deux synchros en parallèle (verrou en mémoire) ;
- en cas d'échec réseau, ne pas poser `synced_at` (l'élément repassera au tour suivant) ;
- les erreurs sont journalisées, jamais remontées en exception à l'UI.

- [ ] **Step 4 : Sanitizer l'import dans `backup.ts`**

Dans `importDatabase`, après le `bulkAdd`, appliquer `sanitizeImportedItem` à tous les
éléments des tables synchronisées (`history`, `jobs`, `applications`). Adapter le texte du
`uiConfirm` : il annonce un remplacement local, il doit maintenant préciser que le contenu
sera aussi **répliqué vers le compte connecté**.

Dans `exportDatabase`, retirer `synced_at` des objets exportés : un fichier de sauvegarde
ne doit pas transporter l'état de synchro d'un autre appareil.

- [ ] **Step 5 : Brancher la purge sur `signOut`**

Dans `authStore.signOut()`, appeler `purgeLocalData()` avant de vider l'état. Dans
`initAuth()`, comparer l'utilisateur qui se connecte au propriétaire enregistré du contenu
local et purger s'il diffère.

- [ ] **Step 6 : Vérifier**

```bash
cd web && npx vitest run tests/unit/syncEngine.test.ts && npx tsc --noEmit && npm test
```

Vérification manuelle **obligatoire** :
1. Se connecter, créer un CV, vérifier sa présence dans `resumes` côté Supabase.
2. Ouvrir une fenêtre de navigation privée, se connecter au même compte → le CV apparaît.
3. Le supprimer dans la fenêtre A, rafraîchir B → il disparaît (et ne revient pas).
4. Se déconnecter → IndexedDB est vide.

- [ ] **Step 7 : Commit Task 5**

```bash
git add web/src/lib/storage/ web/tests/unit/syncEngine.test.ts web/src/state/authStore.ts
git commit -m "feat(sync): moteur bidirectionnel, purge au changement de compte et import sanitise"
```

---

### Task 6 : Intégration UI — connexion et compteur de quota

**Fichiers :**
- Modifier : `web/src/components/layout/UserMenu.tsx`
- Créer : `web/src/components/auth/QuotaBadge.tsx`
- Test : `web/tests/unit/UserMenuAuth.test.tsx`

⚠️ **Ne pas créer `web/src/components/auth/UserMenu.tsx`.** Un `UserMenu` existe déjà
(`web/src/components/layout/UserMenu.tsx`), déjà monté dans `TopBar.tsx:166`, et c'est déjà
le menu utilisateur (thème, paramètres, profil). En créer un second au même nom garantit la
confusion. On **enrichit** l'existant.

Contraintes de style : réutiliser les classes existantes (`user-menu-dropdown`,
`btn-avatar`), aucune couleur en dur, et le bouton de connexion doit être **masqué** quand
`isConfigured === false` (mode local sans Supabase) — sinon un clic mène à une impasse.

- [ ] **Step 1 : Test d'échec**

```tsx
// web/tests/unit/UserMenuAuth.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import UserMenu from '../../src/components/layout/UserMenu';
import { useAuthStore } from '../../src/state/authStore';

describe('UserMenu — authentification', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, session: null, isLoading: false, isConfigured: true });
  });

  it('propose la connexion Google quand personne n\'est connecté', () => {
    render(<UserMenu onToggleTheme={() => {}} />);
    screen.getByLabelText(/menu utilisateur/i).click();
    expect(screen.getByText(/se connecter avec google/i)).toBeInTheDocument();
  });

  it('masque l\'entrée de connexion si Supabase n\'est pas configuré', () => {
    useAuthStore.setState({ isConfigured: false });
    render(<UserMenu onToggleTheme={() => {}} />);
    screen.getByLabelText(/menu utilisateur/i).click();
    expect(screen.queryByText(/se connecter avec google/i)).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

```bash
cd web && npx vitest run tests/unit/UserMenuAuth.test.tsx
```

- [ ] **Step 3 : Enrichir `UserMenu` et créer `QuotaBadge`**

Ajouter au menu déroulant existant, au-dessus des entrées actuelles :
- déconnecté + configuré → « Se connecter avec Google » ;
- connecté → avatar + nom + `<QuotaBadge />` + « Déconnexion ».

`QuotaBadge` appelle la RPC `get_user_monthly_ai_usage` et lit `monthly_quota_limit` dans
`profiles`, puis affiche « 4 / 15 crédits ce mois-ci ». En cas d'erreur, il n'affiche rien
plutôt qu'un message d'erreur (information secondaire).

- [ ] **Step 4 : Message de quota dépassé**

Vérifier que les appels IA renvoyant 429 affichent le message du serveur (« Quota mensuel
gratuit atteint… ») et non un message générique. Vérifier le chemin d'affichage des erreurs
depuis `web/src/lib/ai/client.ts`.

- [ ] **Step 5 : Vérifier**

```bash
cd web && npx vitest run tests/unit/UserMenuAuth.test.tsx && npx tsc --noEmit && npm run lint
```

- [ ] **Step 6 : Commit Task 6**

```bash
git add web/src/components/ web/tests/unit/UserMenuAuth.test.tsx
git commit -m "feat(ui): connexion Google et compteur de quota dans le menu utilisateur"
```

---

### Task 7 : Vérification d'étanchéité et documentation

**Fichiers :**
- Créer : `web/tests/manual/VERIF_BOUT_EN_BOUT.md`
- Modifier : `LIMITES.md`, `PROJECT_INDEX.md`, `WORK_HISTORY.md`

⚠️ Les tests des tâches 1 à 6 sont des tests unitaires de fonctions pures. **Ils ne
prouvent rien sur le comportement bout-en-bout.** La couche base de données, elle, est déjà
couverte automatiquement depuis la Task 0.

- [ ] **Step 1 : Rejouer les tests de base de données**

```bash
cd web/supabase && docker run --rm -e POSTGRES_PASSWORD=x -v "$PWD:/sql" postgres:15 sh -c "docker-entrypoint.sh postgres > /tmp/pg.log 2>&1 & sleep 12 && psql -U postgres -q -v ON_ERROR_STOP=1 -f /sql/_auth_stub.sql -f /sql/migrations/0001_auth_quotas.sql > /dev/null && psql -U postgres -v ON_ERROR_STOP=1 -f /sql/tests/rls_etancheite.sql"
```

Attendu : `TOUS_LES_TESTS_OK`. Couvre l'étanchéité RLS, l'infalsifiabilité du compteur, la
non-escalade de plan et l'application du quota au 16ᵉ appel.

Si une migration a été ajoutée depuis, l'inclure dans la commande **et** compléter
`tests/rls_etancheite.sql` pour couvrir ses nouvelles tables.

- [ ] **Step 2 : Vérifications bout-en-bout restantes**

Écrire `web/tests/manual/VERIF_BOUT_EN_BOUT.md` et y consigner les sorties réelles. Ces
points dépendent de la couche applicative et ne sont couverts par aucun test automatisé :

1. **Mode local intact** : sans `.env.local`, créer un CV et exporter un PDF. Rien ne casse.
2. **Refus de l'invité** : appel IA sans compte ni clé → **401**.
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/tailor-resume \
     -H "Content-Type: application/json" -d '{"resume":{},"job_desc":"test"}'
   ```
3. **BYOK** : avec une clé perso dans les Paramètres, l'appel passe et `api_usage` reste
   inchangé.
4. **Quota applicatif** : connecté, consommer 15 crédits → **429** au 16ᵉ, avec le message
   du serveur affiché dans l'interface (pas un message générique) → ajouter une clé perso
   débloque immédiatement.
5. **Flux OAuth** : connexion Google complète, retour sur le callback, session persistée
   après rechargement.
6. **Multi-appareils** : création sur A visible sur B ; suppression sur A propagée sur B et
   **non réapparue** après rechargement.
7. **Déconnexion** : IndexedDB vidé ; reconnexion avec un autre compte ne montre rien du
   précédent.

Une case non vérifiée est un échec de tâche.

- [ ] **Step 3 : Mettre à jour la documentation du projet**

- `LIMITES.md` : retirer la contrainte n°1 (mono-utilisateur, local uniquement) ; **ajouter**
  les limites nouvelles : conflit hors-ligne multi-appareils perdu en silence (LWW), photos
  encore stockées en base64 dans le JSONB, aucune suppression de compte ni export RGPD,
  tables `profile`/`templates`/`jobProfile` non synchronisées.
- `PROJECT_INDEX.md` : ajouter le schéma Supabase, les nouvelles routes, le SyncEngine,
  et le tableau des coûts par endpoint.
- `WORK_HISTORY.md` : entrée datée avec les décisions actées (divergences avec le spec).

- [ ] **Step 4 : Suite de vérification complète**

```bash
cd web && npx tsc --noEmit && npm run lint && npm test && npm run build
```

Les quatre doivent passer. Lire réellement chaque sortie — `npm test` compte aujourd'hui
691 tests sur 85 fichiers, une régression se voit au décompte.

- [ ] **Step 5 : Commit Task 7**

```bash
git add web/tests/manual/ LIMITES.md PROJECT_INDEX.md WORK_HISTORY.md
git commit -m "docs(auth): procedure d'etancheite RLS et mise a jour des limites connues"
```

---

## Hors périmètre — à traiter dans un chantier ultérieur

Signalé ici pour que l'absence soit un choix, pas un oubli :

1. **Photos en Supabase Storage.** Elles restent en base64 dans `content` JSONB. À 100
   utilisateurs × 5 CV avec photo, on approche des 500 Mo du tier gratuit, et chaque pull
   les retélécharge. **C'est une décision de schéma** : la changer plus tard imposera de
   migrer les données de tous les utilisateurs.
2. **RGPD.** Suppression de compte (le `ON DELETE CASCADE` est prêt, le bouton n'existe
   pas), export des données, politique de confidentialité, base légale. Beaucoup moins cher
   maintenant qu'avec des utilisateurs réels.
3. **Synchronisation de `profile`, `templates`, `jobProfile`.** Seules 4 des 11 tables Dexie
   sont répliquées. Or « Mes informations » est probablement ce qu'un utilisateur s'attend
   le plus à retrouver sur un second appareil.
4. **Facturation.** `plan_tier` existe mais aucun paiement n'est branché ; seul le
   `service_role` peut promouvoir un compte, donc manuellement pour l'instant.
5. **Réinitialisation du quota au mois calendaire.** Qui s'inscrit le 28 a 15 crédits puis
   un reset 3 jours plus tard. Alternative : reset 30 jours après l'inscription.
