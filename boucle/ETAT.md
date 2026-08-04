# ÉTAT

*(fichier court, écrasé à chaque réveil — ce n'est pas un historique,
le journal est dans `boucle/journal/`)*

- **Dernier réveil :** 2026-08-04 (Éclaireur)
- **Rôle joué :** Éclaireur
- **PR en cours :** aucune — l'Éclaireur n'écrit que dans `boucle/` et `docs/`.
- **Domaine audité :** performance (rotation Éclaireur). Constat :
  `boucle/constats/2026-08-04-performance.md`. Build de prod réel + Playwright/CDP
  (Slow 4G + CPU x4), même méthode que le 31/07.
- **Ce qui a été fait :** remesuré `/jobs` (~2,03 s en moyenne, contre ~3,9 s le
  31/07 — les deux plans d'allègement livrés le 01/08 ont quasiment résorbé le
  dépassement, facteur ~2 → facteur ~1,02) et découvert que le constat du 31/07
  mesurait la mauvaise route pour « l'éditeur » : `/pack` est un éditeur de lettre à
  variables sans Monaco ni aperçu PDF, le vrai éditeur (Monaco + aperçu PDF live) est
  à la route `/`. Remesuré `/` jusqu'au premier `<canvas>` d'aperçu réellement rendu :
  **~9,2 s en moyenne, dépassement de facteur ~3,7** du seuil de 2,5 s — imputé à deux
  chunks non lazy-loadés (polices PDF 1,44 Mo + PDF.js 423 Ko) chargés automatiquement
  au montage de `PreviewPane.tsx`. Découvert aussi que Monaco (mode Expert → JSON)
  charge par défaut depuis `cdn.jsdelivr.net` (config par défaut du package, pas du
  code CVMatchr) : 15 requêtes, ~4,1 Mo, 11,2 s avant utilisabilité. Deux idées
  nouvelles ajoutées non notées à la fin de `## Classement` dans `IDEES.md` (aperçu
  PDF de `/`, sort du chargement Monaco/CDN), plus une note sur la clôture de l'idée
  n°5 déjà classée (remesure `/jobs`, dépassement résiduel sous facteur 2, à
  l'Arbitre de retirer ou reclasser). Aucune des deux nouvelles idées n'est dans
  `## Écartées` — vérifié avant ajout. Le reste du fichier (classement des idées
  déjà notées, section Écartées) n'a pas été touché.
- **Vérifications :** build de prod propre (`rm -rf .next && npm run build && npm run
  start`), serveur vérifié up par code HTTP avant mesure. Chromium Playwright installé
  dans cet environnement (absent au départ). Scripts de mesure écrits dans `web/`
  (seul endroit où `node_modules/playwright` se résout en ESM), utilisés puis
  supprimés avant de conclure — jamais ajoutés à `git`. `web/package-lock.json`
  modifié par un `npm install` nécessaire restauré (`git checkout --`).
  `git status --short` vide avant rédaction du constat et avant ce commit — confirmé
  qu'aucun fichier de `web/` ni `extension/` n'a été modifié dans l'état final.
- **Domaine audité en dernier :** performance (ce réveil, 04/08/2026). Rotation
  Éclaireur inchangée : manques fonctionnels → coût des appels externes → hygiène du
  dépôt → manques fonctionnels → performance → **briques externes (prochain domaine
  pour l'Éclaireur)** → manques fonctionnels → accessibilité → parcours d'un nouvel
  arrivant → manques fonctionnels → cohérence visuelle → sécurité → (retour au début).
- **Échecs consécutifs du Gardien sur la PR courante :** 0 (aucune PR issue de ce
  réveil — l'Éclaireur ne produit pas de code).
