# Schéma Supabase — source de vérité

Ce dossier contient les migrations SQL de la base PostgreSQL hébergée par Supabase.

## Règle unique

**Ne jamais modifier la base à la main dans l'interface Supabase.** Tout changement de
schéma passe par un nouveau fichier numéroté dans `migrations/`, commité dans Git.

Sinon, trois mois plus tard, personne ne sait plus quel est l'état réel de la base, il
devient impossible de revenir en arrière, et impossible de recréer un environnement de test
identique à la production.

De la même manière, **ne jamais modifier un fichier de migration déjà appliqué** : il a déjà
tourné. Un changement se fait toujours par un nouveau fichier.

## Migrations

| Fichier | Contenu |
|---|---|
| `0001_auth_quotas.sql` | Tables profils/CV/lettres/candidatures/offres/compteurs, RLS, triggers, fonctions de quota |
| `0002_user_settings.sql` | Réglages utilisateur répliqués (profil, critères de recherche d'offres) |
| `0003_documents_templates.sql` | Documents et modèles répliqués |
| `0004_rate_limits.sql` | Compteur d'appels partagé, pour limiter le débit des routes API publiques |

Spécification associée : `docs/superpowers/specs/2026-08-10-auth-database-design.md`.

## Appliquer

```bash
cd web && npx supabase db push
```

À défaut de CLI, coller le contenu du fichier dans **SQL Editor** côté Supabase et exécuter.

## Vérifier après application

À exécuter dans le SQL Editor. Lire réellement la sortie — un `CREATE` silencieux ne prouve
rien.

```sql
-- 6 tables, toutes avec rowsecurity = true
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;

-- api_usage doit avoir UNE seule policy, de commande SELECT.
-- profiles doit en avoir exactement deux (SELECT, UPDATE), aucune INSERT/DELETE.
SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY 1, 2;

-- Les 5 fonctions doivent être présentes.
SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace ORDER BY 1;
```

Puis, dans l'interface Supabase, onglet **Advisors > Security** : aucun avertissement
`function_search_path_mutable` ne doit apparaître.

## Tester en local (sans compte Supabase)

Les migrations référencent le schéma `auth`, qui n'existe que chez Supabase.
`_auth_stub.sql` en fournit un bouchon minimal — `auth.users`, `auth.uid()`, `auth.role()`,
le rôle `authenticated` et ses droits par défaut — ce qui permet de faire tourner la
migration **et les tests de sécurité** sur un PostgreSQL nu.

Docker Desktop doit tourner.

```bash
cd web/supabase && docker run --rm -e POSTGRES_PASSWORD=x -v "$PWD:/sql" postgres:15 sh -c "docker-entrypoint.sh postgres > /tmp/pg.log 2>&1 & sleep 12 && psql -U postgres -q -v ON_ERROR_STOP=1 -f /sql/_auth_stub.sql -f /sql/migrations/0001_auth_quotas.sql > /dev/null && psql -U postgres -v ON_ERROR_STOP=1 -f /sql/tests/rls_etancheite.sql"
```

Attendu en fin de sortie : `TOUS_LES_TESTS_OK`. Toute assertion violée interrompt le script
avec un message explicite.

Pour le compteur de débit (migration 0004), même principe :

```bash
cd web/supabase && docker run --rm -e POSTGRES_PASSWORD=x -v "$PWD:/sql" postgres:15 sh -c "docker-entrypoint.sh postgres > /tmp/pg.log 2>&1 & sleep 15 && psql -U postgres -q -v ON_ERROR_STOP=1 -f /sql/_auth_stub.sql -f /sql/migrations/0004_rate_limits.sql > /dev/null && psql -U postgres -v ON_ERROR_STOP=1 -f /sql/tests/rate_limit.sql"
```

### Ce que couvre `tests/rate_limit.sql`

| Test | Vérifie |
|---|---|
| 1 | Les appels sous la limite passent, et le compteur s'incrémente d'un par appel. |
| 2 | L'appel de trop est refusé, avec un `retry_after` compris dans la fenêtre. |
| 3 | Deux seaux (route ou IP différente) ne se contaminent pas. |
| 4 | Une fenêtre expirée remet le compteur à 1 au lieu de continuer à l'incrémenter. |
| 5 | Un utilisateur connecté ne peut ni lire, ni modifier, ni insérer un compteur. |
| 5b | Le visiteur anonyme, lui, peut toujours appeler la fonction — sans quoi toutes les routes publiques repasseraient sans limite. |

Validation par mutation, exécutée le 19/08/2026 :

| Faille réintroduite | Résultat |
|---|---|
| `CREATE POLICY ... ON rate_limits FOR ALL` | TEST 5 échoue : « 3 ligne(s) de compteur lisibles par l'utilisateur » |
| `REVOKE EXECUTE ... FROM anon` | TEST 5b échoue : « permission denied for function consume_rate_limit » |
| Réarmement de fenêtre supprimé | TEST 4 échoue : « seau toujours bloqué après expiration de la fenêtre » |

### Purge

`rate_limits` garde une ligne par IP et par route. Le volume est borné par le nombre d'IP
distinctes, mais rien ne l'efface : à exécuter de temps en temps si la table grossit.

```sql
DELETE FROM public.rate_limits WHERE window_start < now() - INTERVAL '1 day';
```

### Ce que couvre `tests/rls_etancheite.sql`

| Test | Vérifie |
|---|---|
| 1 | B ne voit que ses CV, et n'atteint pas ceux de A même en les ciblant par `user_id`. Valide aussi la PK composite : A et B peuvent avoir un CV du même identifiant local. |
| 2 | B ne peut ni modifier ni supprimer son compteur de quota. |
| 3 | B ne peut pas s'auto-promouvoir (`plan_tier`, `monthly_quota_limit` neutralisés), mais peut toujours changer son `display_name`. |
| 3b | Le `service_role`, lui, peut bien promouvoir un compte. |
| 4 | 15 crédits accordés, 16ᵉ appel refusé, et un appel refusé ne débite rien. |
| 5 | Le profil est créé automatiquement à l'inscription, en `free` / 15. |

Le rôle `authenticated` est explicitement endossé (`SET ROLE`) : sans cela, le test
s'exécuterait en tant que propriétaire des tables, pour qui le RLS ne s'applique pas — et
passerait sans rien prouver.

### Validation par mutation

Les assertions ont été vérifiées en réintroduisant les failles de la spécification
d'origine, pour s'assurer qu'elles ne sont pas décoratives :

| Faille réintroduite | Résultat |
|---|---|
| `CREATE POLICY ... ON api_usage FOR ALL` | TEST 2 échoue : « 1 ligne(s) de compteur modifiées par l'utilisateur » |
| `DROP TRIGGER trg_guard_profile_privileges` | TEST 3 échoue : « auto-promotion réussie (plan_tier = unlimited) » |

### Ce que ces tests ne couvrent pas

Le flux OAuth Google, les cookies de session, et toute la couche applicative Next.js — dont
le refus **401** d'un visiteur anonyme et le **429** de quota dépassé, qui dépendent du garde
côté route. Ces points restent à vérifier manuellement (Task 7 du plan).
