# Plan post-audit — retrait du legacy HTML, sur-mesure, white-fonting, durcissement

> **Pour agents d'exécution :** exécuter les missions **dans l'ordre**, une par une.
> Chaque mission est un fichier autonome dans ce dossier. Après chaque mission :
> vérification complète (voir protocole ci-dessous) puis commit. Ne jamais commencer
> une mission si la précédente laisse la vérification rouge.

**Objectif :** appliquer les décisions de l'audit du 17/07/2026 — supprimer le
pipeline HTML legacy (mode expert HTML obsolète), retirer le niveau d'adaptation
« sur-mesure » et le « Booster ATS invisible » (white-fonting), purger les
anciennes données HTML d'IndexedDB, fusionner la CI et durcir le scraper.

**Architecture :** l'app est 100 % pipeline JSON → react-pdf depuis la migration.
La couche `html`/`css`/`htmlSource` du `docStore` et la route `/api/tailor` sont
des vestiges sans appelant côté client (vérifié : aucun composant n'appelle
`/api/tailor`). Les missions suppriment d'abord le serveur (sans risque), puis le
niveau sur-mesure, puis l'atsBoost, puis le state client + stockage, enfin la CI
et le durcissement réseau.

**Stack :** Next.js 16 (App Router) · React 19 · TypeScript strict · Zustand ·
Dexie/IndexedDB · Vitest · Playwright.

## Contraintes globales (chaque mission les inclut implicitement)

- Tout le code vit dans `web/`. Chemins des missions relatifs à la racine du dépôt.
- Jamais `alert`/`confirm`/`prompt` natifs — uniquement `uiAlert`/`uiConfirm`/`uiPrompt` (`web/src/state/uiStore.ts`).
- Jamais de couleur en dur dans le CSS — variables de thème de `globals.css`.
- Changements chirurgicaux : ne pas « nettoyer » le code adjacent non concerné.
- TypeScript strict : `npx tsc --noEmit` doit rester vierge.
- Un commit par mission, message en français, format `feat:`/`refactor:`/`chore:`.

## Ordre des missions

| # | Fichier | Contenu | Effort |
|---|---|---|---|
| 4 | `2026-07-17-mission-4-suppression-api-tailor-html.md` | Suppression de `/api/tailor`, `stream.ts` et des prompts HTML | S |
| 5 | `2026-07-17-mission-5-retrait-sur-mesure.md` | Retrait du niveau « sur-mesure » (UI + prompts + route + tests) | S |
| 6 | `2026-07-17-mission-6-retrait-ats-boost.md` | Retrait du « Booster ATS invisible » (white-fonting) de bout en bout | M |
| 7 | `2026-07-17-mission-7-retrait-html-store-et-purge.md` | Retrait de `html`/`css`/`htmlSource` du store + consommateurs + purge Dexie v6 | L |
| 8 | `2026-07-17-mission-8-ci-et-durcissement.md` | Fusion CI, durcissement redirections scraper, limites de taille d'entrée | M |

Dépendances : 5 dépend de 4 (les deux touchent `prompts.ts`). 7 dépend de 4
(la route HTML doit avoir disparu avant de retirer `setHtml`). 6 et 8 sont
indépendantes mais s'exécutent dans l'ordre pour éviter les conflits.

## Protocole de vérification (après CHAQUE mission, depuis `web/`)

```bash
npx tsc --noEmit      # attendu : aucune erreur
npm run lint          # attendu : aucune erreur (warning image existant toléré)
npm test              # attendu : tous les tests passent
```

Après la mission 7 (la plus risquée), lancer aussi :

```bash
npm run test:e2e      # attendu : toutes les specs passent
```

Si une vérification échoue : corriger dans le périmètre de la mission, ne pas
élargir. Si la correction sort du périmètre, s'arrêter et le signaler.

## Hors périmètre Gemini (fait par Claude à la vérification finale)

- Mise à jour de `PROJECT_INDEX.md` (sections 5, 6, 7, 10, 11 : retrait des
  mentions du pipeline HTML, de l'atsBoost, du sur-mesure ; ajout du template
  Marine ; pages help/pack/profil dans l'arbo), `TODO.md` et `WORK_HISTORY.md`.
- Vérification manuelle dans le navigateur (snapshots, historique, export PDF,
  modale Adapter, panneau ATS).

## Décisions actées (réponses du propriétaire, 17/07/2026)

1. Pas d'auth requise pour l'instant (app non publique) — à revoir au passage multi-utilisateur.
2. Le mode expert HTML est obsolète → suppression complète de `/api/tailor` et de la couche `html`/`css`/`htmlSource`.
3. « Sur-mesure » et white-fonting ATS : supprimés (pas seulement masqués — sinon code mort).
4. Les snapshots/brouillons/historique d'avant-migration (sans `json`) sont purgés à l'upgrade Dexie v6.
