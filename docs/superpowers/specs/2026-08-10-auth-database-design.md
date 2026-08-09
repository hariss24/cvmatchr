# Spécification Technique : Base de Données, Comptes Utilisateurs & Google Auth (Supabase)

> **Date** : 10 Août 2026  
> **Statut** : Approuvé  
> **Contexte** : Levée de la contrainte majeure n°1 de `LIMITES.md` (mono-utilisateur, données uniquement en local dans IndexedDB, compteurs contournables, clés exposées).

---

## 1. Objectifs & Vue d'ensemble

L'objectif de ce projet est d'ajouter un système complet d'authentification utilisateur via Google OAuth et une base de données PostgreSQL gérée par Supabase (sur le tier gratuit sans limite de temps), tout en conservant l'expérience réactive instantanée "Offline-First" offerte par IndexedDB (Dexie).

### Fonctionnalités principales
1. **Google Auth & Gestion de compte** : Connexion en 1 clic avec Google, session sécurisée via cookies HTTP-only (`@supabase/ssr`).
2. **Synchronisation Hybride (Cloud + Local)** : Dexie (IndexedDB) reste le cache local réactif à 0 ms. Les modifications (CV, Lettres, Candidatures, Offres) sont poussées en arrière-plan vers Supabase PostgreSQL.
3. **Sécurité PostgreSQL (RLS)** : Activation du Row Level Security sur toutes les tables pour garantir qu'un utilisateur n'accède qu'à ses propres données (`auth.uid() = user_id`).
4. **Compteur API Serveur anti-triche** : Suivi des quotas d'appels IA sur Supabase côté serveur pour empêcher la réinitialisation des quotas par vidage du cache local.

---

## 2. Schéma de la Base de Données PostgreSQL (Supabase)

Toutes les tables sont créées dans le schéma public et liées à `auth.users(id)`.

```sql
-- 1. PROFILS UTILISATEURS
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  ai_provider TEXT DEFAULT 'gemini',
  custom_ai_key TEXT, -- Chiffrée ou stockée sur le serveur
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CV
CREATE TABLE public.resumes (
  id TEXT PRIMARY KEY, -- Id UUID ou string généré par Dexie
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content JSONB NOT NULL, -- Structure JSON du CV (schema zod)
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. LETTRES DE MOTIVATION
CREATE TABLE public.letters (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT,
  job_title TEXT,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CANDIDATURES
CREATE TABLE public.applications (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  job_title TEXT NOT NULL,
  url TEXT,
  status TEXT DEFAULT 'draft',
  notes TEXT,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. OFFRES SAUVEGARDÉES (MARCHÉ CACHÉ & OFFRES)
CREATE TABLE public.saved_jobs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. COMPTEURS QUOTAS API (SERVEUR)
CREATE TABLE public.api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  count INT DEFAULT 1,
  period_start TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEX DE PERFORMANCE
CREATE INDEX idx_resumes_user ON public.resumes(user_id);
CREATE INDEX idx_letters_user ON public.letters(user_id);
CREATE INDEX idx_applications_user ON public.applications(user_id);
CREATE INDEX idx_saved_jobs_user ON public.saved_jobs(user_id);
CREATE INDEX idx_api_usage_user_period ON public.api_usage(user_id, period_start);
```

### Directives RLS (Row Level Security)

Pour chaque table (`profiles`, `resumes`, `letters`, `applications`, `saved_jobs`, `api_usage`), RLS est activé avec la règle stricte :
```sql
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only read/write their own resumes"
ON public.resumes FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

---

## 3. Architecture d'Authentification Next.js 16

### Stack & Packages
- `@supabase/ssr` (gestion de session SSR et cookies Next.js App Router)
- `@supabase/supabase-js`

### Fichiers clés à créer dans `web/`
1. `src/lib/supabase/client.ts` : Client Supabase pour les composants React (`createBrowserClient`).
2. `src/lib/supabase/server.ts` : Client Supabase pour Server Components & API routes (`createServerClient`).
3. `src/middleware.ts` : Mise à jour de session via cookie à chaque requête.
4. `src/app/auth/callback/route.ts` : Traitement de la réponse OAuth Google (échange code -> jetons).
5. `src/state/authStore.ts` : Store Zustand d'état d'authentification (`user`, `session`, `signInWithGoogle()`, `signOut()`).

---

## 4. Moteur de Synchronisation Hybride (`SyncEngine`)

### Fonctionnement
1. **Écriture locale instantanée** : L'utilisateur crée ou modifie un CV. L'action met à jour Dexie (`db.ts`) immédiatement avec `synced_at = null` ou `updated_at = NOW()`.
2. **Synchronisation asynchrone** : Le service `SyncEngine` s'exécute en arrière-plan (quand `user` est connecté et `navigator.onLine == true`) :
   - **Push** : Envoie les enregistrements où `synced_at < updated_at` vers Supabase via `upsert`.
   - **Pull** : Récupère les nouveautés de Supabase plus récentes que le dernier timestamp de sync local, et met à jour Dexie.
3. **Résolution des conflits** : Stratégie *Last-Write-Wins* basée sur la date ISO `updated_at`.

---

## 5. Variables d'Environnement Nouveaux (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJKV1Qi...
```

---

## 6. Plan de Test & Vérification
1. **Tests unitaires (Vitest)** : Tester le `SyncEngine` avec des mocks IndexedDB et Supabase.
2. **Tests d'intégration Auth** : Vérifier que le middleware rafraîchit la session sans planter.
3. **Tests d'étanchéité RLS** : S'assurer via des requêtes de test qu'un utilisateur A ne peut pas lire le CV d'un utilisateur B.
