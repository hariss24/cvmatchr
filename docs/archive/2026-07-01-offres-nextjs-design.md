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
| Ampleur | Plafond ~**40 offres notées** par recherche (paramètre de la config) |
| Profil de recherche & scoring | **Config par défaut = Hariss**, mais **entièrement paramétrable** : tous les paramètres (adresse, postes visés, modes de transport, filtres, seuils) vivent dans une **structure typée unique passée en argument** — jamais en dur dans la logique. Cf. §3.1 et §7. |
| Jonction | « Adapter mon CV » pré-remplit `TailorModal` via le store |
| Quota Gemini (429) | **Arrêt propre** du scan (garder les offres déjà notées + message), pas de retry bloquant |

> **Principe directeur (demande explicite 2026-07-01) :** écrire le code dès maintenant
> **adaptable et prêt pour le multi-utilisateur**, sans rigidité. Aucune valeur métier codée en dur
> dans les fonctions ; tout passe par un objet de configuration (`JobSearchProfile`). Aujourd'hui,
> une seule instance par défaut (Hariss) ; demain, une config par compte, sans refonte du cœur.
> ⚠️ **Ne PAS** implémenter le multi-utilisateur / l'UI de réglages / les comptes maintenant (YAGNI) —
> seulement structurer pour que ce soit un simple branchement plus tard.

**Pourquoi Option A :** Vercel = fonctions serverless courtes et sans filesystem persistant. Un
thread de fond + SQLite (comme le plan Flask) est impossible. Découper en petits appels pilotés
par le client contourne les limites de durée, rend le scan résilient (une offre qui échoue
n'interrompt pas le reste) et garde les données locales (cohérent avec le reste de l'app).

## 3. Architecture

### 3.1 Modules de logique — `web/src/lib/jobs/`
Isolés et **paramétrables** : le profil et les clés sont **passés en argument**, jamais lus en dur
au cœur des fonctions. C'est le socle de l'évolution SaaS (cf. §7).

**`profile.ts` — la structure de configuration (pièce centrale de la paramétrabilité)**
Définit le type `JobSearchProfile` qui regroupe **tous** les paramètres modifiables :

```ts
type CommuteMode = "transit" | "driving" | "bicycling" | "walking";

interface JobSearchProfile {
  homeAddress: string;          // adresse de départ pour le trajet
  keywords: string[];           // postes visés (intitulés recherchés)
  commuteModes: CommuteMode[];  // modes de transport à calculer
  contractTypes: string[];      // ex. ["CDI", "CDD"]
  region: string;               // code région France Travail (ex. "11" = IdF)
  maxAgeDays: number;           // ancienneté max des offres
  excludedWords: string[];      // filtre stages/alternances…
  minScore: number;             // seuil de rétention (défaut 70)
  scoreLimit: number;           // plafond d'offres notées / recherche (défaut 40)
  maxDescriptionChars: number;  // troncature description
  candidateSummary: string;     // profil candidat injecté dans le prompt de scoring
  scoringCriteria: string;      // barème (tech/séniorité/secteur/géo/red flags)
}
```

Et exporte **une seule instance par défaut**, `DEFAULT_PROFILE` (valeurs de Hariss, reprises du
bot : 28 intitulés SEO/web, « 4 rue jean bouton 75012 Paris », `["transit","bicycling"]`,
`["CDI","CDD"]`, région `"11"`, 30 jours, mots exclus stages/alternances, `minScore 70`,
`scoreLimit 40`, résumé candidat + barème). C'est **la future "config utilisateur"** ; aujourd'hui
il n'y en a qu'une. Aucune de ces valeurs n'est dupliquée ailleurs.

**Fonctions (toutes prennent le profil — ou ses sous-parties — en argument) :**
- `francetravail.ts` — `getToken(clientId, clientSecret)` ; `fetchOffers(token, keyword, profile)`
  (recherche paramétrée par `region`/`contractTypes`/`maxAgeDays`, `natureContrat=E1`, `range=0-99`) ;
  `isExcluded(offer, profile.excludedWords)` ; `mapOffer(offer, profile)` → objet carte.
