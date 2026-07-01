# Spec — Feature « Offres » (chasseur d'offres intégré) pour Next.js

- **Date :** 2026-07-01
- **Projet :** cv-tailor (`web/`, Next.js 16 / React 19, déployé sur Vercel)
- **Origine :** port du plan Flask `PLAN_INTEGRATION_BOT.md` (bot `agent-taff`) vers l'architecture Next.js/serverless.
- **Statut :** design validé (brainstorming 2026-07-01). Étape suivante : plan d'implémentation.

## 1. Objectif

Ajouter un onglet **« Offres »** à l'app. L'utilisateur clique « Chercher des offres » ; l'app
récupère des offres France Travail correspondant au profil de Hariss, calcule un temps de trajet
(Google Maps), note chaque offre sur 100 avec l'IA (Gemini), et affiche les offres retenues
(score ≥ 70) sous forme de cartes triées. Chaque carte propose **« Adapter mon CV »**, qui
enchaîne sur la modale d'adaptation déjà existante (`TailorModal` → `/api/tailor-resume`).

**Critère de succès :** depuis la prod, cliquer « Chercher des offres » fait apparaître des cartes
notées en quelques minutes ; « Adapter mon CV » ouvre l'éditeur avec la modale pré-remplie par
le texte de l'offre ; relancer une recherche ne re-note pas les offres déjà vues.

## 2. Décisions validées (brainstorming)

| Sujet | Décision |
|---|---|
| Accès API | France Travail + Google Maps + Gemini disponibles (clés configurées) |
| Déroulement du scan | **Option A** : orchestré par le navigateur (routes API courtes), pas de tâche de fond serveur |
| Stockage des offres | **Local** (Dexie/IndexedDB), comme les CV — pas de base serveur |
| Ampleur | Plafond ~**40 offres notées** par recherche (constante ajustable) |
| Profil de scoring | **Figé** sur le profil de Hariss (repris du bot) |
| Jonction | « Adapter mon CV » pré-remplit `TailorModal` via le store |
| Quota Gemini (429) | **Arrêt propre** du scan (garder les offres déjà notées + message), pas de retry bloquant |

**Pourquoi Option A :** Vercel = fonctions serverless courtes et sans filesystem persistant. Un
thread de fond + SQLite (comme le plan Flask) est impossible. Découper en petits appels pilotés
par le client contourne les limites de durée, rend le scan résilient (une offre qui échoue
n'interrompt pas le reste) et garde les données locales (cohérent avec le reste de l'app).

## 3. Architecture

### 3.1 Modules de logique — `web/src/lib/jobs/`
Isolés et **paramétrables** (profil + clés passés en argument, pas en dur au cœur de la logique)
pour préparer l'évolution SaaS (cf. §7).

- `profile.ts` — constantes du profil Hariss reprises du bot : `KEYWORDS` (28 intitulés SEO/web),
  `HOME_ADDRESS` (« 4 rue jean bouton 75012 Paris »), `MIN_SCORE = 70`, `MAX_DESCRIPTION_CHARS = 3000`,
  `EXCLUDED_WORDS` (stages/alternances), `SCORE_LIMIT` (plafond 40), + le prompt/schéma de scoring.
- `francetravail.ts` — `getToken(clientId, clientSecret)` (OAuth client_credentials), `fetchOffers(token, keyword)`
  (recherche : région 11 Île-de-France, `typeContrat=CDI,CDD`, `natureContrat=E1`, offres < 30 jours,
  `range=0-99`), `isExcluded(offer)` (filtre stages/alternances), `mapOffer(offer)` → objet carte.
- `maps.ts` — `getCommuteTimes(destination, key)` : Google Maps Distance Matrix depuis `HOME_ADDRESS`
  (modes transit / bicycling / walking), retourne `{ transit, bicycling, walking }`. Port de
  `get_commute_times` (`agent-taff/bot.py`).
- `score.ts` — `scoreOffer(offer, commute, key)` : appelle Gemini avec le système de scoring
  (profil Hariss) et un **response schema JSON** structuré → `{ score_tech, score_seniority,
  score_sector, score_geo, score_red_flags, total_score, red_flags_reasons }`.

> Le scoring exige un appel Gemini avec `response_schema` structuré. `lib/ai/clients.ts` expose
> déjà l'accès Gemini (`@google/genai`) ; prévoir un helper `completeJson(schema, system, prompt)`
> (nouveau ou extension) plutôt que de dupliquer la création du client.

### 3.2 Routes API — `web/src/app/api/jobs/`
Toutes en `export const runtime = "nodejs"` ; lisent les clés via `process.env`.

- `POST /api/jobs/search` — appelée 1 fois par recherche. Obtient le token FT, interroge l'API pour
  chaque `KEYWORD`, agrège, applique `isExcluded`, dédoublonne par `id`, tronque les descriptions.
  Réponse : `{ offers: [{ id, title, company, location, url, jobText }] }`. Si clés FT manquantes →
  400 `{ error: "config", message }`.
