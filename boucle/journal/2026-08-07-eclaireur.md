# Journal — Éclaireur, 2026-08-07

## Contexte

`ETAT.md` (avant mise à jour) indiquait « manques fonctionnels » comme prochain
domaine de la rotation (`boucle/roles/eclaireur.md`) — troisième tour sur trois
depuis le dernier passage sur ce domaine (05/08/2026, traduction/publication en
ligne/relecture humaine).

## Démarche

1. Lu en entier `MISSION.md`, `ETAT.md`, `IDEES.md` (classement complet + section
   « Écartées ») et `boucle/roles/eclaireur.md` avant de commencer.
2. Lu `PROJECT_INDEX.md` §1 (vue d'ensemble), §7 (IA — routes et système ATS), §8
   (chasseur d'offres), §8 bis (tracker de candidatures) et §8 ter (extension
   navigateur) pour cartographier ce que fait déjà le produit, condition nécessaire
   pour identifier un vrai manque plutôt qu'une fonctionnalité existante mal connue.
3. Relu par `grep`/lecture les trois constats « manques fonctionnels » précédents
   (01/08, 03/08, 05/08) et leurs sections « Chantiers proposés » pour ne pas
   reproposer une idée déjà couverte (extension, LinkedIn, CRM, négociation
   salariale, alertes, correction orthographique, traduction, publication en ligne,
   relecture humaine — tous déjà dans `IDEES.md`).
4. Recherche concurrentielle ciblée par `WebSearch` sur Teal, Careerflow, Jobscan,
   Kickresume et Enhancv (fonctionnalités liées au surlignage de mots-clés, à
   l'analyse d'impact des lignes de CV, à la détection d'ATS par entreprise et au
   choix de ton de lettre), avec citation de l'adresse et de la date de consultation
   (07/08/2026) pour chaque affirmation utilisée.
5. Deux pistes écartées après vérification directe dans le code, plutôt que
   proposées à tort : « analyse d'impact des lignes de CV » (Careerflow) —
   déjà couvert par l'axe « Impact 20 % » du moteur ATS (`lib/ats/engine.ts`,
   `PROJECT_INDEX.md` §7) ; « choix de ton pour la lettre » (Kickresume, Enhancv) —
   déjà construit (`lib/letter/tone.ts`, trois registres : Authentique, Équilibré,
   Factuel, sélection persistée en `localStorage`).
6. Deux manques confirmés retenus, chacun vérifié par lecture directe du code
   avant d'être écrit : absence totale de surlignage en contexte dans le rapport
   ATS (`grep` sur `AtsPanel.tsx`/`engine.ts` : zéro occurrence de
   « highlight »/« surlign »/« mark »), et donnée d'ATS par entreprise
   (`boards-fr.json`) déjà construite pour la recherche d'offres mais jamais
   exploitée côté CV/lettre (`grep -rl "boardsFr\|boards-fr.json" web/src` limité à
   deux routes de recherche).
7. Écrit le constat `boucle/constats/2026-08-07-manques-fonctionnels-4.md`.
8. Ajouté les deux idées non notées en fin de `## Classement` de `IDEES.md`
   (section « À noter (Éclaireur, non notées) »), après avoir vérifié qu'aucune
   des deux n'apparaît déjà dans le classement ni dans `## Écartées`.

## Décisions et raisons

- Signalé franchement que le deuxième manque (ATS détecté par entreprise) n'est
  confirmé que chez un seul produit (Jobscan) à ce stade, sous le seuil formel des
  deux produits que fixe `MISSION.md` pour parler de « manque » — plutôt que
  d'arrondir la formulation pour le faire entrer dans la définition stricte. Retenu
  quand même dans le constat et dans `IDEES.md`, en le signalant comme tel, parce
  que la donnée qui l'alimenterait existe déjà entièrement construite et entretenue
  (`boards-fr.json`, rafraîchi chaque lundi) : à l'Arbitre de juger si ce
  déséquilibre coût quasi nul / apport réel compense la preuve de marché plus
  faible, plutôt que de trancher moi-même en gonflant l'écart à la concurrence.
- N'ai pas chiffré l'ampleur du surlignage côté CV (contrairement au côté offre,
  où le point de départ — une `<textarea>` — est identifié précisément) : le CV
  n'est jamais montré comme texte continu à l'utilisateur (formulaire structuré +
  aperçu PDF en `<canvas>`), donc une estimation aurait été une supposition non
  vérifiée. Écrit « chantier plus incertain » plutôt qu'un chiffre inventé.
- Vérifié deux pistes issues de la recherche concurrentielle avant de les écrire,
  et les ai explicitement écartées une fois confirmées déjà construites (impact des
  lignes de CV, ton de lettre) — pour ne pas faire perdre du temps à l'Arbitre à
  noter une idée qui décrirait une fonctionnalité déjà en production.

## Vérifications faites

- Lu en entier `MISSION.md`, `ETAT.md`, `IDEES.md` (classement + « Écartées ») et
  `boucle/roles/eclaireur.md` avant de commencer.
- `grep -n "highlight\|surlign\|mark\b" AtsPanel.tsx engine.ts` → zéro occurrence,
  et lecture complète des deux fichiers pour confirmer que les pastilles (`Pills`)
  sont la seule représentation des exigences couvertes/manquantes.
- `grep -rl "boardsFr\|boards-fr.json" web/src` (hors fichiers de test) → deux
  fichiers seulement, tous deux dans `app/api/jobs/`, aucun dans le parcours
  CV/lettre.
- Lu `TailorModal.tsx` pour confirmer que l'offre est une `<textarea>` brute
  (ligne 365), pas un rendu qui permettrait nativement un surlignage.
- Lu `lib/resume/templates.ts` (4 gabarits) et `lib/letter/tone.ts` (3 registres)
  en entier avant d'écarter ces deux pistes concurrentielles comme déjà couvertes.
- Comparaison concurrence faite sur des sources publiées et citées (adresse + date
  de consultation, 07/08/2026) pour Jobscan, Teal et Kickresume ; signalé
  explicitement l'absence de vérification pour Enhancv, Careerflow, Rezi, Huntr,
  Simplify sur ces deux points précis plutôt que de généraliser sans preuve.
- Vérifié qu'aucune des deux idées ajoutées n'apparaît déjà dans le classement ni
  dans `## Écartées` d'`IDEES.md`.
- `git status --short` vérifié avant ce commit : uniquement des fichiers sous
  `boucle/` (le constat du jour, `IDEES.md`, `ETAT.md`, ce journal) — aucune
  modification hors périmètre.
