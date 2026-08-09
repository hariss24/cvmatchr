# Import CV : ne plus perdre les sections non standard

**Date :** 2026-07-12
**Statut :** validé, prêt à implémenter

## Problème

À l'import d'un PDF, un CV contenant « Hard skills » **et** « Soft skills » voit
ses deux sections fusionnées dans le seul champ `skills`. Plus généralement,
toute section du CV source qui ne correspond pas exactement à un champ du modèle
est soit mal rangée, soit perdue.

## Cause racine

`RESUME_SCHEMA_DESC` (`lib/ai/prompts.ts`) est la fiche de schéma envoyée à l'IA.
C'est une **copie manuelle** du vrai modèle (`lib/resume/schema.ts`), et elle a
dérivé : elle ne mentionne ni `softSkills` ni `tools`, alors que ces champs
existent dans le schéma Zod, dans `normalizeResume`, dans `FormEditor` et dans le
modèle Marine. L'IA ne peut pas remplir une case dont on ne lui a jamais parlé :
elle entasse tout dans `skills`.

La même fiche est partagée par 4 systèmes (`SYSTEM_PDF_TO_RESUME`,
`SYSTEM_TEXT_TO_RESUME`, `SYSTEM_TAILOR_RESUME_BASE`, `..._INVENT`) : la dérive
les dégrade tous d'un coup.

## Solution

### 1. Resynchroniser la fiche IA + empêcher la dérive de revenir

- Ajouter `softSkills` et `tools` à `RESUME_SCHEMA_DESC`.
- Ajouter des règles de tri explicites (technique → `skills`, savoir-être →
  `softSkills`, logiciels/technos → `tools`). Sans elles, l'IA continue de mélanger.
- **Test garde-fou** : toute clé de `resumeSchema.shape` (hors `photo`, jamais
  envoyée à l'IA) doit apparaître dans `RESUME_SCHEMA_DESC`. Le test échoue si le
  modèle et la fiche divergent → la classe de bug entière devient impossible à
  réintroduire en silence.

### 2. Sections libres (`customSections`)

Nouveau champ, forme volontairement minimale — *un titre + une liste de lignes* :

```ts
customSections: [{ title: string; items: string[] }]
```

Cette forme est choisie parce qu'elle épouse des briques déjà présentes :
`StringListSection` (formulaire) et `SectionTitle` + `Bullets` (PDF). Aucune
mécanique nouvelle à inventer.

- **Extraction** : toute section sans case standard y va, avec son titre d'origine.
  Contre-règle indispensable : *n'utiliser `customSections` que si aucun champ
  standard ne convient* (sinon l'IA y déverserait les compétences).
- **Rendu** : bas de la colonne principale, dans les 4 modèles (Sobre, Marine,
  Kakuna, Graphique) — les sections à contenu long ont besoin de largeur.
- **Formulaire** : titre renommable, lignes ajoutables/supprimables, section
  supprimable.
- **Anti-effacement** : `mergeTailored` restaure `customSections` depuis la base si
  l'IA les a vidées lors d'une adaptation à une offre (même protection que
  `projects` / `certifications` / `volunteer`).

## Critères de succès

1. Import d'un CV « Hard skills » + « Soft skills » → deux champs distincts remplis.
2. Import d'un CV avec « Publications » → section libre créée, titre conservé.
3. Le test garde-fou échoue si on retire un champ de la fiche IA (vérifié en le
   cassant volontairement).
4. `lint` + `tsc` + Vitest + Playwright au vert.

## Hors périmètre

- Migration Dexie : le CV est stocké en JSON et Zod applique `[]` par défaut, les
  CV existants s'ouvrent sans migration. À confirmer à l'exécution.
- Réordonnancement des sections libres (drag & drop) : non demandé.