- `POST /api/jobs/score` — appelée en boucle (1 offre). Body `{ offer }`. Calcule le trajet (Maps)
  puis le score (Gemini). Réponse `{ score, breakdown, commute }`. 429 quota Gemini → statut 429
  distinct pour que le client arrête proprement. Clés Maps/Gemini manquantes → 400 `config`.

### 3.3 Stockage — `web/src/lib/storage/db.ts` (Dexie)
Nouvelle table **`jobs`** : `id` (PK), `createdAt`, `title`, `company`, `location`, `commute`
(texte « TC: … | Vélo: … »), `score`, `url`, `jobText`, `status` (`new` | `dismissed`).
Fonctions : `jobExists(id)`, `saveJob(entry)`, `listJobs(status='new')` (tri score desc), `setJobStatus(id, status)`.

### 3.4 Écran — `web/src/app/jobs/page.tsx` + `web/src/components/jobs/`
- Lien **« Offres »** dans `TopBar` (à côté d'« Historique »).
- `ScanProgress` : barre affichant `phase`, `trouvées`, `notées / plafond`, `retenues`.
- `JobCard` : titre, entreprise, lieu, trajet, badge **score /100**, lien vers l'offre, boutons
  **« Adapter mon CV »** et **« Masquer »**.
- État vide / config : si `/api/jobs/search` renvoie `config`, afficher « Configure tes accès
  France Travail et Google Maps » au lieu de planter.

### 3.5 Jonction « Adapter mon CV »
- Ajouter `pendingJobDesc: string | null` + `setPendingJobDesc` au store (`state/docStore.ts`).
- « Adapter mon CV » : `setPendingJobDesc(offer.jobText)` puis navigation vers `/` (éditeur).
- `TailorModal` : au montage, si `pendingJobDesc` est défini, initialiser `jobDesc` avec sa valeur
  et la consommer (remettre à `null`), puis ouvrir la modale. **Aucune duplication** de la logique
  de tailoring existante.

## 4. Flux de données (scan)

```
[clic « Chercher »]
  → POST /api/jobs/search               (serveur : FT token + fetch + filtre + dédup)
  ← { offers }
  → client filtre via Dexie jobExists   (retire les déjà vues)
  → garde les 40 premières
  → pour chaque offre :
       POST /api/jobs/score             (serveur : Maps + Gemini)
       ← { score, breakdown, commute }
       si score ≥ 70 : saveJob(status="new")   ; retenues++
       maj ScanProgress
       si réponse 429 : STOP + message « Limite IA atteinte »
  → listJobs("new") → rendu des cartes triées par score
```

## 5. Gestion des erreurs
- **Clés non configurées** → réponse `config` (400) → écran d'invite, pas de crash.
- **Une offre échoue au scoring** (Maps/Gemini ponctuel) → on la saute, le scan continue.
- **Quota Gemini (429)** → arrêt propre : on conserve les offres déjà notées et on affiche
  « Limite IA atteinte, réessaie plus tard » (pas de retry 65 s bloquant comme le bot).
- **France Travail indisponible** → message d'erreur dans l'onglet.

## 6. Variables d'environnement
`FT_CLIENT_ID`, `FT_CLIENT_SECRET`, `GOOGLE_MAPS_API_KEY` (+ `GEMINI_API_KEY` déjà présente).
Configurées en prod Vercel + `web/.env.local` (gitignoré) le 2026-07-01. À documenter dans le README.

## 7. Sécurité & perspective SaaS
- **v1 (accès libre, 1 utilisateur) : risque accepté.** La recherche consomme les clés de Hariss
  (FT / Maps / Gemini). Tant que Hariss est seul à connaître l'URL, acceptable. À protéger
  (mot de passe sur l'onglet, ou auth globale) **avant toute diffusion**.
- **Ambition SaaS (hors périmètre v1, à ne pas fermer) :** profil de scoring par utilisateur
  (aujourd'hui figé), clés par utilisateur (ne pas servir tout le monde avec celles de Hariss),
  auth réelle + stockage par compte. → C'est pourquoi `lib/jobs/` prend profil et clés en
  **arguments** : la bascule multi-utilisateur ne touchera pas le cœur de la logique.

## 8. Tests
- **Unitaires (Vitest) :** `isExcluded` (stages/alternances), dédoublonnage, respect du plafond 40,
  `mapOffer` (offre FT brute → carte), parsing/bornage du score, fonctions Dexie `jobs` (mock).
- **E2E (Playwright, serveur mocké) :** recherche → une carte notée s'affiche ; « Adapter mon CV »
  ouvre `TailorModal` pré-remplie ; « Masquer » retire la carte ; écran `config` si clés absentes.

## 9. Hors périmètre v1
Recherche planifiée/automatique ; profil modifiable ; base de données en ligne ; multi-utilisateur ;
notation basée sur le CV chargé (profil figé) ; routage MongoDB.
