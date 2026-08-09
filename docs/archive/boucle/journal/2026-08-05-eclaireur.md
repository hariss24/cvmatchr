# Journal — Éclaireur, 2026-08-05

## Contexte

Rotation (`boucle/roles/eclaireur.md`) : domaine suivant après le réveil Arbitre du
04/08 (deuxième réveil) était « manques fonctionnels » (3e passage, `ETAT.md` avant
mise à jour). Deux constats précédents sur ce domaine existent
(`2026-08-01-manques-fonctionnels.md`, `2026-08-03-manques-fonctionnels-2.md`) : lu
les deux en entier avant de commencer pour ne pas redécouvrir un manque déjà trouvé.

## Démarche

1. Relu `PROJECT_INDEX.md` §§4 (modèle de données), 6 (génération PDF), 7 (IA), 10
   (arborescence UI) pour connaître le périmètre exact de CVMatchr aujourd'hui.
2. Listé mentalement des capacités candidates absentes du produit et non encore
   couvertes par les 22 idées déjà classées ni les 2 déjà écartées dans `IDEES.md` :
   traduction, portfolio/site web, relecture humaine, réponses IA aux questions
   ouvertes de candidature, benchmark ATS contre de vrais recruteurs.
3. Vérifié chaque piste par recherche réelle (`WebSearch`/`WebFetch`) sur les 8
   produits de référence. Écartées faute de confirmation chez ≥ 2 produits parmi les
   huit : réponses IA aux questions ouvertes (confirmé seulement chez Simplify,
   Careerflow et Huntr n'ont pas confirmé cette capacité précise dans les sources
   consultées) et benchmark ATS contre de vrais recruteurs (Jobscan seul, et la
   source elle-même précise que ce n'est pas une vraie simulation ATS).
4. Trois pistes confirmées chez ≥ 2 produits avec citation officielle et date :
   traduction (Kickresume + Enhancv), publication en ligne (Kickresume + Rezi),
   relecture humaine payante (Careerflow + Rezi + Kickresume).
5. Vérifié l'absence côté code de CVMatchr pour chacune des trois par `grep` ciblé
   sur `web/src/`, chaque résultat lu à la main (voir constat, section « Mesures »).
   Découverte notable : le chat de l'éditeur **exclut explicitement** la traduction
   de son périmètre (`lib/ai/prompts.ts:326`), donc CVMatchr ne se contente pas d'être
   en retard sur ce point, il refuse activement la demande si on la formule.
6. Écrit le constat `boucle/constats/2026-08-05-manques-fonctionnels-3.md`.
7. Ajouté les trois idées non notées en fin de `## Classement` de `IDEES.md`
   (section « À noter (Éclaireur, non notées) »), après avoir vérifié qu'aucune des
   trois n'apparaît déjà dans le classement ni dans `## Écartées`.

## Décisions et raisons

- Les trois idées sont chacune signalées comme touchant un **sujet sensible** de
  `MISSION.md` : la publication en ligne suppose de sortir du 100 % local (terrain
  voisin de « migration des données hors d'IndexedDB ») et la relecture humaine
  suppose une opération humaine hors du modèle actuel (terrain voisin de « modèle
  économique »). Seule la traduction n'a pas ce signalement — elle réutilise
  vraisemblablement l'infra IA existante sans nouvelle intégration ni changement de
  modèle.
- Non retenu comme manque à part entière : « réponses IA aux questions ouvertes de
  candidature » (Simplify Copilot, payant) — une seule confirmation nette sur les 8
  produits malgré la recherche sur Careerflow et Huntr, sous le seuil de `MISSION.md`.
  Pas ajouté à `IDEES.md` pour ne pas fausser le classement avec une idée qui ne
  franchit pas le seuil énoncé.

## Vérifications faites

- Lu en entier `MISSION.md`, `ETAT.md`, `IDEES.md` (classement + Écartées),
  `roles/eclaireur.md` avant de commencer.
- Lu en entier les deux constats manques-fonctionnels précédents pour éviter toute
  redite.
- Chaque affirmation sur la concurrence vérifiée par une requête `WebSearch`/
  `WebFetch` réelle le jour même (2026-08-05), avec URL et citation exacte — jamais
  de mémoire du modèle.
- Chaque absence côté CVMatchr vérifiée par `grep -rniE` sur `web/src/`, chaque
  résultat lu et confirmé sans rapport avec la capacité cherchée avant de conclure à
  l'absence.
- `git status --short` vérifié avant le commit final : uniquement des fichiers sous
  `boucle/` (le constat, `IDEES.md`, `ETAT.md`, ce journal).
