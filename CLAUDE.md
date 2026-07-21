# 🤖 CLAUDE.md — CVMatchr

> **🗺️ Commence par `PROJECT_INDEX.md`** (racine) : architecture, modèle de
> données, fonctionnalités, routes API, pièges connus. Ne commence aucune
> modification sans l'avoir lu — il évite de redécouvrir à l'aveugle ce qui
> existe déjà.

**Lectures recommandées pour toute première session, dans cet ordre :**

1. `PROJECT_INDEX.md` (racine) — architecture actuelle.
2. `WORK_HISTORY.md` (racine) — ce qui a été fait récemment et pourquoi (section
   « État actuel » + dernières entrées du Journal).
3. `web/CADRAGE_EXECUTION.md` — contrat d'exécution à suivre si on te confie un
   plan à réaliser tâche par tâche (protocole de vérification, format de rapport).
4. `docs/archive/REWRITE_PROGRESS.md` — uniquement si tu as besoin du détail
   exhaustif, phase par phase, des réécritures Next.js et React PDF (archive
   figée, ne plus y écrire — le journal actif est `WORK_HISTORY.md`).

Tout le code vit dans `web/` (Next.js). `web/CLAUDE.md` (→ `web/AGENTS.md`)
contient les avertissements spécifiques à cette version de Next.js. Le contrat
d'exécution générique pour agents (règles non négociables, protocole de
vérification) est dans `.agents/rules/cadrage.md`.

## Pièges critiques (à lire avant toute modification)

- **`docStore.html` = `""` dans le pipeline JSON/react-pdf** (seul chemin actif
  depuis la migration) : ne jamais tester `if (!html)` ni dédupliquer sur `html`/`css`
  sans vérifier `htmlSource`. A causé deux bugs (ATS 14/07, snapshots 16/07).
- **`uiAlert`/`uiConfirm`/`uiPrompt`** (dans `src/state/uiStore.ts`) : ne jamais
  utiliser les natifs `alert`/`confirm`/`prompt` — ils sont remplacés par ces
  équivalents asynchrones.

## Guidelines Karpathy (obligatoires pour tout travail de code)

1. **Think Before Coding** — pose tes hypothèses explicitement. Si c'est ambigu, demande avant d'agir.
2. **Simplicity First** — minimum de code. Aucune abstraction, flexibilité ou gestion d'erreur non demandée.
3. **Surgical Changes** — ne touche que ce qui est nécessaire. Ne "nettoie" pas le code adjacent.
4. **Goal-Driven Execution** — définis des critères de succès vérifiables avant d'implémenter.

## Vérification avant de déclarer « c'est fait »

Une tâche n'est terminée que si les commandes de vérification ont réellement
tourné et que leur sortie a été lue (voir section 12 de `PROJECT_INDEX.md` pour
la liste). Jamais de « ça devrait marcher ».

## Données de test (Fixtures)

Pour tout test d'adéquation (ATS, mots-clés, ciblage) ou test de génération, utilise par défaut les fichiers suivants (sauf demande contraire) :
- **CV de base** : `web/tests/fixtures/base_resume.json`
- **Offre d'emploi de test** : `web/tests/fixtures/job_sharkninja.txt`
Ces fichiers doivent servir de référence pour valider les comportements liés à l'ATS ou à l'IA.

## Commandes essentielles

```bash
cd web
npm run dev       # Lancer l'app en local
npm test          # Tests unitaires (Vitest)
npm run lint      # ESLint
```

Ou directement : `Lancer CV Builder (Next.js).bat` depuis la racine.
