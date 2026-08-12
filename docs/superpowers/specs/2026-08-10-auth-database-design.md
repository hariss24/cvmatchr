# Spécification — Comptes utilisateurs, base de données et quotas IA (Supabase)

> **Date** : 10 août 2026
> **Statut** : révisé après audit technique. Remplace la version du matin, dont le SQL
> était inapplicable (voir §9 « Corrections apportées »).
> **Contexte** : levée de la contrainte n°1 de `LIMITES.md` — mono-utilisateur, données
> uniquement locales dans IndexedDB, compteurs contournables, clé IA de l'application
> accessible à tout visiteur.
>
> **Source de vérité du SQL** : `web/supabase/migrations/0001_auth_quotas.sql`, créé par la
> Task 0 du plan `docs/superpowers/plans/2026-08-10-auth-database-implementation.md`.
> Le SQL reproduit ici est **illustratif** ; en cas de divergence, la migration fait foi.
> Ne jamais modifier le schéma à la main dans l'interface Supabase.

---

## 1. Objectifs et modèle économique

Ajouter une authentification Google, une base PostgreSQL gérée par Supabase (tier gratuit),
une synchronisation offline-first bidirectionnelle, et un **contrôle serveur effectif** des
appels IA.

### Règles d'accès aux fonctionnalités IA

**1. Visiteur anonyme (100 % local, sans compte)**
- Accès gratuit et illimité à la création, l'édition manuelle, l'export PDF et le stockage
  local dans IndexedDB.
- **Aucun accès à la clé IA de l'application.** Pour utiliser l'IA, il **doit** fournir sa
  propre clé (Gemini / Anthropic / DeepSeek) dans ses paramètres — modèle BYOK.
- Un appel IA sans clé personnelle renvoie **401**.

**2. Utilisateur connecté (compte Google)**
- Bénéficie d'un quota mensuel gratuit géré par le serveur (15 crédits par défaut).
- Les consommations sont enregistrées dans `api_usage`, **en écriture serveur uniquement** :
  l'utilisateur peut lire son compteur, pas le modifier.
- Quota épuisé → **429**, avec deux issues proposées : ajouter sa clé personnelle, ou passer
  à une formule payante.

**3. Utilisateur connecté avec clé personnelle**
- Sa clé est utilisée en priorité et **aucun crédit serveur n'est consommé**.

### Tarif en crédits

Le quota s'exprime en **crédits**, pas en « adaptations ». Une adaptation de CV déclenche
plusieurs appels ; annoncer « 15 adaptations » alors que le compteur incrémente à chaque
appel épuiserait le quota en trois adaptations.

| Endpoint | Coût | Justification |
|---|---|---|
| `tailor-resume` | 1 | Travail principal |
| `adapt-letter` | 1 | Travail principal |
| `text-to-resume` | 1 | Création complète |
| `text-to-letter` | 1 | Création complète |
| `pdf-to-resume` | 1 | Création complète |
| `editor-chat` | 1 | Appel explicite de l'utilisateur |
| `ats-score` | **0** | Accompagne une adaptation déjà facturée |
| `extract-meta` | **0** | Utilitaire, coût dérisoire |

Coût 0 = pas de débit, mais authentification (ou clé personnelle) toujours exigée.

Réinitialisation au **1er du mois calendaire** (`date_trunc('month', NOW())`). Conséquence
assumée : qui s'inscrit le 28 obtient un reset trois jours plus tard.

### Où vit la clé personnelle de l'utilisateur

**Dans le navigateur uniquement** (`settingsStore`, comportement actuel inchangé), transmise
au serveur par l'en-tête `X-Api-Key` à chaque appel. Elle **n'est pas stockée en base**.

La version précédente du spec définissait à la fois ce mécanisme *et* une colonne
`custom_ai_key` en clair — un doublon qui ajoutait une responsabilité RGPD et un risque de
fuite sans contrepartie fonctionnelle. Si le besoin multi-appareils apparaît, ce sera via
Supabase Vault, dans une migration dédiée.

---

## 2. Schéma PostgreSQL

Principes structurants, à respecter dans toute évolution :

**Clés primaires composites `(user_id, id)`.** Les identifiants sont générés par le
navigateur. Une clé primaire globale ferait entrer en collision deux utilisateurs important
le même fichier de sauvegarde, sur une ligne qu'ils ne peuvent pas voir (RLS) — erreur
indébogable.

