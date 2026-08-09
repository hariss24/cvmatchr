# Plan — Refonte page « Offres » : profil paramétrable + multi-utilisateur

> **Objectif** : supprimer tout ce qui est codé en dur pour Hariss dans le chasseur
> d'offres (`DEFAULT_PROFILE`), exposer ces critères comme des champs éditables dans
> l'UI, et poser le socle multi-utilisateur (comptes + base serveur) qui prépare le
> SaaS Cvmatchr.

## Hypothèses posées (à invalider si faux)

1. Cible = SaaS Cvmatchr → on vise de **vrais comptes avec base serveur**, pas un
   simple stockage navigateur. Le plan est découpé pour que la Phase 1 (profil
   éditable) soit livrable seule si on veut différer l'auth.
2. Tous les champs de `JobSearchProfile` deviennent paramétrables, avec les champs
   essentiels visibles et le reste dans une section « Avancé » repliée.
3. Stack serveur : **Supabase** (Auth + Postgres + Row Level Security) — le choix le
   plus direct pour un Next.js sur Vercel, gratuit au démarrage, et qui servira
   ensuite pour héberger CV/lettres/historique.
4. L'implémentation sera déléguée à Gemini par missions (workflow habituel) ; chaque
   phase ci-dessous est découpée en missions autonomes vérifiables.

## État actuel (constat)

- `web/src/lib/jobs/profile.ts` : `DEFAULT_PROFILE` = profil de Hariss en dur
  (adresse 75012, 29 mots-clés de poste, région 11, mots exclus, barème, résumé
  candidat, seuils).
- `web/src/lib/jobs/resolveProfile.ts` : point d'extension prévu — retourne
  toujours `DEFAULT_PROFILE`. Utilisé par `app/jobs/page.tsx`,
  `api/jobs/search/route.ts`, `api/jobs/score/route.ts`.
- Toute la logique (`francetravail.ts`, `prefilter.ts`, `score.ts`, `maps.ts`)
  reçoit déjà le profil **en argument** → le cœur ne change pas.
- Persistance : 100 % IndexedDB (Dexie) côté navigateur, y compris `db.jobs`.
- Auth : mot de passe unique partagé (`middleware.ts`), pas de notion de compte.

---

## Phase 1 — Profil de recherche éditable (dé-hardcoder)

**Livrable** : une section « Mes critères de recherche » sur la page Offres ; plus
aucune donnée personnelle dans le code source.

### 1.1 Modèle et validation
- Créer un schéma Zod `jobSearchProfileSchema` (dans `lib/jobs/profile.ts`) qui
  valide un `JobSearchProfile` complet, avec défauts **neutres** (adresse vide,
  listes vides, seuils par défaut : minScore 70, maxAgeDays 30, aiShortlist 20,
  barème générique).
- `DEFAULT_PROFILE` devient `EMPTY_PROFILE` (défauts neutres). Le profil de Hariss
  sort du code → il sera saisi via l'UI (et gardé en fixture de test
  `web/tests/fixtures/job_profile_hariss.json` pour les tests existants).

### 1.2 Persistance locale (pré-comptes)
- Nouvelle table Dexie `jobProfile` (une seule ligne) dans `lib/storage/db.ts`
  + `getJobProfile()` / `saveJobProfile()`.

### 1.3 Transport vers les API
- Les routes `api/jobs/search` et `api/jobs/score` acceptent le profil **dans le
  corps de la requête**, validé par le schéma Zod ; `resolveProfile(req)` lit le
  corps et applique les défauts. (Plus tard, Phase 2 : il lira la session.)
- `JobsView` envoie le profil chargé depuis Dexie à chaque appel.

### 1.4 UI « Mes critères »
- Nouveau composant `components/jobs/ProfileForm.tsx`, affiché dans un panneau
  repliable en tête de la page Offres (pattern visuel des panneaux existants,
  variables CSS du design system, jamais de couleur en dur).
- Champs visibles : adresse de départ, mots-clés de poste (tags), types de
  contrat (cases CDI/CDD/MIS…), région (select codes France Travail), modes de
  transport (cases), ancienneté max, score minimum.
- Section « Avancé » repliée : mots exclus, mots-clés de pré-tri, résumé candidat
  (textarea), barème de notation (liste éditable label/max/description),
  aiShortlist, maxDescriptionChars.
