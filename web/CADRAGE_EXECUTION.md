# CADRAGE STRICT — Exécution d'un plan sur CVMatchr (contrat générique)

> Tu es un agent d'exécution. Ce document est un CONTRAT permanent, valable pour
> N'IMPORTE QUEL plan qu'on te confie. Tu n'as pas le droit d'improviser, de
> simplifier, de « faire au plus simple », ni de sauter une étape. Si une
> instruction est ambiguë ou en conflit avec le code réel, tu t'ARRÊTES et tu
> poses la question. Tu ne devines JAMAIS.

## LA MISSION (à remplir à chaque fois)

- **Plan à exécuter** : `<chemin du plan, ex. docs/superpowers/plans/....md>`
- **Périmètre** : uniquement ce que le plan demande, task par task, DANS L'ORDRE.
- Le plan est la spécification ; ce cadrage est la loi. En cas de conflit entre
  les deux : tu t'arrêtes et tu demandes.

---

## 0. RÈGLES NON NÉGOCIABLES

1. **Une task = un lot.** Tu traites les tasks du plan dans l'ordre. Interdiction
   d'en commencer une tant que la précédente n'a pas passé sa vérification (section 4).
2. **TDD quand le plan le demande** : tu écris le test d'abord, tu montres qu'il est
   ROUGE, puis tu codes, puis tu montres qu'il est VERT.
3. **Preuves obligatoires** : une task n'est « terminée » que si tu colles dans ta
   réponse la liste exacte des fichiers modifiés + la sortie réelle des commandes de
   vérification. Pas de « ça devrait marcher ».
4. **Tu ne touches QUE les fichiers nécessaires à la task en cours.** Pas de
   refactor voisin, pas de renommage, pas de « nettoyage », pas de reformatage de
   fichiers entiers, pas de fonctionnalité bonus, pas de TODO ni de code commenté.
5. **Tu ne supprimes aucune fonctionnalité existante** sauf si le plan l'ordonne
   explicitement. Ne casse JAMAIS ce qui n'est pas dans le périmètre (les autres
   templates, la Lettre, l'historique… doivent continuer à fonctionner à l'identique).
6. **Aucune dépendance npm ajoutée ou mise à jour** sans instruction explicite du plan.
7. **Pas de `any`, pas de `@ts-ignore`, pas de `eslint-disable` ajouté** (sauf déjà
   présent et indispensable). TypeScript strict doit compiler.
8. **Jamais `alert`/`confirm`/`prompt` natifs** → `uiAlert`/`uiConfirm`/`uiPrompt`/`toast`
   de `@/state/uiStore`. **Jamais de couleur en dur** → variables de thème CSS
   (`var(--bg)`, `var(--text)`…) dans `src/app/globals.css`.
9. **Tu ne modifies pas un test existant pour le faire passer.** Si un test casse,
   c'est ton code qui est faux — sauf si le plan dit explicitement d'adapter ce test
   (les plans de migration le précisent) ; hors de ce cas, tu t'arrêtes et tu demandes.
10. **Git : commit local par task autorisé** (message clair, en français, une task = un
    commit). **PUSH STRICTEMENT INTERDIT** : un push déploie la production Vercel.
    Le push est fait par l'humain ou l'agent de revue, jamais par toi.
11. **Journal obligatoire** : après chaque task, ajoute une entrée datée en tête de
    la section `## Journal` de `WORK_HISTORY.md` (racine du repo) : quoi, pourquoi,
    fichiers touchés, résultat des vérifs. Mets aussi à jour la ligne « Prochaine
    étape suggérée » de sa section « État actuel ». Tu ne modifies rien d'autre
    dans ce fichier. (`docs/archive/REWRITE_PROGRESS.md` est l'archive figée des
    réécritures passées — ne plus y écrire.)
12. **La photo de profil (`photo`, base64) n'est JAMAIS envoyée à une IA** ni affichée
    brute dans un éditeur : strip avant envoi, restauration au retour (helpers dans
    `src/lib/ai/base64.ts` et flux existants à imiter).
13. **Rapport final obligatoire** (section 5).

---

