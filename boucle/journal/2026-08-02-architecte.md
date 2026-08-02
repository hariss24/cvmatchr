# Journal — Architecte du 02/08/2026

## Ligne traitée

`BACKLOG.md` § À planifier, première ligne (aucune ligne `!`) : « Manque
fonctionnel — extension navigateur (capture d'offre + autofill de candidature) »,
présente chez 7 des 8 produits de référence, le manque le plus large mesuré à ce
jour sur ce domaine. Constat source :
`boucle/constats/2026-08-01-manques-fonctionnels.md` §1.

## Ce qui a été fait

Avant d'écrire quoi que ce soit, vérification directe (WebSearch + WebFetch,
02/08/2026) plutôt que de deviner la structure des formulaires visés :
- Documentation officielle de l'API Greenhouse
  (`github.com/grnhse/greenhouse-api-docs`) : champs `first_name`, `last_name`,
  `email`, `phone`, pièces jointes `resume`/`cover_letter`, `enctype=multipart/
  form-data` — confirmé aussi sur une offre Greenhouse réelle
  (`job-boards.greenhouse.io/thehonestcompanysandbox/jobs/140167`).
- Centre d'aide Lever : Nom complet + Email obligatoires par défaut, mais
  **aucune source publique consultée n'expose de sélecteur HTML exact**. Rejeté
  d'inventer des sélecteurs Lever depuis l'entraînement du modèle — même
  discipline que les specs zod/jobs (« rien n'est supposé, tout est mesuré »).

Conséquence directe sur la conception : le mécanisme de remplissage est une
**reconnaissance générique de champ** (nom documenté Greenhouse → `autocomplete`
standard → texte de label/placeholder), pas des sélecteurs figés par ATS. Ce
choix couvre Greenhouse ET Lever avec un seul module, sans prétendre connaître un
DOM que je n'ai pas pu vérifier.

Autre décision de tranchage : le chantier ne couvre que l'**autofill**, pas la
« capture d'offre » que le constat regroupait sous la même ligne — CVMatchr a déjà
un extracteur d'offre par URL (`/api/extract-job`) qui couvre l'essentiel de ce
gain-là ; l'écart réel et total avec la concurrence est uniquement sur l'autofill.
Cible Greenhouse + Lever seulement (Workday etc. explicitement exclus, DOM non
documenté et propre à chaque tenant). Jamais de soumission automatique du
formulaire — le risque (candidature envoyée sans relecture) dépasse le gain.

Architecture retenue : nouveau répertoire `extension/` à la racine (sibling de
`web/` et `scraper-service/`, précédent déjà établi dans ce dépôt), Manifest V3,
JavaScript vanilla, **zéro dépendance npm** — donc aucun feu vert requis au sens
de `MISSION.md`. Côté `web/src/`, seulement deux fichiers purs + un bouton dans
`PackView.tsx` : aucune modification de `docStore.ts`, `db.ts` ni du moteur ATS,
zéro nouvelle persistance.

Écrit :
- `docs/superpowers/specs/2026-08-02-extension-autofill-design.md`
- `docs/superpowers/plans/2026-08-02-extension-autofill.md` (4 tâches)

Ligne déplacée vers `## Prêt à coder` avec les deux chemins. Deux lignes ajoutées
à `BACKLOG.md` § Idées pour les axes explicitement écartés (capture d'offre,
autres ATS), à rouvrir plus tard si l'usage réel de Greenhouse/Lever le justifie.

## Bornes respectées

Aucun fichier sous `web/src/` modifié — uniquement lu (`schema.ts`,
`generatePdf.tsx`, `filename.ts`, `profile.ts`, `PackView.tsx`, `ActionsBar.tsx`,
`TopBar.tsx`) pour ancrer la spec/le plan dans le code réel plutôt que dans une
supposition. `boucle/BACKLOG.md` mis à jour, `boucle/ETAT.md` écrasé, ce journal
écrit.

## Ce qui reste à faire (pour le Bâtisseur)

Suivre le plan, 4 tâches. La Task 3 (reconnaissance de champ + remplissage) ne
peut être vérifiée que manuellement — sur de vraies offres Greenhouse et Lever,
en conditions réelles — faute de `jsdom` dans ce dépôt et de DOM tiers simulable ;
la couverture réelle sur Lever (aucun sélecteur documenté publiquement) doit être
mesurée à l'usage, pas supposée acquise par cette spec.
