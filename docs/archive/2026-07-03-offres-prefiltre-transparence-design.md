# Spec — Pré-filtre hybride (économie IA) & transparence de la grille de notation (onglet Offres)

## Contexte

L'onglet Offres note chaque offre **sur 100 via l'IA** (`gemini-3.1-flash-lite`) selon une grille
à 5 critères. Deux manques :

1. **Opacité** — l'utilisateur ne voit nulle part *comment* le score est attribué ni le seuil de
   sélection. Il veut que la grille soit visible sur la page Offres.
2. **Coût IA** — chaque offre retenue par France Travail consomme un appel IA (plafond actuel : 40
   par recherche). Beaucoup de ces offres, bien qu'ayant matché un intitulé, collent mal au profil
   et ne méritent pas un appel IA.

Objectif : **(A)** afficher la grille sur la page Offres (encart dépliable) et **(B)** insérer un
**pré-filtre par mots-clés** (gratuit, sans IA) qui classe les offres et n'envoie que les meilleures
à l'IA (« Équilibré »).

**Contrainte transverse (validée avec l'utilisateur) :** préparer le multi-utilisateur. **Rien en
dur** dans les composants ou la logique — tous les réglages (grille, mots-clés, seuils, plafonds)
vivent dans le `JobSearchProfile`, résolu par `resolveProfile` (déjà l'unique point d'extension
SaaS). La grille affichée dérive **de la même donnée** que le prompt de l'IA.

Tout est dans `web/`. Aucune dépendance ajoutée. Pas de couleur en dur (variables de thème).

## Principe directeur : une seule source de vérité, portée par le profil

Aujourd'hui `profile.scoringCriteria` est une **chaîne** libre injectée dans le prompt. Elle devient
une **structure**, qui alimente à la fois :
- le **prompt IA** (`score.ts` reconstruit le texte à partir de la structure — comportement
  identique à l'actuel) ;
- l'**encart de transparence** (rendu depuis la même structure).

Ainsi, changer la grille d'un profil met à jour prompt **et** affichage sans divergence, et chaque
utilisateur verra sa propre grille.

## Modèle cible du profil — `web/src/lib/jobs/profile.ts`

```ts
export interface ScoringCriterion {
  key: string;         // "tech" | "seniority" | "sector" | "geo" | "red_flags" (→ score_<key>)
  label: string;       // "Technique"        (affichage)
  max: number;         // 40                 (barème + prompt)
  description: string; // "Match avec ta stack (CMS, intégration, SEO, analytics)."
}
```

Champs de `JobSearchProfile` :
- `scoringCriteria: ScoringCriterion[]` — **remplace** l'actuelle chaîne. Les 5 critères existants,
  mêmes libellés/plafonds/descriptions (Technique 40, Séniorité 20, Secteur 15, Géo 15, Pièges 10).
- `prefilterKeywords: string[]` — **nouveau**. Compétences cœur du candidat pour le pré-tri
  (ex. `["seo","référencement","wordpress","drupal","cms","éditorial","contenu","rédaction","sea",
  "google ads","analytics","webmaster","digital","e-commerce","shopify","community"]`, en minuscules).
- `aiShortlist: number` — **nouveau, remplace `scoreLimit`**. Nombre max d'offres envoyées à l'IA
  par recherche. Défaut **20** (contre 40).
- `candidateSummary: string` — inchangé (texte libre propre à chaque profil, déjà non figé).
- Reste (`homeAddress`, `keywords`, `minScore`, `maxDescriptionChars`, …) inchangé.

## Étapes

### 1. Profil structuré — `web/src/lib/jobs/profile.ts`
- Ajouter l'interface `ScoringCriterion`.
- `JobSearchProfile` : `scoringCriteria: ScoringCriterion[]` ; ajouter `prefilterKeywords: string[]`
  et `aiShortlist: number` ; supprimer `scoreLimit`.
- `DEFAULT_PROFILE` : convertir les 5 critères en tableau (mêmes valeurs), renseigner
  `prefilterKeywords`, `aiShortlist: 20`.

### 2. Prompt reconstruit depuis la structure — `web/src/lib/jobs/score.ts`
- Nouvelle fonction **pure exportée** `criteriaPromptLines(criteria: ScoringCriterion[]): string`
  → `"score_tech (0-40) : …\nscore_seniority (0-20) : …\n…"` (reproduit le texte actuel).
- `scoreOffer` : construire `system` avec `criteriaPromptLines(profile.scoringCriteria)` au lieu de
  `profile.scoringCriteria`. Aucun autre changement (schéma de sortie et parsing inchangés).

### 3. Fonction de pré-filtre (pure) — `web/src/lib/jobs/prefilter.ts` (nouveau)
```ts
/** Pertinence mots-clés d'une offre (titre ×2 + description ×1). 0 = aucun recoupement. */
export function relevance(
  offer: { title: string; jobText: string },
  keywords: string[],
): number
```
- Compare en minuscules ; compte les `keywords` présents dans le titre (poids 2) et la description
  (poids 1). Somme simple. Aucune dépendance, aucun appel réseau/IA.

### 4. Résolution du profil côté page serveur — `web/src/lib/jobs/resolveProfile.ts`
- Rendre le paramètre optionnel : `resolveProfile(req?: Request)`. Comportement identique
  (retourne `DEFAULT_PROFILE`). Permet à la page serveur de résoudre le profil sans objet `Request`.
  Reste l'unique point d'extension multi-utilisateur.

### 5. La page Offres passe la config au client — `web/src/app/jobs/page.tsx`
- Résoudre `const profile = resolveProfile();`.
- Construire une projection **sérialisable** et passer en props :
  ```tsx
  <JobsView
    config={{
      minScore: profile.minScore,
      aiShortlist: profile.aiShortlist,
      prefilterKeywords: profile.prefilterKeywords,
      criteria: profile.scoringCriteria.map(({ label, max, description }) => ({ label, max, description })),
    }}
  />
  ```
- La page reste un composant serveur (pas de `"use client"`), donc la config est rendue côté serveur
  et deviendra automatiquement par-utilisateur quand `resolveProfile` lira la session.

### 6. Orchestrateur — `web/src/components/jobs/JobsView.tsx`
- Signature : `JobsView({ config }: { config: JobsConfig })` où
  `JobsConfig = { minScore: number; aiShortlist: number; prefilterKeywords: string[];
  criteria: { label: string; max: number; description: string }[] }`.
- La config vient **des props** (plus de `scoreLimit`/`minScore` lus depuis la réponse de recherche).
- Boucle de scan (après dédoublonnage → `fresh`) :
  1. `const ranked = fresh.map(o => ({ o, r: relevance(o, config.prefilterKeywords) }))
       .filter(x => x.r > 0)               // écarte les offres à recoupement nul (garde-fou)
       .sort((a, b) => b.r - a.r)
       .map(x => x.o);`
  2. `const toScore = ranked.slice(0, config.aiShortlist);` (les offres au-delà ne sont pas notées
     ce tour-ci ; **non marquées en base** → elles pourront ressortir à une recherche ultérieure).
  3. Boucle IA inchangée ; seuil = `config.minScore` ; sous le seuil → `saveExplored` (inchangé).
- Rendre l'encart `<ScoringInfo criteria={config.criteria} minScore={config.minScore} />` en haut de
  la vue (au-dessus de la barre d'outils).

### 7. Réponse de recherche allégée — `web/src/app/api/jobs/search/route.ts`
- La réponse ne renvoie plus la config : `return NextResponse.json({ offers });`
  (elle transite désormais par les props serveur). Le profil reste résolu **en interne** pour la
  requête France Travail (inchangé).

### 8. Encart de transparence — `web/src/components/jobs/ScoringInfo.tsx` (nouveau)
- Élément **natif** `<details className="scoring-info">` (replié par défaut) :
  - `<summary>` : « Comment les offres sont-elles notées ? »
  - Phrase : « Un pré-tri par mots-clés écarte les offres hors-sujet, puis une IA (jouant le rôle
    d'un recruteur) note les autres sur 100 selon cette grille. »
  - **Tableau** rendu depuis `criteria` (colonnes : Critère = `label`, Points = `0–{max}`,
    Ce que ça mesure = `description`).
  - Ligne finale : « Seuil de sélection : **{minScore}/100**. »
- Aucune donnée en dur : tout vient des props.

### 9. Styles — `web/src/app/globals.css`
- `.scoring-info` (encart), `.scoring-info__table` (grille). Variables de thème uniquement
  (`--bg`, `--text`, `--muted`, `--border`, `--orange`…).

### 10. Tests
- **Unitaires (Vitest, aucune dépendance ajoutée — fonctions pures) :**
  - `prefilter.test.ts` : `relevance` compte le titre ×2 + description ×1 ; renvoie 0 sans
    recoupement ; insensible à la casse.
  - `score.test.ts` (existant) : `criteriaPromptLines(DEFAULT_PROFILE.scoringCriteria)` produit les
    lignes attendues (`score_tech (0-40) : …`, etc.) — garantit que la structure alimente bien le prompt.
- **e2e `web/tests/e2e/jobs.spec.ts`** (mocks) :
  - Adapter le mock `/api/jobs/search` à la **nouvelle forme** `{ offers }` (sans `scoreLimit`/`minScore`).
    Le seuil (70) et `aiShortlist` (20) proviennent du vrai `DEFAULT_PROFILE` via le rendu serveur.
    L'offre mockée (« Webmaster SEO »/WordPress) a une pertinence > 0 → toujours notée et retenue :
    les tests existants restent valides.
  - Nouveau : une 2ᵉ offre **sans recoupement** (titre/description sans aucun `prefilterKeyword`)
    ajoutée au mock **n'est pas notée** (aucun `POST /api/jobs/score` pour elle, une seule carte).
  - Nouveau : l'encart « Comment les offres sont-elles notées ? » est présent et **s'ouvre** au clic,
    affichant la grille (ex. « Technique » et « 0–40 »).

## Réutilisation (existant)
- `resolveProfile` — point d'extension multi-utilisateur (rendu param-optionnel).
- `saveJob`/`jobExists`/`listJobs`/`setJobStatus`/`saveExplored`/`markJobSeen` — `lib/storage/db.ts`.
- Schéma de sortie IA + parsing (`SCORE_SCHEMA`, `parseAiJson`) — `score.ts` (inchangés).
- Calcul de trajet (Google Maps) — déjà hors IA, inchangé.

## Vérification
1. Local, dans `web/` : `npx tsc --noEmit && npm run lint && npm run test && npm run build && npm run test:e2e` → vert.
2. Prod (`https://cv-tailor-drab-rho.vercel.app/jobs`) : l'encart « Comment les offres sont-elles
   notées ? » s'ouvre et affiche les 5 critères + le seuil ; une recherche envoie **≤ 20** offres à
   l'IA (vérifiable via l'indicateur de progression « notées ») et les offres sans recoupement ne
   sont pas notées.

## Critères de succès
- Grille visible sur la page Offres, **dérivée du profil** (pas de tableau en dur).
- `scoringCriteria` structuré = source unique prompt IA + encart.
- Pré-filtre « Équilibré » opérationnel : tri par pertinence, offres à recoupement nul écartées,
  plafond IA à `aiShortlist` (20). Réduction nette des appels IA sur une première recherche.
- Tous les réglages dans le profil ; `tsc`/`lint`/tests/build/e2e verts.

## Hors périmètre
- Interface de réglage utilisateur (éditer sa grille/ses mots-clés depuis l'UI) : viendra avec le
  multi-utilisateur.
- Pré-filtre « agressif » à seuil strict, ou pondérations mots-clés avancées (synonymes, TF-IDF).
- Persistance des offres pré-filtrées (elles restent volontairement non marquées en base).
