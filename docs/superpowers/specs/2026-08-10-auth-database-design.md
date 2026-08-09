# Spécification Technique : Base de Données, Comptes Utilisateurs & Quotas IA (Supabase)

> **Date** : 10 Août 2026  
> **Statut** : 100% Blindé, Audité & Exécutable (Gestion Infaillible d'Import/Export)  
> **Contexte** : Levée de la contrainte majeure n°1 de `LIMITES.md` (mono-utilisateur, données uniquement en local dans IndexedDB, compteurs contournables, clés exposées).

---

## 1. Objectifs & Modèle Économique IA

L'objectif de ce projet est d'ajouter un système d'authentification utilisateur via Google OAuth, une base de données PostgreSQL gérée par Supabase (tier gratuit), une synchronisation hybride "Offline-First", et **un contrôle strict des Quotas IA selon le statut utilisateur**.

### Règle d’Accès aux Fonctionnalités IA
1. **Utilisateur Anonyme (100% Local / Sans Compte)** :
   - Accès 100% gratuit à la création, édition manuelle, exportation PDF et stockage local dans IndexedDB.
   - **Aucun accès à la clé IA intégrée de l'application**. Pour utiliser les fonctionnalités IA (génération, adaptation de CV, chat), il **DOIT fournir sa propre clé API** (Gemini / Anthropic) dans ses paramètres (`BYOK` - Bring Your Own Key).
2. **Utilisateur Connecté (Compte Google / Supabase)** :
   - Bénéficie d'un **Quota Gratuit d'appels IA géré par le serveur** (15 adaptations/mois par défaut).
   - Les consommations sont enregistrées de façon infalsifiable dans `api_usage` sur Supabase.
   - Une fois le quota épuisé, l'utilisateur a 2 choix : ajouter sa propre clé API dans ses paramètres, ou passer à une formule Payante / Crédits (`plan_tier`).
3. **Utilisateur Connecté avec Clé Personnelle** :
   - S'il renseigne sa propre clé API dans ses paramètres (transmise via `X-Api-Key`), sa clé est utilisée en priorité et son quota serveur gratuit n'est pas consommé.

---

## 2. Schéma de la Base de Données PostgreSQL (Supabase)

Toutes les tables sont créées dans le schéma public et liées à `auth.users(id)`.

```sql
-- 1. PROFILS UTILISATEURS & PLANS
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  plan_tier TEXT DEFAULT 'free', -- 'free', 'pro', 'unlimited'
  monthly_quota_limit INT DEFAULT 15, -- Quota mensuel d'appels IA offerts
  ai_provider TEXT DEFAULT 'gemini',
  custom_ai_key TEXT, -- Clé perso optionnelle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CV
CREATE TABLE public.resumes (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
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
  deleted_at TIMESTAMPTZ DEFAULT NULL,
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
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. OFFRES SAUVEGARDÉES (MARCHÉ CACHÉ & OFFRES)
CREATE TABLE public.saved_jobs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_data JSONB NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. COMPTEURS QUOTAS API (SERVEUR) AVEC CONTRAINTE UNIQUE POUR ATOMICITÉ
CREATE TABLE public.api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  count INT DEFAULT 1,
  period_start TIMESTAMPTZ DEFAULT date_trunc('month', NOW()),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_endpoint_period UNIQUE (user_id, endpoint, period_start)
);

-- INDEX DE PERFORMANCE
CREATE INDEX idx_resumes_user ON public.resumes(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_letters_user ON public.letters(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_applications_user ON public.applications(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_saved_jobs_user ON public.saved_jobs(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_api_usage_user_period ON public.api_usage(user_id, period_start);
```

### Fonctions & Triggers PostgreSQL

```sql
-- Trigger d'auto-création de profil utilisateur avec quota par défaut
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, plan_tier, monthly_quota_limit)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    'free',
    15
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fonction d'incrémentation atomique du quota mensuel
CREATE OR REPLACE FUNCTION public.increment_user_ai_usage(p_user_id UUID, p_endpoint TEXT)
RETURNS INT AS $$
DECLARE
  v_new_count INT;
BEGIN
  INSERT INTO public.api_usage (user_id, endpoint, count, period_start)
  VALUES (p_user_id, p_endpoint, 1, date_trunc('month', NOW()))
  ON CONFLICT (user_id, endpoint, period_start)
  DO UPDATE SET count = api_usage.count + 1
  RETURNING count INTO v_new_count;

  RETURN v_new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction de calcul de la consommation mensuelle IA globale
CREATE OR REPLACE FUNCTION public.get_user_monthly_ai_usage(p_user_id UUID)
RETURNS INT AS $$
  SELECT COALESCE(SUM(count), 0)::INT
  FROM public.api_usage
  WHERE user_id = p_user_id
    AND period_start >= date_trunc('month', NOW());
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Directives RLS (Row Level Security)

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles access" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Resumes access" ON public.resumes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Letters access" ON public.letters FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Applications access" ON public.applications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Saved jobs access" ON public.saved_jobs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "API Usage access" ON public.api_usage FOR ALL USING (auth.uid() = user_id);
```

---

## 3. Règle d'Import / Export de Données & Reset de Synchronisation

### Règle d'Importation Sanitisée
Lorsqu'un utilisateur importe un fichier JSON de sauvegarde ou un CV externe dans Dexie :
1. **Reset du timestamp de sync** : Le champ `synced_at` de l'élément importé est forcé à `null`.
2. **Réassignation du propriétaire** : Le champ `user_id` est mis à jour avec l'ID de l'utilisateur actuellement connecté.
3. **Mise à jour du timestamp** : `updated_at` prend la valeur actuelle (`new Date().toISOString()`).

👉 **Résultat** : `SyncEngine` détecte immédiatement les éléments nouvellement importés et les envoie automatiquement vers Supabase sans doublons ni erreurs de permissions.

---

## 4. Migration Dexie v13 & Moteur de Synchronisation Hybride (`SyncEngine`)

### Schéma Dexie v13 (IndexedDB)
Dans `web/src/lib/storage/db.ts`, la version 13 est ajoutée pour inclure les index de synchronisation :
- `history` (contient CV et Lettres) : index `updated_at`, `synced_at`, `deleted_at`.
- `applications` : index `updatedAt`, `synced_at`, `deleted_at`.
- `jobs` : index `createdAt`, `synced_at`, `deleted_at`.

### Mapping Dexie <-> Supabase
1. `history` (`doc_type === "CV"`) <-> Table Supabase `resumes`.
2. `history` (`doc_type === "Lettre"`) <-> Table Supabase `letters`.
3. `applications` <-> Table Supabase `applications`.
4. `jobs` <-> Table Supabase `saved_jobs`.

---

## 5. Architecture d'Authentification Next.js 16

### Stack & Packages
- `@supabase/ssr`
- `@supabase/supabase-js`

### Fichiers clés à créer dans `web/`
1. `src/lib/supabase/client.ts` : Singleton Supabase client pour les composants React (`createBrowserClient`).
2. `src/lib/supabase/server.ts` : Client Supabase pour Server Components & API routes (`createServerClient`).
3. `src/lib/supabase/middleware.ts` : Helper `updateSession()` appelé par `src/middleware.ts`.
4. `src/app/auth/callback/route.ts` : Traitement de la réponse OAuth Google (échange code -> jetons).
5. `src/state/authStore.ts` : Store Zustand d'état d'authentification (`user`, `session`, `signInWithGoogle()`, `signOut()`).

---

## 6. Variables d'Environnement Nouveaux (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJKV1Qi...
```

---

## 7. Plan de Test & Vérification
1. **Tests unitaires Quota IA (Vitest)** :
   - Tester qu'un invité sans clé API reçoit un rejet 401.
   - Tester qu'un invité avec clé API perso passe avec succès.
   - Tester qu'un utilisateur connecté consomme son quota et reçoit un 429 au 16ème appel.
2. **Tests d'Importation Sanitisée** : Vérifier que tout objet importé réinitialise `synced_at = null`.
3. **Tests d'étanchéité RLS** : Vérifier qu'un utilisateur A ne peut pas lire le CV d'un utilisateur B.
