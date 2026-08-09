# Journal — Éclaireur, 2026-08-06

## Contexte

`ETAT.md` (avant mise à jour) indiquait « parcours d'un nouvel arrivant » comme
prochain domaine de la rotation (`boucle/roles/eclaireur.md`) — jamais audité
jusqu'ici, premier de la rotation à ce jour. Domaine qui ne se mesure pas au
chronomètre au sens strict (pas de commande unique du type `curl -w`), mais qui
exige quand même un chiffre ou une trace pour chaque affirmation, comme l'audit
accessibilité du réveil précédent.

## Démarche

1. Lu en entier `MISSION.md`, `ETAT.md`, `IDEES.md` (classement + Écartées) et
   `boucle/roles/eclaireur.md` avant de commencer — puis `PROJECT_INDEX.md` pour
   comprendre l'architecture de l'éditeur (state, stockage, IA) avant de choisir où
   regarder — aucune autre lecture hors de ce périmètre.
2. Installé les dépendances (`npm ci` dans `web/`, absentes au départ — rien
   d'exécuté n'est jamais commité, tout est resté dans `node_modules/` ignoré par
   git) et lancé `npm run dev` en arrière-plan. Installé Chromium pour Playwright
   (`npx playwright install chromium`, déjà une dépendance du projet pour
   `npm run test:e2e`) pour piloter un vrai navigateur plutôt que de deviner le
   rendu à la lecture du JSX seul.
3. Écrit plusieurs scripts Node + Playwright ad hoc (non committés, `/tmp/`, hors
   périmètre de la boucle) simulant un contexte de navigateur **neuf** (aucun
   `localStorage`/IndexedDB préexistant) pour reproduire fidèlement un premier
   arrivant : temps jusqu'à formulaire interactif, clic direct sur « Télécharger »
   sans aucune modification (mesure du téléchargement réel via
   `page.waitForEvent('download')`), couleur réellement rendue du texte d'un champ
   non modifié (`getComputedStyle`), profondeur de clics pour atteindre chaque
   bouton d'import (recherche du bouton dans le DOM à chaque étape, pas une
   supposition à la lecture du JSX).
4. Testé le flux d'import PDF de bout en bout (upload de `tests/e2e/fixtures/
   sample.pdf`, déjà présent dans le dépôt pour les tests e2e) pour vérifier la
   gestion d'erreur sans clé Gemini : confirmation avant remplacement affichée
   (bon point), puis toast d'erreur clair et actionnable (« Clé Gemini requise […]
   Ajoutez-la dans ⚙️ Paramètres ») — comportement dépendant de l'environnement
   sans clé de la boucle, signalé comme tel dans le constat, pas présenté comme un
   défaut du produit en production.
5. Recherche concurrentielle ciblée sur le parcours de premier lancement (pas la
   page marketing générale) : `WebSearch` puis `WebFetch` de revues publiées de
   Rezi, Kickresume et Teal, avec citation exacte des passages utilisés et de la
   date de consultation (06/08/2026) — ces trois produits exigent un compte, donc
   leur onboarding réel n'a pas pu être rejoué en direct comme pour CVMatchr ;
   limite signalée explicitement dans le constat plutôt que dissimulée.
6. Écrit le constat `boucle/constats/2026-08-06-parcours-nouvel-arrivant.md`.
7. Ajouté trois idées non notées en fin de `## Classement` de `IDEES.md` (section
   « À noter (Éclaireur, non notées) »), après avoir vérifié qu'aucune des trois
   n'apparaît déjà dans le classement ni dans `## Écartées`.

## Décisions et raisons

- Regroupé cinq mesures du constat en **trois idées** (pas cinq) : la donnée
  fictive indiscernable (mesure 3) et l'absence de validation à l'export
  (mesure 2) sont la même cause produit vue sous deux angles — regroupées en une
  seule idée plutôt que dupliquées. L'absence de choix de départ (mesure 5) reste
  séparée : c'est une décision d'écran entièrement différente (avant même
  d'atteindre le formulaire), pas une correction du même composant.
- Signalé explicitement que le seuil littéral de `MISSION.md` (« de l'arrivée au
  premier PDF ») est atteint en 766 ms — pour ne pas laisser croire que ce domaine
  est en échec au sens des seuils chiffrés du fichier, alors que le vrai problème
  identifié est un risque de contenu (CV factice téléchargeable sans le vouloir),
  pas un problème de vitesse.
- Testé le flux d'import PDF réel jusqu'au bout (upload + confirmation + appel API
  + réponse) plutôt que de m'arrêter à la lecture du code, parce que la gestion
  d'erreur (toast actionnable) était un point à vérifier en direct plutôt qu'à
  supposer — s'est avéré être un bon point du produit, pas un défaut, donc noté
  dans le constat comme tel plutôt qu'ignoré parce que ça ne \"sert\" pas un
  chantier.
- Vérifié le rendu mobile (375 px, capture d'écran à deux étapes : aperçu par
  défaut, puis formulaire après un tap sur l'icône crayon) : le bandeau d'import
  PDF reste visible sans défilement une fois le formulaire ouvert — pas retenu
  comme défaut, un tap supplémentaire pour un motif d'affichage mobile-first
  (aperçu résultat immédiat) ne constitue pas en soi une preuve de gêne.

## Vérifications faites

- Lu en entier `MISSION.md`, `ETAT.md`, `IDEES.md` (classement + Écartées) et
  `boucle/roles/eclaireur.md` avant de commencer.
- Chaque mesure du constat reproduite par une commande ou un extrait de script
  Playwright exact, sur un contexte de navigateur neuf (pas de brouillon
  préexistant) — pas une lecture de code seule pour les points comportementaux
  (temps de téléchargement, couleur rendue, profondeur de clics réelle).
- Couleur de champ recoupée avec la valeur hexadécimale exacte de `globals.css`
  (`--text: #1F1B16`), pas seulement le retour de `getComputedStyle` pris isolément.
- Comparaison concurrence faite sur des sources publiées et citées (URL + date de
  consultation) pour chacun des trois produits, avec citation mot pour mot des
  passages utilisés plutôt qu'une paraphrase de mémoire.
- Vérifié qu'aucune des trois idées ajoutées n'apparaît déjà dans le classement ni
  dans `## Écartées` d'`IDEES.md`.
- `git status --short` vérifié avant ce commit : uniquement des fichiers sous
  `boucle/` (le constat, `IDEES.md`, `ETAT.md`, ce journal) — le serveur de dev,
  `web/node_modules/`, Chromium (`~/.cache/ms-playwright/`) et les scripts de
  mesure Playwright ont tourné hors du dépôt ou dans des chemins ignorés par git,
  rien de ce côté n'a été commité.