## 1. CONTEXTE TECHNIQUE (à connaître, ne pas redécouvrir)

- App dans `web/` : Next.js 16 (App Router, Turbopack), React 19, TypeScript strict,
  Zustand (`src/state/docStore.ts`, `src/state/uiStore.ts`), Dexie/IndexedDB
  (`src/lib/storage/`), zod (`src/lib/resume/schema.ts`), Vitest + Playwright.
- ⚠️ **Next.js 16 ≠ tes connaissances d'entraînement** : lis `web/AGENTS.md` et, au
  besoin, les guides dans `web/node_modules/next/dist/docs/` avant d'écrire du code Next.
- Moteurs de rendu (migration en cours) : react-pdf dans `src/lib/pdfgen/` (JSON → PDF)
  et HTML historique dans `src/lib/resume/render.ts` + `templates.ts`. L'interrupteur
  est la fonction pure `docEngine` de `docStore.ts`. ⚠️ Dans `pdfgen`, la géométrie du
  CSS d'origine est en px CSS : convertir via le helper `px()` (1 px = 0,75 pt).
- Modales de référence (design system `.ui-overlay`/`.ui-dialog`) : `TailorModal.tsx`,
  `PackModal.tsx`. CSS global unique : `src/app/globals.css`.
- Piège connu Windows/Turbopack : si un changement CSS ne s'affiche pas ou qu'un e2e
  échoue bizarrement → supprimer `web/.next` et vérifier qu'aucun serveur ne traîne
  sur le port 3000, puis relancer.

---

## 2. LECTURES OBLIGATOIRES AVANT LA PREMIÈRE LIGNE DE CODE

Dans cet ordre :
1. Ce cadrage, en entier.
2. `WORK_HISTORY.md` (racine) — la section « État actuel » + les 5 dernières
   entrées du Journal. Pour le détail exhaustif des réécritures passées (Next.js,
   React PDF), voir `docs/archive/REWRITE_PROGRESS.md` si besoin.
3. Le document de cadrage du chantier s'il est cité par le plan (ex.
   `docs/superpowers/plans/2026-07-04-migration-react-pdf.md`).
4. **Le plan de la mission** (chemin en tête de ce document), en entier.
5. Chaque fichier source cité par le plan, AVANT de le modifier — jamais de
   modification à l'aveugle. Les plans citent les fichiers exacts ; s'il t'en manque
   un pour comprendre un appel, lis-le aussi (lecture libre, modification interdite
   hors périmètre).

---

## 3. INTERDICTIONS DE PÉRIMÈTRE (rappel)

- Tu ne touches ni à la config de déploiement (`vercel`, `next.config.ts` sauf si le
  plan l'ordonne), ni aux workflows CI, ni aux fichiers hors du repo.
- Tu ne lances AUCUNE commande destructrice (reset --hard, clean -f, rm récursif…).
- Tu ne crées pas de branche : tu travailles sur la branche courante
  (`feature/refonte-ui-nextjs`). Tu ne merges rien, surtout pas dans `main`.

---

## 4. PROTOCOLE DE VÉRIFICATION (après CHAQUE task)

Depuis `web/`, dans cet ordre, et tu colles la sortie INTÉGRALE (ou les dernières
lignes significatives si très longue) :

```
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npx playwright test   # au minimum en fin de plan + quand la task touche l'UI
```

- Une erreur = tu corriges AVANT de continuer. Tu ne désactives jamais une règle
  pour passer. Une task avec une vérification rouge est NON LIVRÉE.
- Si un e2e échoue de façon incompréhensible : piège Turbopack (section 1) d'abord.

---

## 5. RAPPORT FINAL OBLIGATOIRE (format imposé)

Pour chaque task du plan :

```
### TASK n — <titre du plan>
- Fichiers modifiés : <liste exacte>
- Résumé du changement : <3 lignes max>
- Critères du plan : [x] / [ ] (chaque point de la task)
- tsc / lint / vitest / build / e2e : OK ou KO (+ extrait si KO)
- Commit : <hash + message>
- Journal WORK_HISTORY.md : fait [x]
```

Puis une section « Points sur lesquels je me suis arrêté pour demander » (même vide).
