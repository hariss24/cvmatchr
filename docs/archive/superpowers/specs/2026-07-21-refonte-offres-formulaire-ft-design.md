# Spec — Refonte page « Offres » : formulaire de recherche pro aligné France Travail

> **Objectif** : remplacer le profil de recherche codé en dur (celui de Hariss)
> par un **formulaire de recherche riche et paramétrable**, dont les champs sont
> mappés sur les vrais paramètres de l'API France Travail
> (`offresdemploi/v2/offres/search`). Qualité visée : outils pros type
> Indeed / LinkedIn / **France Travail**.
>
> **Hors périmètre** : comptes utilisateurs + base serveur (Supabase). Ce chantier
> reste décrit dans `docs/archive/superpowers/plans/2026-07-21-refonte-offres-multi-utilisateur.md`
> (Phase 2). Le présent spec correspond à une **Phase 1 enrichie** et se termine
> sur un point d'extension propre (profil dans le corps de requête) qui permettra
> de brancher les comptes plus tard sans re-toucher le cœur.

## Décisions validées (brainstorming 2026-07-21)

1. Périmètre = **formulaire FT pro d'abord**, multi-utilisateur différé.
2. Champ **métier/poste** = texte libre (tags), **pas** d'autocomplétion ROME.
   Codes ROME saisis à la main en section avancée (optionnel).
3. Champ **lieu** = **autocomplétion** commune / ville / région (via
   `geo.api.gouv.fr`, codes INSEE compatibles FT) **+ rayon** en km.
4. **Salaire min** = inclus, en section avancée.
5. Toutes les données personnelles de Hariss sortent du code source.

## État actuel (constat)

- `web/src/lib/jobs/profile.ts` : `DEFAULT_PROFILE` = profil de Hariss en dur
  (adresse 75012, 29 mots-clés de poste, région « 11 », mots exclus, barème,
  résumé candidat, seuils).