**Deux horodatages sur toute table synchronisée :**
- `client_updated_at` — posé par le navigateur, arbitre les conflits (last-write-wins) ;
- `updated_at` — posé par le serveur via trigger, sert de **curseur de pull**. Sans lui, la
  synchronisation descendante est impossible et une horloge client déréglée corrompt les
  données.

**Suppressions douces** (`deleted_at`). Une suppression réelle ne laisse aucune trace à
répliquer : l'autre appareil ne voit qu'une absence, l'interprète comme « jamais envoyé » et
renvoie le document. Les documents supprimés ressusciteraient.

### Tables

| Table | Rôle | Particularité |
|---|---|---|
| `profiles` | Compte, plan, quota | `plan_tier` et `monthly_quota_limit` protégés par trigger |
| `resumes` | CV | ← `history` où `doc_type = "CV"` |
| `letters` | Lettres de motivation | ← `history` où `doc_type = "Lettre"` |
| `applications` | Candidatures | `payload` JSONB pour le journal d'événements |
| `saved_jobs` | Offres sauvegardées | possède bien un `updated_at` (le statut est mutable) |
| `api_usage` | Compteurs de quota | PK `(user_id, endpoint, period_start)` |

Le détail exact des colonnes, index, contraintes et triggers est dans la migration
`web/supabase/migrations/0001_auth_quotas.sql`.

---

## 3. Sécurité : le modèle de confiance

**Postulat de base** : tout ce qui vient du navigateur peut être fabriqué par l'utilisateur.
La clé `anon` est publique par conception ; ce qui protège les données, c'est le RLS.

### Row Level Security

| Table | Droits de l'utilisateur | Pourquoi |
|---|---|---|
| `profiles` | `SELECT` + `UPDATE` | mais un trigger neutralise `plan_tier` et `monthly_quota_limit` |
| `resumes`, `letters`, `applications`, `saved_jobs` | tout, sur ses lignes | données lui appartenant |
| `api_usage` | **`SELECT` seulement** | aucune policy d'écriture n'est déclarée |

Ces deux restrictions ne sont pas cosmétiques. Avec le `FOR ALL` de la version précédente,
n'importe quel utilisateur connecté pouvait, depuis la console de son navigateur :

```js
await supabase.from('api_usage').update({ count: 0 })                       // quota remis à zéro
await supabase.from('profiles').update({ plan_tier: 'unlimited' })          // auto-promotion
```

Le spec annonçait pourtant des compteurs « infalsifiables ».

### Consommation atomique d'un crédit

La vérification du quota **et** son incrément se font dans la même transaction PostgreSQL
(`consume_ai_credit`, `SECURITY DEFINER`, verrou `FOR UPDATE` sur le profil). Une
vérification en JavaScript suivie d'un incrément séparé laisserait deux clics simultanés
passer tous les deux.

### Fonctions

Toutes les fonctions `SECURITY DEFINER` fixent `SET search_path = ''` et qualifient leurs
schémas — sans quoi l'audit de sécurité Supabase les signale comme vecteur d'escalade de
privilèges.

| Fonction | Rôle |
|---|---|
| `handle_new_user()` | crée le profil à l'inscription (trigger sur `auth.users`) |
| `guard_profile_privileges()` | neutralise toute tentative de modification du plan/quota |
| `touch_updated_at()` | pose l'`updated_at` serveur |
| `consume_ai_credit(endpoint, cost)` | vérifie et débite atomiquement — renvoie `(allowed, used, quota_limit)` |
| `get_user_monthly_ai_usage()` | consommation du mois, pour l'affichage (`LANGUAGE sql`) |

---

## 4. Application du quota côté serveur

C'est le point sur lequel la version précédente échouait entièrement : elle définissait des
règles que personne n'appelait.

### L'état actuel du code, à corriger

Dans `web/src/lib/ai/clients.ts`, `requireActiveKey()` fait :

```ts
const key = geminiKey || process.env.GEMINI_API_KEY || "";
```

Ce code s'exécute côté serveur, où le store Zustand n'est **jamais hydraté** : `geminiKey`
est toujours vide, et le repli sur la clé de l'application s'applique donc à **tout
appelant, y compris un visiteur anonyme**. C'est exactement ce que la règle §1.1 interdit.

### Le mécanisme cible

Chaque route IA appelle `guardAiRequest(req, endpoint)` avant tout appel au fournisseur.
Le garde applique, dans l'ordre :