- État vide : si aucun profil enregistré, la page invite à remplir les critères
  avant de lancer un scan (bouton « Scanner » désactivé tant que adresse +
  ≥ 1 mot-clé manquent).

### 1.5 Vérification Phase 1
- `npm test` (adapter `score.test.ts` / `francetravail.test.ts` à la fixture),
  `npx tsc --noEmit`, `npm run lint`.
- Test manuel : profil vide → invitation ; saisir critères → scan OK ; recharger
  la page → critères conservés.
- `grep -ri "hariss\|jean bouton" web/src` → **zéro résultat**.

---

## Phase 2 — Comptes utilisateurs (Supabase Auth + Postgres)

**Livrable** : inscription/connexion par email, profil de recherche stocké par
compte en base, `resolveProfile` lit la session.

### 2.1 Infra
- Projet Supabase ; `@supabase/ssr` dans `web/` ; variables
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (+ service role côté
  serveur, jamais exposée).
- Table `job_profiles` (`user_id` PK/FK auth.users, `profile jsonb`, `updated_at`)
  avec **RLS** : chaque utilisateur ne lit/écrit que sa ligne. Le `jsonb` est
  validé par le même schéma Zod côté API — pas de double modèle.

### 2.2 Auth dans l'app
- Remplacer le middleware mot-de-passe par la session Supabase (cookies SSR) :
  routes protégées → redirection `/login` ; nouvelle page login/signup
  (email + mot de passe, magic link en option).
- Conserver un **mode local sans compte** (aucune variable Supabase définie →
  comportement Phase 1, stockage Dexie) pour le dev et l'usage perso.

### 2.3 Profil côté serveur
- `resolveProfile(req)` : session Supabase → charge `job_profiles` ; sinon corps
  de requête (mode local). Les routes jobs ne changent plus.
- `ProfileForm` sauvegarde via une route `api/jobs/profile` (GET/PUT) quand une
  session existe, sinon Dexie. Migration douce : à la première connexion, si un
  profil Dexie existe, proposer de l'importer dans le compte.

### 2.4 Vérification Phase 2
- Deux comptes de test → chacun voit ses propres critères ; RLS vérifiée en
  tentant de lire la ligne d'un autre compte (doit échouer).
- Mode local sans Supabase toujours fonctionnel (`npm run dev` sans les vars).
- Suite complète : tests, tsc, lint, `npm run build`.

---

## Phase 3 — Offres par utilisateur (extension naturelle, hors périmètre immédiat)

- Migrer `db.jobs` (offres retenues/masquées) vers Postgres par compte, même
  motif que le profil (table `jobs`, RLS, fallback Dexie en mode local).
- Ensuite seulement : historique, brouillons, snapshots — chantier séparé.

---

## Ordre d'exécution et découpage en missions (workflow Gemini)

| Mission | Contenu | Dépend de |
|---|---|---|
| M1 | Schéma Zod + EMPTY_PROFILE + fixture Hariss + adaptation tests | — |
| M2 | Table Dexie `jobProfile` + profil dans le corps des requêtes + `resolveProfile` | M1 |
| M3 | `ProfileForm` (UI complète, état vide, section avancée) | M2 |
| M4 | Setup Supabase (projet, table, RLS) + client SSR + pages login/signup | — |
| M5 | `resolveProfile` par session + route `api/jobs/profile` + import du profil Dexie | M3, M4 |

## Critères de succès globaux

1. Aucune donnée personnelle de Hariss dans `web/src` (grep vide).
2. Un nouvel utilisateur peut saisir ses critères et lancer un scan sans toucher
   au code.
3. Deux comptes distincts ont des critères et des résultats isolés (RLS).
4. Le mode local (sans Supabase) reste 100 % fonctionnel.
5. `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` verts.

## Risques / points d'attention

- **Ne pas casser les tests existants** qui importent `DEFAULT_PROFILE` → fixture.
- **Clés API serveur** (France Travail, Google Maps, Gemini) restent globales à
  l'app en Phase 2 ; la facturation par utilisateur est un sujet SaaS ultérieur
  (quotas par compte à prévoir en Phase 3+).
- **Adresse personnelle = donnée sensible** : ne jamais la logger, ni l'envoyer à
  l'IA au-delà du prompt de scoring existant.
- Next.js 16 : relire `node_modules/next/dist/docs/` avant tout code middleware/SSR
  (breaking changes vs connaissances d'entraînement).
