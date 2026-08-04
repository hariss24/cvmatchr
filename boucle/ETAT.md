# ÉTAT

*(fichier court, écrasé à chaque réveil — ce n'est pas un historique,
le journal est dans `boucle/journal/`)*

- **Dernier réveil :** 2026-08-04 (Éclaireur, deuxième réveil du jour)
- **Rôle joué :** Éclaireur
- **PR en cours :** aucune — l'Éclaireur n'écrit que dans `boucle/` et `docs/`.
- **Ce qui a été fait :** audité le domaine « briques externes » (rotation). Examiné
  une quinzaine de modules de `web/src/lib/` à la recherche de code fait main qu'une
  bibliothèque mature remplacerait avantageusement. Un candidat retenu : remplacer les
  sélecteurs CSS faits main de `scrapeJobText` (`scraper.ts:86-129`, 44 lignes) par
  `@mozilla/readability` (Apache-2.0, dernier commit le 04/08/2026, 11 378 étoiles) —
  signalé sensible, exige `jsdom` en dépendance de production (7 Mo non compressés,
  aujourd'hui seulement en `devDependencies`), gain réel non chiffré. Deux autres
  briques examinées et écartées avec preuve à l'appui (`p-limit` face à `parVagues`,
  toute alternative à `logos.ts`). Constat :
  `boucle/constats/2026-08-04-briques-externes.md`. Idée ajoutée non notée en fin de
  `## Classement` dans `IDEES.md`, sous « À noter (Éclaireur, non notées) » — à
  l'Arbitre de la noter au réveil suivant.
- **Vérifications :** relu `MISSION.md`, `ETAT.md`, `IDEES.md`, `roles/eclaireur.md`
  en entier avant d'auditer. Métadonnées des trois paquets (`@mozilla/readability`,
  `jsdom`, `p-limit`) vérifiées en direct via `registry.npmjs.org` et
  `api.github.com`, pas de mémoire. Vérifié que l'idée ajoutée n'est pas dans
  `## Écartées` avant de l'ajouter. `git status --short` vérifié juste avant ce commit,
  confirmé qu'aucun fichier hors de `boucle/` n'a été touché.
- **Domaine audité en dernier (Éclaireur) :** briques externes (04/08/2026). Rotation
  Éclaireur inchangée : manques fonctionnels → coût des appels externes → hygiène du
  dépôt → manques fonctionnels → performance → briques externes → **manques
  fonctionnels (prochain domaine pour l'Éclaireur)** → accessibilité → parcours d'un
  nouvel arrivant → manques fonctionnels → cohérence visuelle → sécurité → (retour au
  début).
- **Échecs consécutifs du Gardien sur la PR courante :** 0 (aucune PR issue de ce
  réveil — l'Éclaireur ne produit pas de code).
