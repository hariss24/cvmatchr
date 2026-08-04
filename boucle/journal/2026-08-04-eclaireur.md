# Journal — Éclaireur, 2026-08-04

## Domaine

Performance — suivant la rotation (`ETAT.md` du 03/08 désignait « performance » comme
prochain domaine pour l'Éclaireur).

## Démarche

1. Lu `MISSION.md`, `ETAT.md`, `IDEES.md`, `roles/eclaireur.md` intégralement.
2. Relu le précédent constat performance (`boucle/constats/2026-07-31-performance.md`)
   et les deux idées déjà classées qui en découlent (n°5 « remesurer `/jobs` », n°9
   « mesurer le vrai temps d'interactivité de `/pack` ») pour savoir précisément quoi
   remesurer plutôt que refaire un audit générique.
3. Relu `WORK_HISTORY.md` (entrées du 01/08/2026) : deux plans d'allègement du bundle
   ont été livrés depuis le 31/07 (`/jobs` -56 %, retrait de `zod` de 8 routes) —
   confirmé leur code réellement en place par lecture directe (`rome.ts`,
   `JobsView.tsx`) avant de les tenir pour acquis.
4. En préparant la remesure de `/pack`, lecture de `PackView.tsx` : **découvert que
   `/pack` n'est pas l'éditeur CV** (aucun Monaco, aucun `react-pdf` — c'est un
   éditeur de lettre à variables). Le vrai éditeur (Monaco + aperçu PDF live) est à la
   route `/` (`EditorPane.tsx`, `PreviewPane.tsx`). Le constat du 31/07 mesurait donc
   la mauvaise page pour le seuil « chargement de l'éditeur » de `MISSION.md`.
   Documenté explicitement dans le nouveau constat pour que ça ne se reproduise pas.
5. Build de prod réel (`npm install`, `rm -rf .next`, `npm run build`, `npm run
   start`), serveur vérifié up par code HTTP avant toute mesure.
6. Chromium Playwright installé dans cet environnement (absent au départ). Trois
   scripts de mesure écrits **dans `web/`** (seul endroit où `node_modules/playwright`
   se résout en ESM), utilisés puis supprimés avant de conclure — jamais ajoutés à
   `git`.
7. Mesuré, sous Slow 4G + CPU x4 (3 relevés chacun, sauf note contraire) :
   - `/jobs` (atterrissage) : ~2,03 s en moyenne, contre ~3,9 s le 31/07 —
     dépassement du seuil de 2 s réduit d'un facteur ~2 à un facteur ~1,02.
   - `/` jusqu'au premier `<canvas>` d'aperçu PDF réellement rendu (pas juste un
     bouton visible) : ~9,2 s en moyenne — dépassement de facteur ~3,7 du seuil de
     2,5 s, imputé par poids à deux chunks non lazy-loadés (polices PDF 1,44 Mo +
     PDF.js 423 Ko, 55 % du poids jusqu'à l'aperçu) chargés automatiquement au
     montage de `PreviewPane.tsx`.
   - Monaco (`/`, mode Expert → JSON) : découvert que `@monaco-editor/react` charge
     par défaut depuis `cdn.jsdelivr.net` (config par défaut du package, vérifié dans
     `node_modules/@monaco-editor/loader`) — 15 requêtes externes, ~4,1 Mo, 11,2 s
     avant utilisabilité. Mesuré à part, hors seuil MISSION.md dédié mais notable.
8. Recherche concurrence (WebSearch, 04/08/2026) sur le mécanisme d'aperçu en direct
   de Rezi/Kickresume/Enhancv : aucune information technique publique — non
   vérifiable sans compte, comme le 31/07. Une hypothèse (aperçu HTML/CSS chez la
   concurrence contre un cycle PDF réel + PDF.js chez CVMatchr) posée explicitement
   comme non vérifiée dans le constat, pas comme un fait.
9. Écrit le constat `boucle/constats/2026-08-04-performance.md`.
10. Ajouté deux idées neuves non notées à la fin de `## Classement` dans `IDEES.md`
    (aperçu PDF de `/`, Monaco/CDN), plus une note sur la clôture de l'idée n°5 déjà
    classée (remesure `/jobs`, dépassement résiduel sous facteur 2) — à l'Arbitre de
    décider s'il la retire ou la reclasse. Vérifié qu'aucune des deux nouvelles idées
    n'est dans `## Écartées` avant ajout.
11. Nettoyage : scripts temporaires supprimés de `web/`, `web/package-lock.json`
    modifié par `npm install` restauré (`git checkout --`), `git status --short`
    vide avant la rédaction du constat.

## Point d'attention pour l'Arbitre

- Le dépassement mesuré sur `/` (facteur ~3,7) est le plus net de tout l'historique
  des audits performance de la boucle — plus sévère que ce que mesurait par erreur le
  31/07 sur `/pack`. Aucune des trois pistes du constat n'est tranchée : chacune a un
  compromis produit (aperçu provisoire dégradé) ou technique (réordonnancement,
  réduction du jeu de polices) différent.
- L'idée Monaco/CDN n'entre dans aucun seuil MISSION.md au sens strict (pas facturé,
  pas un manque fonctionnel, pas un fichier mort) — signalée quand même parce qu'elle
  bloque une interactivité demandée et introduit une dépendance réseau tierce non
  documentée ailleurs dans le dépôt.
- La confusion de route `/pack` vs `/` dans le constat du 31/07 mérite d'être gardée
  en tête si un futur audit relit ce constat sans lire aussi celui du jour.

## Fichiers touchés

- `boucle/constats/2026-08-04-performance.md` (nouveau)
- `boucle/IDEES.md` (section « Nouvelles idées non notées » ajoutée en fin de
  `## Classement`, reste inchangé)
- `boucle/ETAT.md` (écrasé)
- `boucle/journal/2026-08-04-eclaireur.md` (ce fichier)

Aucun fichier de `web/` ni `extension/` modifié — vérifié par `git status --short`
avant de conclure.