1. **Clé personnelle présente** (`X-Api-Key` non vide) → autorisé, rien n'est compté, le
   modèle choisi par l'utilisateur est respecté.
2. **Pas de clé, pas de session** → **401**.
3. **Session valide, coût > 0** → `consume_ai_credit()`. Refusé → **429** avec le compteur.
4. **Autorisé sur crédit serveur** → la clé du serveur est fournie, **et le modèle est
   imposé** (`AI_SERVER_MODEL`, un modèle Gemini). Sans cette contrainte, un utilisateur
   ayant choisi Claude sans clé personnelle se verrait débiter un crédit pour un appel qui
   échouerait faute de clé Anthropic côté serveur.

Le repli `|| process.env.GEMINI_API_KEY` de `requireActiveKey` est **supprimé** : la clé du
serveur n'arrive plus que par le garde.

Routes concernées : `adapt-letter`, `ats-score`, `editor-chat`, `extract-meta`,
`pdf-to-resume`, `tailor-resume`, `text-to-letter`, `text-to-resume`.

---

## 5. Synchronisation hybride

### Mapping Dexie ↔ Supabase

| Dexie | Supabase | Conversion de dates |
|---|---|---|
| `history` (`doc_type = "CV"`) | `resumes` | `created_at` ISO ; `updated_at` ajouté en v13 |
| `history` (`doc_type = "Lettre"`) | `letters` | idem |
| `applications` | `applications` | `createdAt`/`updatedAt` sont des **nombres** (ms) → ISO |
| `jobs` | `saved_jobs` | idem |

⚠️ Les tables locales n'ont pas un format de date homogène : `HistoryEntry` n'avait
**aucun** `updated_at` avant la v13, `Application` et `JobEntry` utilisent des timestamps
numériques. Une interface `SyncableItem` unique ne compile pas — la conversion doit être
explicite, table par table.

### Migration Dexie v13

Ajoute les index `updated_at`, `synced_at`, `deleted_at` sur `history`, `applications` et
`jobs`, et remplit `updated_at` pour les enregistrements existants (sans quoi ils
paraîtraient « jamais modifiés » et ne remonteraient jamais).

### Moteur

- **Push** : les éléments dont `synced_at` est nul ou antérieur à `updated_at`.
- **Pull** : les lignes dont l'`updated_at` **serveur** dépasse le curseur local.
- **Conflit** : last-write-wins sur `client_updated_at`. Limite assumée, à consigner dans
  `LIMITES.md` : une modification concurrente hors-ligne sur deux appareils est perdue en
  silence.
- **Suppression** : propagée par `deleted_at`, jamais par une absence.

### Import de données

`importDatabase` efface tout (`clear()`) puis réinsère. Après un import, **la totalité** du
contenu local est donc nouvelle : chaque élément voit `synced_at` remis à `null` et
`updated_at` rafraîchi, sinon le contenu importé n'est jamais envoyé et le contenu remplacé
n'est jamais supprimé côté serveur.

Le `user_id` n'est **pas** stocké dans Dexie : il est ajouté au moment du push, à partir de
la session. La version précédente du spec demandait de « réassigner `user_id` » sur un champ
qui n'existe pas localement.

À l'export, `synced_at` est retiré : un fichier de sauvegarde ne doit pas transporter l'état
de synchronisation d'un autre appareil.

### Changement de compte

À la déconnexion, et lorsque l'utilisateur qui se connecte diffère du propriétaire du
contenu local, **IndexedDB est purgé**. Sans cela : A se déconnecte, B se connecte sur le
même navigateur, voit les CV de A, et la synchronisation les réplique sur le compte de B.

---

## 6. Architecture d'authentification (Next.js 16)

### Paquets
`@supabase/ssr`, `@supabase/supabase-js`

### Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/supabase/env.ts` | accès aux variables, **sans `!` non-null** : elles sont optionnelles |
| `src/lib/supabase/client.ts` | client navigateur, renvoie `null` si non configuré |
| `src/lib/supabase/server.ts` | client Server Components / routes API, renvoie `null` si non configuré |
| `src/lib/supabase/middleware.ts` | `updateSession()`, no-op si non configuré |
| `src/middleware.ts` | **composé** avec la porte `REMOTE_AUTH_PASSWORD` existante |
| `src/app/auth/callback/route.ts` | échange du code OAuth, redirection validée |
| `src/state/authStore.ts` | store Zustand |
| `src/components/auth/AuthProvider.tsx` | appelle `initAuth()` au montage |