- `maps.ts` — `getCommuteTimes(destination, profile, key)` : Google Maps Distance Matrix depuis
  `profile.homeAddress` pour chaque mode de `profile.commuteModes`. Retourne un dict `{ [mode]: durée }`.
  Port de `get_commute_times` (`agent-taff/bot.py`), généralisé à la liste de modes.
- `score.ts` — `scoreOffer(offer, commute, profile, key)` : construit le système de scoring à partir
  de `profile.candidateSummary` + `profile.scoringCriteria` (au lieu d'un prompt figé) et appelle
  Gemini avec un **response schema JSON** structuré → `{ score_tech, score_seniority, score_sector,
  score_geo, score_red_flags, total_score, red_flags_reasons }`.

> Le scoring exige un appel Gemini avec `response_schema` structuré. `lib/ai/clients.ts` expose
> déjà l'accès Gemini (`@google/genai`) ; prévoir un helper `completeJson(schema, system, prompt)`
> (nouveau ou extension) plutôt que de dupliquer la création du client.

### 3.2 Routes API — `web/src/app/api/jobs/`
Toutes en `export const runtime = "nodejs"` ; lisent les clés via `process.env`.

- `POST /api/jobs/search` — appelée 1 fois par recherche. Résout le profil (**aujourd'hui
  `DEFAULT_PROFILE`** ; demain : profil du compte). Obtient le token FT, interroge l'API pour chaque
  `keyword` du profil, agrège, applique `isExcluded`, dédoublonne par `id`, tronque les descriptions.
  Réponse : `{ offers: [{ id, title, company, location, url, jobText }] }`. Si clés FT manquantes →
  400 `{ error: "config", message }`.
- `POST /api/jobs/score` — appelée en boucle (1 offre). Body `{ offer }`. Résout le profil (idem),
  calcule le trajet (Maps) puis le score (Gemini). Réponse `{ score, breakdown, commute }`. 429 quota
  Gemini → statut 429 distinct pour que le client arrête proprement. Clés Maps/Gemini manquantes → 400 `config`.

> **Point d'extension multi-utilisateur :** les deux routes passent par un helper `resolveProfile(req)`
> qui renvoie `DEFAULT_PROFILE` aujourd'hui. Demain, il lira le profil du compte (ou du body) — les
> modules `lib/jobs/` n'ont pas à changer, ils reçoivent déjà le profil en argument.

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
- **Ambition SaaS (hors périmètre v1, à ne pas fermer).** Ce qui deviendra paramétrable par
  utilisateur — **déjà prévu dans `JobSearchProfile`** (§3.1), donc sans refonte du cœur :
  - **adresse de départ** pour le trajet (`homeAddress`) ;
  - **postes visés** (`keywords`) ;
  - **modes de transport** voiture / vélo / à pied / transports (`commuteModes`) ;
  - **filtres** : type de contrat, région/zone, ancienneté, mots exclus, seuil de score, plafond ;
  - **profil candidat & barème** de scoring (`candidateSummary`, `scoringCriteria`).
  - À ajouter côté infra le moment venu : **auth réelle + stockage du profil par compte**, et
    **clés par utilisateur** (ne pas servir tout le monde avec celles de Hariss) — via `resolveProfile`
    et l'injection de clés déjà en place. Aucune de ces évolutions ne requiert de réécrire `lib/jobs/`.
  - ⚠️ **Rien de tout ça n'est implémenté en v1** (pas d'UI de réglages, pas de comptes) : on
    structure seulement pour que ce soit un branchement, pas une réécriture.

## 8. Tests
- **Unitaires (Vitest) :** `isExcluded` (stages/alternances), dédoublonnage, respect du plafond 40,
  `mapOffer` (offre FT brute → carte), parsing/bornage du score, fonctions Dexie `jobs` (mock).
- **E2E (Playwright, serveur mocké) :** recherche → une carte notée s'affiche ; « Adapter mon CV »
  ouvre `TailorModal` pré-remplie ; « Masquer » retire la carte ; écran `config` si clés absentes.

## 9. Hors périmètre v1
Recherche planifiée/automatique ; profil modifiable ; base de données en ligne ; multi-utilisateur ;
notation basée sur le CV chargé (profil figé) ; routage MongoDB.
