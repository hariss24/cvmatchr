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

---

# Journal — Architecte, second réveil du 02/08/2026

## Ligne traitée

`BACKLOG.md` § À planifier, première ligne (aucune ligne `!`) après le passage du
Bâtisseur ayant exécuté le chantier ci-dessus : « Manque fonctionnel —
optimisation de profil LinkedIn (analyse + suggestions) », présente chez 2
produits avec un outil dédié (Jobscan, Careerflow). Constat source :
`boucle/constats/2026-08-01-manques-fonctionnels.md` §4.

## Ce qui a été fait

Lu `src/lib/ats/engine.ts`, `src/lib/ats/resumeText.ts`,
`src/app/api/ats-score/route.ts`, `src/components/modals/AtsPanel.tsx`,
`src/lib/ai/prompts.ts` (le prompt `SYSTEM_ATS_SCORE`), `src/lib/ai/http.ts`,
`src/lib/ai/client.ts`, `src/components/profile/ProfileView.tsx` (gabarit de
page autonome), `src/components/layout/UserMenu.tsx` et
`src/components/layout/SegmentedNav.tsx` (pour choisir où accrocher un nouvel
écran) avant d'écrire quoi que ce soit — le constat suggérait déjà « un flux
proche de `ats-score` », donc la première question était : proche à quel point,
et qu'est-ce qui se réutilise littéralement plutôt que de s'inspirer seulement.

Réponse : beaucoup. Le moteur ATS (`lib/ats/engine.ts`) résout déjà « quels
mots-clés retenir dans une offre » (`extractJobKeywords`, pondération par
répétition/lexique de savoir-faire/composés soudés) et « comment vérifier leur
présence dans un texte » (`contains`, `normalize`) — un profil LinkedIn collé en
texte n'est qu'un second texte à analyser avec la même logique, pas un second
problème. Décision de conception centrale : réutiliser ces fonctions (en les
exportant, elles étaient privées) et le type `AtsReport`/`AtsAxis` tel quel,
plutôt que d'écrire un second moteur. De même côté IA : `coerceRequirements`/
`coercePriorities` (privées à `ats-score/route.ts`) déplacées dans un module
partagé `lib/ai/coerceAi.ts`, et les sous-composants d'affichage du rapport
(`Axes`, `Pills`, `Priorities`, actuellement définis à l'intérieur de
`AtsPanel.tsx`) extraits dans `components/shared/ScoreReportParts.tsx`. Le plan
consacre sa Task 1 à cette extraction préparatoire, explicitement documentée
comme **sans changement de comportement** (test de régression : les tests
existants `ats/engine.test.ts` et `ats-score/route.test.ts` doivent rester
verts), avant d'écrire la moindre ligne neuve.

Le profil n'a pas de structure de données propre (contrairement au CV, dont les
champs alimentent aussi l'export PDF) : deux champs de texte suffisent — Titre
(headline) et Corps (à-propos + expériences) — plus une offre visée optionnelle,
propre à cet écran (pas de préremplissage depuis `docStore.pendingJobDesc` :
`PROJECT_INDEX.md` §11 documente déjà deux bugs vécus par ce dépôt où un état
partagé entre pages, restauré au mauvais moment, écrasait une donnée fraîche —
pas de raison d'ajouter un troisième cas). Score local à 4 axes pondérés
(Mots-clés 35 %/Titre 20 %/Impact 25 %/Complétude 20 % si une offre est fournie,
sinon Titre 30 %/Impact 40 %/Complétude 30 %) — les formules (longueur de titre,
proportion de lignes chiffrées, longueur+paragraphes du corps) sont des
heuristiques d'ingénierie assumées comme telles, pas des chiffres mesurés chez
Jobscan/Careerflow (méthodes fermées, non publiées). Suggestions IA optionnelles
(`/api/linkedin-score`, miroir de `/api/ats-score`) : accroches de titre
réécrites + corrections prioritaires, avec `HUMAN_TONE_RULE` incluse dans le
prompt pour que les réécritures ne sonnent pas IA — le problème que cette règle
existe déjà pour éliminer ailleurs (`tailor-resume`, `editor-chat`,
`adapt-letter`), à ne pas oublier ici.

Nouvelle page `/linkedin` (pas une modale : pas de dépendance à un CV/une offre
déjà ouverts dans l'éditeur, contrairement au panneau ATS), accessible depuis le
menu utilisateur — pas la navigation segmentée principale (Éditeur/Offres/
Candidatures), réservée aux trois parcours visités à chaque session.

Écrit :
- `docs/superpowers/specs/2026-08-02-linkedin-optimisation-design.md`
- `docs/superpowers/plans/2026-08-02-linkedin-optimisation.md` (5 tâches)

Ligne déplacée de `## À planifier` vers `## Prêt à coder` avec les deux chemins.

## Écarté explicitement (détail en spec §4, §8)

Import automatique du profil LinkedIn (scraping/connexion) — ligne distincte du
backlog (§5 du constat), faisabilité technique non validée, à ne pas mélanger à
un gain sûr (analyser un texte déjà collé par l'utilisateur). Réplique des 14
sections façon Careerflow (photo, recommandations, featured…) — non
représentables depuis un texte collé. Renommage de `AtsReport`/`AtsAxis` en un
nom neutre au moment de les réutiliser — gain cosmétique seul, contre
Changements chirurgicaux (`CLAUDE.md`).

## Bornes respectées

Aucun fichier sous `web/src/` modifié — uniquement lu, pour ancrer la spec/le
plan dans le code réel (signatures exactes, noms de fonctions/types déjà
exportés ou non, classes CSS déjà définies dans `globals.css`) plutôt que dans
une supposition. Les valeurs numériques des tests prévus pour le moteur local
(Task 2 du plan) ont été calculées à la main et vérifiées deux fois avant
d'être écrites dans le plan (score pondéré 66, axes 100/65/48/57).
`boucle/BACKLOG.md` mis à jour, `boucle/ETAT.md` écrasé, ce journal complété.

## Ce qui reste à faire (pour le Bâtisseur)

Suivre le plan, 5 tâches, dans l'ordre (la Task 1 rend réutilisable ce que les
Tasks 2-4 consomment — ne pas sauter l'ordre). Aucun test de rendu React
n'existe pour `AtsPanel` ni prévu pour `LinkedInView` (cohérent avec le reste du
dépôt) : la vérification de l'écran lui-même (Task 4) est manuelle, protocole
détaillé dans le plan, y compris le cas où aucune clé IA n'est configurée dans
l'environnement d'exécution (repli local à consigner comme tel, pas comme un
échec).