- `web/src/lib/jobs/resolveProfile.ts` : point d'extension prévu — retourne
  toujours `DEFAULT_PROFILE`. Il accepte déjà un argument `req` (inutilisé
  aujourd'hui).
- `web/src/lib/jobs/francetravail.ts` : `fetchOffers` ne construit que 5
  paramètres FT — `motsCles`, `region`, `typeContrat`, `natureContrat=E1`,
  `minCreationDate` / `maxCreationDate`, `range=0-99`.
- `web/src/components/jobs/JobsView.tsx` : orchestrateur du scan. Reçoit `config`
  (seuils, barème) via props serveur ; envoie `body: "{}"` à
  `POST /api/jobs/search`. Aucun champ de saisie de critères.
- `web/src/app/jobs/page.tsx` : appelle `resolveProfile()` (serveur) et passe une
  `config` réduite à `JobsView`.
- Le cœur (`prefilter.ts`, `score.ts`, `maps.ts`) reçoit déjà le **profil en
  argument** → inchangé.
- Persistance : IndexedDB (Dexie), `web/src/lib/storage/db.ts`.

---

## 1. Modèle de profil enrichi (`lib/jobs/profile.ts`)

### 1.1 Champs — table de correspondance FT

| Besoin utilisateur | Champ `JobSearchProfile` | Paramètre FT `offres/search` |
|---|---|---|
| Postes recherchés | `keywords: string[]` (existant) | `motsCles` (1 requête par entrée) |
| Débutant accepté | `debutantAccepte: boolean` | `experienceExige = "D"` (Débutant accepté) |
| Niveau d'expérience | `experienceLevel: "" \| "1" \| "2" \| "3"` | `experience` (‑1 an / 1‑3 ans / +3 ans) |
| Zone géographique | `location: LocationFilter` (voir 1.2) | `commune`+`distance` **ou** `departement` **ou** `region` |
| Cadre / non-cadre | `qualification: "" \| "0" \| "9"` | `qualification` (0 = non-cadre, 9 = cadre) |
| Temps plein / partiel | `tempsPlein: "" \| "true" \| "false"` | `tempsPlein` |
| Type de contrat | `contractTypes: string[]` (existant) | `typeContrat` (CDI, CDD, MIS, SAI…) |
| Mots-clés à inclure | `includeKeywords: string[]` | **filtre serveur** sur titre+description (précision) |
| Compétences (pré-tri) | `prefilterKeywords: string[]` (existant) | pré-tri gratuit local |
| Codes ROME (avancé) | `romeCodes: string[]` | `codeROME` |
| Mots exclus | `excludedWords: string[]` (existant) | filtre local (existant) |
| Ancienneté | `maxAgeDays: number` (existant) | `minCreationDate` / `maxCreationDate` |
| Salaire min (avancé) | `salaireMin: number \| null` + `periodeSalaire: "M" \| "A" \| "H"` | `salaireMin` + `periodeSalaire` |
| Adresse (trajet) | `homeAddress: string` (existant) | Google Distance Matrix (existant) |
| Modes de transport | `commuteModes: CommuteMode[]` (existant) | Google Distance Matrix (existant) |
| Scoring IA | `candidateSummary`, `scoringCriteria[]`, `minScore`, `aiShortlist`, `maxDescriptionChars` (existants) | — (prompt IA) |

Le champ `region: string` actuel est **remplacé** par `location: LocationFilter`.

### 1.2 Type `LocationFilter`

```ts
export type LocationKind = "commune" | "departement" | "region";

export interface LocationFilter {
  kind: LocationKind;
  code: string;   // code INSEE (commune 5 chiffres, département, région)
  label: string;  // libellé affiché, ex. "Paris (75012)" / "Île-de-France"
  radiusKm: number; // rayon, appliqué seulement si kind === "commune"
}
```

- `kind === "commune"` → paramètres FT `commune=<code>` + `distance=<radiusKm>`.
- `kind === "departement"` → `departement=<code>`.
- `kind === "region"` → `region=<code>`.
- `code` vide → aucun filtre géographique envoyé (recherche nationale).

### 1.3 Validation (Zod) et défauts neutres

- Créer `jobSearchProfileSchema` (Zod) validant un `JobSearchProfile` complet.
- `DEFAULT_PROFILE` devient `EMPTY_PROFILE` avec des **défauts neutres** :
  - `keywords: []`, `includeKeywords: []`, `romeCodes: []`,
    `excludedWords: ["alternan", "apprenti", "stagiaire", "professionnalisation", "cfa"]`
    (filtre stage/alternance générique, non personnel → conservé),
  - `location: { kind: "commune", code: "", label: "", radiusKm: 10 }`,
  - `contractTypes: ["CDI", "CDD"]`, `debutantAccepte: false`,
    `experienceLevel: ""`, `qualification: ""`, `tempsPlein: ""`,
  - `salaireMin: null`, `periodeSalaire: "M"`,
  - `maxAgeDays: 30`, `minScore: 70`, `aiShortlist: 20`, `maxDescriptionChars: 3000`,
  - `homeAddress: ""`, `commuteModes: ["transit", "bicycling", "walking"]`,
  - `candidateSummary: ""`, `prefilterKeywords: []`,
  - `scoringCriteria`: barème **générique** (garder la structure actuelle mais
    des libellés neutres : Technique / Séniorité / Secteur / Géo / Pièges).
- Le profil de Hariss est déplacé en fixture de test :
  `web/tests/fixtures/job_profile_hariss.json` (repris à l'identique des valeurs
  actuelles + nouveaux champs remplis : `location` = commune Paris 75112/75056 +
  rayon, `debutantAccepte: true`, etc.).

---

## 2. Autocomplétion du lieu

### 2.1 Source de données

`geo.api.gouv.fr` — API publique (sans authentification), renvoie des **codes
INSEE compatibles France Travail**.

- Communes/villes : `GET https://geo.api.gouv.fr/communes?nom=<q>&fields=nom,code,codeDepartement,codesPostaux&boost=population&limit=10`
- Régions : `GET https://geo.api.gouv.fr/regions?nom=<q>`
- Départements : `GET https://geo.api.gouv.fr/departements?nom=<q>` (optionnel).

### 2.2 Route proxy

`GET /api/jobs/locations?q=<texte>` (Next.js, runtime nodejs) :
- interroge `geo.api.gouv.fr` (communes + régions),
- renvoie une liste fusionnée `{ kind, code, label }[]` triée (communes d'abord,
  boostées population),
- format `label` commune : `"<nom> (<codePostal principal>)"`.

Motif : ne pas exposer d'appel tiers direct depuis le client, garder un point
unique et testable, permettre le cache/tuning plus tard. Aucune donnée sensible.

### 2.3 Composant

`components/jobs/LocationInput.tsx` : champ texte + liste déroulante de
suggestions (debounce ~250 ms). À la sélection, remplit `location.kind/code/label`.
Champ **rayon** (`radiusKm`, number, défaut 10) visible uniquement si
`kind === "commune"`.

---

## 3. Transport vers les API et construction des paramètres FT

### 3.1 `fetchOffers` (francetravail.ts)

Étendre la construction de `URLSearchParams` à partir du profil :
- géo conditionnelle selon `location.kind` (voir 1.2) ;
- `experienceExige = "D"` si `debutantAccepte` ;
- `experience` si `experienceLevel !== ""` ;
- `qualification` si `!== ""` ;
- `tempsPlein` si `!== ""` ;
- `typeContrat = contractTypes.join(",")` (existant) ;
- `codeROME = romeCodes.join(",")` si non vide ;
- `salaireMin` + `periodeSalaire` si `salaireMin != null` ;
- `natureContrat="E1"`, dates, `range` (existants).

> **Tâche de vérification obligatoire avant de coder cette fonction** : confirmer
> les **noms et valeurs exacts** des paramètres contre la doc officielle
> `https://francetravail.io/data/api/offres-emploi` (référence « Rechercher par
> critères »). Points à valider en priorité : `distance` vs `rayon`,
> `experienceExige` (codes D/S/E) vs `experience` (1/2/3), `qualification`
> (0/9), `tempsPlein` (booléen), `periodeSalaire` (M/A/H), et les limites
> (nombre max de `codeROME`, de communes).

### 3.2 Filtre serveur `includeKeywords`

Dans `api/jobs/search/route.ts`, après `mapOffer`, écarter toute offre dont le
titre + description (minuscule, sans accents) ne contient **pas** au moins un des
`includeKeywords` (si la liste est non vide). Donne la précision « le mot doit
apparaître » que `motsCles` (fuzzy) ne garantit pas.

### 3.3 Profil dans le corps de requête

- `POST /api/jobs/search` et `POST /api/jobs/score` acceptent le profil **dans le
  corps** (`{ profile, offer? }`), validé par `jobSearchProfileSchema`.
- `resolveProfile(req)` : lit et valide le corps, applique les défauts neutres.
  (Point d'extension : plus tard, lira la session utilisateur.)
- `JobsView` envoie le profil chargé depuis Dexie à chaque appel.

### 3.4 Persistance locale

- Table Dexie `jobProfile` (une seule ligne) dans `lib/storage/db.ts` +
  `getJobProfile()` / `saveJobProfile()`.

---

## 4. Formulaire (`components/jobs/ProfileForm.tsx`)

Panneau « Mes critères de recherche » en tête de la page Offres, design system
existant (variables CSS, jamais de couleur en dur ; réutiliser chips/segmented/
toggles déjà présents dans l'atelier).

### 4.1 Disposition

- **Ligne primaire** : `Poste(s) recherché(s)` (input tags) · `Lieu`
  (`LocationInput` + rayon) · bouton **Chercher**.
- **Filtres rapides** (chips / segmented / toggles) : Type de contrat (multi) ·
  toggle **Débutant accepté** · Expérience (select) · Temps plein/partiel ·
  Cadre/non-cadre · Ancienneté (select : 1/3/7/14/31 j → `maxAgeDays`).
- **Section « Avancé »** (repliée par défaut) : mots-clés à inclure (tags) · mots
  exclus (tags) · compétences pré-tri (tags) · codes ROME (tags) · salaire min +
  période · barème de notation (liste éditable label/max/description) · résumé
  candidat (textarea) · seuils (`minScore`, `aiShortlist`, `maxDescriptionChars`).

### 4.2 État vide et garde

- Bouton **Chercher** désactivé tant que (`keywords.length >= 1` **et**
  `location.code !== ""`) n'est pas satisfait.
- Si aucun profil enregistré : message d'invite à renseigner poste + lieu.
- Sauvegarde **automatique** dans Dexie à chaque modification (debounce léger,
  pas de bouton « Enregistrer »).

### 4.3 Intégration `JobsView` / `page.tsx`

- `page.tsx` ne pré-résout plus le profil de Hariss ; `JobsView` charge le profil
  depuis Dexie (client) et le passe aux appels API.
- `ScoringInfo` continue d'afficher le barème, alimenté par le profil courant.

---

## 5. Découpage en missions (workflow Gemini)

| Mission | Contenu | Dépend de |
|---|---|---|
| **M1** | Schéma Zod + type `LocationFilter` + `EMPTY_PROFILE` neutre + fixture `job_profile_hariss.json` + adaptation des tests (`score.test.ts`, `francetravail.test.ts`) | — |
| **M2** | `fetchOffers` étendu (tous les nouveaux paramètres FT) **après** vérif doc FT + filtre serveur `includeKeywords` | M1 |
| **M3** | Profil dans le corps des requêtes (`resolveProfile(req)` + validation) + table Dexie `jobProfile` + envoi depuis `JobsView` | M1 |
| **M4** | Route `GET /api/jobs/locations` (proxy `geo.api.gouv.fr`) + `LocationInput.tsx` | — |
| **M5** | `ProfileForm.tsx` complet (disposition, filtres, avancé, état vide) + intégration `JobsView`/`page.tsx` | M2, M3, M4 |

---

## 6. Critères de succès (vérifiables)

1. `grep -ri "hariss\|jean bouton" web/src` → **zéro résultat**.
2. Un utilisateur peut saisir poste(s) + lieu (autocomplété) + filtres et lancer
   un scan sans toucher au code.
3. Les paramètres FT envoyés correspondent aux champs saisis (vérifiable en
   inspectant l'URL construite dans un test unitaire de `fetchOffers`).
4. Lieu : taper « Paris » → suggestions → sélection → `commune`+`distance`
   envoyés ; taper « Île-de-France » → `region=11`.
5. Débutant accepté coché → `experienceExige=D` présent ; décoché → absent.
6. Recharger la page → critères conservés (Dexie).
7. `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` **verts**.

## 7. Risques / points d'attention

- **Noms de paramètres FT** : ne pas coder `fetchOffers` avant la vérif doc
  officielle (M2). C'est le principal risque de qualité.
- **Ne pas casser les tests** qui importent `DEFAULT_PROFILE` → migrer vers la
  fixture Hariss.
- **Adresse = donnée sensible** : ne jamais la logger ni l'envoyer à l'IA au-delà
  du prompt de scoring existant.
- **Next.js (version du repo)** : relire `node_modules/next/dist/docs/` avant tout
  code de route/handler (cf. `web/AGENTS.md`, breaking changes vs entraînement).
- **`geo.api.gouv.fr`** : pas d'auth, mais prévoir un fallback silencieux (liste
  vide) si l'API est indisponible — l'utilisateur peut toujours saisir/retenir un
  libellé même sans suggestion (mais alors `code` vide → recherche nationale).
- **Pipeline JSON/react-pdf** : ce chantier ne touche pas au rendu document ;
  ne pas déclencher les pièges `docStore.html`.
