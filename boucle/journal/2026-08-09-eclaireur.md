# Journal — Éclaireur, 2026-08-09

## Domaine audité

Performance (rotation, précédent passage le 04/08/2026,
`boucle/constats/2026-08-04-performance.md`).

## Ce qui a été fait

1. Lu `MISSION.md`, `ETAT.md`, `IDEES.md` (classement complet + « Écartées ») et
   `boucle/roles/eclaireur.md`.
2. Build de production réel dans `web/` : `rm -rf .next && npm install && npx
   playwright install chromium && npm run build && npm run start`. Serveur vérifié up
   par code HTTP (`/`, `/pack`, `/jobs` → 200) avant toute mesure. Aucun mot de passe
   d'authentification configuré dans cet environnement (middleware inactif), comme lors
   des audits précédents.
3. Script Playwright ad hoc (`web/tmp-perf-measure.mjs`, jamais commis) mesurant sous
   Slow 4G + CPU x4 (mêmes profils que le 04/08, CDP) :
   - `/` : remesure du canvas d'aperçu PDF (idée n°11) — 8930/9025/8976 ms, inchangé
     à 2,6 % près par rapport au 04/08 (9061/9066/9512 ms). Aucun commit sur les
     fichiers concernés depuis (`git log --since=2026-08-04` sur `PreviewPane.tsx`,
     `PdfPreview.tsx`, `lib/pdfgen/`, `app/page.tsx` : aucune sortie).
   - `/` : nouveau seuil intermédiaire, premier `input.form-input` saisissable —
     1075/1080/1074 ms, sous le seuil de 2,5 s. Isole que le formulaire lui-même n'est
     pas le problème, seul l'aperçu PDF automatique l'est.
   - `/` : événement `load` complet — 2774 ms, poids 1 336 006 o sur 13 fichiers.
     Répond à la question ouverte de l'idée n°21 (« jamais mesuré contre le seuil »).
   - `/pack` : interactif (`.var-editor`) — 2609/2615/2631 ms puis 2632/2630/2640 ms
     (deux runs cohérents), poids 770 985 o sur 12 fichiers. Découverte en cours de
     route : le titre de l'idée n°24 (« Monaco/react-pdf ») est une prémisse fausse
     héritée d'avant la correction de route du 04/08 elle-même — vérifié par lecture de
     `PackView.tsx`/`VariableEditor.tsx` et `grep -rn "monaco\|react-pdf"
     src/components/pack/` (aucun résultat).
4. Concurrence : recherche web datée (09/08/2026) sur les plaintes de lenteur
   (aucune trouvée, non vérifiable sans compte, comme au 04/08 et au 31/07) et sur le
   mécanisme d'aperçu de Kickresume (« instantané » d'après sa documentation publique —
   renforce sans confirmer l'hypothèse architecture HTML/CSS déjà posée le 04/08).
   TTFB `curl` sur 5 pages marketing (indicatif seulement, non comparable).
5. Écrit `boucle/constats/2026-08-09-performance-2.md`.
6. Ajouté une section « À noter » en fin de `## Classement` d'`IDEES.md` (avant
   « Écartées ») : une correction à faire sur le titre/données de l'idée n°24, une
   nouvelle idée (identifier le contenu des trois chunks les plus lourds de `/pack`
   avant tout chantier de réduction), et deux précisions rattachées aux idées n°11 et
   n°21 sans créer de nouvelle entrée numérotée — aucune n'est notée, c'est le rôle de
   l'Arbitre au réveil suivant.
7. Nettoyage : script Playwright temporaire supprimé, `web/package-lock.json`
   (modifié par le `npm install` nécessaire dans cet environnement) restauré par `git
   checkout --`, serveur `next start` arrêté. `git status --short` vérifié vide dans
   `web/` avant ce commit.

## Vérifications

- Aucune des idées ajoutées à « À noter » n'apparaît dans `## Écartées`.
- Recherché `n°\d+` mentalement lors de la rédaction pour vérifier que les renvois
  (n°11, n°21, n°24) pointent bien vers les bonnes idées du classement actuel — relu
  chacune des trois sections concernées d'`IDEES.md` avant d'écrire les renvois.
- `git status --short` (racine du dépôt) vérifié avant ce commit : uniquement
  `boucle/IDEES.md`, `boucle/ETAT.md`, `boucle/constats/2026-08-09-performance-2.md` et
  ce journal — rien hors de `boucle/`.