### Contraintes non négociables

- **Mode local intact.** Sans variables Supabase, l'application démarre et fonctionne comme
  avant. Tout `createBrowserClient(undefined)` est un échec.
- **La protection `REMOTE_AUTH_PASSWORD` est conservée.** Le middleware actuel protège le
  déploiement distant ; le remplacer purement et simplement supprimerait cette protection
  sans aucun message.
- **`initAuth()` doit être monté.** Sans provider, `isLoading` reste `true` et l'interface
  affiche « Chargement… » indéfiniment.
- **Redirection du callback validée** : seuls les chemins internes sont acceptés
  (ni URL absolue, ni `//`). Le refus d'autorisation Google (`?error=`) est traité.
- **`x-forwarded-host`** est pris en compte : derrière un proxy, `origin` n'est pas l'hôte
  public.

### Interface

Le menu utilisateur existe déjà (`src/components/layout/UserMenu.tsx`, monté dans
`TopBar.tsx`). On l'**enrichit** — connexion Google, avatar, compteur de crédits,
déconnexion. Ne pas créer un second composant du même nom.

L'entrée de connexion est masquée quand Supabase n'est pas configuré : sinon le clic mène à
une impasse.

---

## 7. Variables d'environnement

```env
# Optionnelles : sans elles, l'app tourne en mode 100 % local.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Clé IA du serveur, réservée aux utilisateurs connectés dans leur quota.
# JAMAIS de préfixe NEXT_PUBLIC_ : elle serait exposée dans le navigateur.
GEMINI_API_KEY=

# Modèle imposé quand c'est la clé du serveur qui paie.
AI_SERVER_MODEL=gemini-2.5-flash
```

Rappel : `NEXT_PUBLIC_*` est recopié dans le code envoyé au navigateur et figé au build.
La clé `service_role` ne doit apparaître nulle part dans l'application.

---

## 8. Plan de vérification

### Tests unitaires (Vitest)
- Garde d'environnement : trois cas (absent, complet, partiel).
- Validation de la redirection de callback : chemin interne, URL absolue, `//`, absent.
- Règles de quota : clé perso → autorisé ; invité sans clé → 401 ; connecté → crédit serveur.
- Tarif des endpoints : `ats-score` et `extract-meta` à 0.
- Delta de synchro, conversion de dates, marquage de suppression, sanitization d'import.

⚠️ **Vitest ne typecheck pas.** Chaque tâche se termine par `npx tsc --noEmit`.

### Tests de sécurité de la base (automatisés)

`web/supabase/tests/rls_etancheite.sql` s'exécute sur un PostgreSQL nu via Docker (commande
dans `web/supabase/README.md`) et couvre :

- étanchéité RLS entre deux utilisateurs, y compris la lecture ciblée par `user_id` ;
- clés primaires composites : deux utilisateurs peuvent avoir un document du même
  identifiant local ;
- compteur de quota non modifiable ni supprimable par l'utilisateur ;
- `plan_tier` / `monthly_quota_limit` neutralisés pour l'utilisateur, modifiables par le
  `service_role`, `display_name` restant éditable ;
- quota réellement appliqué : 15 crédits accordés, 16ᵉ refusé, aucun débit sur refus ;
- création automatique du profil à l'inscription en `free` / 15.

Ces assertions ont été validées par mutation : réintroduire `FOR ALL` sur `api_usage` ou
retirer le trigger anti-escalade fait bien échouer les tests correspondants.

### Vérifications manuelles obligatoires

Ces points dépendent de la couche applicative et ne sont couverts par aucun test automatisé.

1. **Mode local** : sans `.env.local`, créer un CV et exporter un PDF. Rien ne casse.
2. **Refus de l'invité** : appel IA sans clé ni compte → **401** vérifié au `curl`.
3. **BYOK** : avec une clé perso, l'appel passe et `api_usage` reste inchangé.
4. **Quota applicatif** : 15 crédits consommés → **429** au 16ᵉ appel, message du serveur
   affiché tel quel → ajout d'une clé perso → débloqué immédiatement.
5. **Flux OAuth** : connexion Google complète, session persistée après rechargement.
6. **Multi-appareils** : création sur A visible sur B ; suppression sur A propagée sur B et
   **non réapparue** après rechargement.
7. **Déconnexion** : IndexedDB vidé ; reconnexion avec un autre compte ne montre rien du
   précédent.

Procédure détaillée et résultats consignés dans `web/tests/manual/VERIF_BOUT_EN_BOUT.md`.

### Suite complète

```bash
cd web && npx tsc --noEmit && npm run lint && npm test && npm run build
```

---

## 9. Corrections apportées à la version du matin

| # | Problème | Correction |
|---|---|---|
| 1 | Le quota n'était branché dans aucune route ; la clé de l'app restait gratuite pour tout visiteur | `guardAiRequest()` dans les 8 routes + suppression du repli `process.env` |
| 2 | Aucune tâche ne créait la base | Task 0 : migration versionnée, appliquée et vérifiée |
| 3 | `FOR ALL` sur `api_usage` et `profiles` → compteur et plan modifiables par l'utilisateur | `SELECT` seul sur `api_usage`, trigger anti-escalade sur `profiles` |
| 4 | `get_user_monthly_ai_usage` en `LANGUAGE plpgsql` avec un corps SQL nu → `CREATE FUNCTION` échoue | `LANGUAGE sql` |
| 5 | Le middleware `REMOTE_AUTH_PASSWORD` était écrasé sans mention | Middleware composé |
| 6 | Synchronisation push uniquement → pas de multi-appareil malgré la promesse | Push **et** pull, avec curseur serveur |
| 7 | `deleted_at` ajouté mais suppressions dures conservées → documents ressuscitent | Conversion en suppressions douces + filtres de lecture |
| 8 | Aucune purge locale au changement de compte → fuite de données entre utilisateurs | `purgeLocalData()` sur `signOut` et changement d'identité |
| 9 | Clés primaires globales → collision entre utilisateurs à l'import | PK composites `(user_id, id)` |
| 10 | `user_id` à réassigner à l'import sur un champ inexistant en local | Ajouté au push depuis la session |
| 11 | `custom_ai_key` en clair, en doublon avec `X-Api-Key` | Colonne supprimée |
| 12 | Format de dates incompatible entre les trois tables locales | Couche de conversion explicite |
| 13 | `saved_jobs` sans `updated_at` alors que le statut est mutable | Colonne ajoutée |
| 14 | Fonctions `SECURITY DEFINER` sans `search_path` | `SET search_path = ''` partout |
| 15 | Redirection de callback non validée, refus OAuth non traité, proxy ignoré | Validées |
| 16 | `initAuth()` jamais appelée, `UserMenu` jamais monté | `AuthProvider` + enrichissement du menu existant |
| 17 | `process.env.X!` → l'app cassait pour les invités sans configuration | Garde d'environnement, `null` propagé |
| 18 | Vérification et incrément du quota séparés → course concurrente | `consume_ai_credit()` atomique |
| 19 | « 15 adaptations » alors que le compteur incrémente par appel | Tarif explicite par endpoint |
| 20 | DeepSeek absent alors que le code le supporte | Ajouté à `ai_provider` |
| 21 | Second `UserMenu` créé alors qu'il en existe déjà un monté | On enrichit l'existant |

---

## 10. Hors périmètre — décisions différées

Listées pour que l'absence soit un choix, pas un oubli.

1. **Photos en Supabase Storage.** Elles restent en base64 dans le JSONB. À 100
   utilisateurs × 5 CV avec photo, on approche des 500 Mo du tier gratuit, et chaque pull
   les retélécharge. C'est une décision de **schéma** : la changer plus tard imposera une
   migration des données de tous les utilisateurs.
2. **RGPD.** Suppression de compte (le `ON DELETE CASCADE` est prêt, le bouton n'existe
   pas), export des données, politique de confidentialité, base légale, information à la
   connexion. Beaucoup moins coûteux maintenant qu'avec des utilisateurs réels.
3. **Tables non synchronisées.** 4 des 11 tables Dexie seulement. `profile`
   (« Mes informations »), `templates` et `jobProfile` restent locaux — or le profil est
   probablement ce qu'un utilisateur s'attend le plus à retrouver sur un second appareil.
4. **Facturation.** `plan_tier` existe, aucun paiement n'est branché. Seul le `service_role`
   peut promouvoir un compte, donc manuellement.
5. **Tier gratuit Supabase.** Projet mis en pause après 7 jours d'inactivité ; 500 Mo de
   base ; trafic sortant limité.
