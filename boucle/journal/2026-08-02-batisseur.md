# Journal — Bâtisseur du 02/08/2026

## Plan exécuté

`docs/superpowers/plans/2026-08-02-extension-autofill.md` (4 tâches), seule
ligne de `## Prêt à coder`. Spec associée :
`docs/superpowers/specs/2026-08-02-extension-autofill-design.md`. `ETAT.md`
indiquait le rôle Architecte au réveil précédent, aucune PR en brouillon à
reprendre (branche `claude/reveil-20260801-1857` mentionnée était un ancien
travail déjà distinct, ce réveil est sur une branche neuve).

## Ce qui a été fait

Les 4 tâches du plan, dans l'ordre, 4 commits (un par tâche, la Task 3 en
inclut un pour le correctif découvert en vérifiant) :

1. Scaffold `extension/` (Manifest V3, `content-bridge.js`, popup, README).
2. `web/src/lib/extension/autofillPackage.ts` (TDD : rouge confirmé en
   déplaçant temporairement le fichier avant de l'écrire, vert ensuite),
   `bridge.ts`, `ExtensionExportButton.tsx` monté dans `PackView.tsx`.
3. `lib/fieldMatch.js` (reconnaissance générique) + `content-autofill.js`
   (bouton flottant, remplissage, jamais de soumission).
4. Documentation `PROJECT_INDEX.md` (§2 structure + section 8 ter).

## Vérification manuelle réelle, pas supposée

Aucun affichage graphique dans cet environnement : la vérification manuelle
exigée par le plan (Task 3 Step 4, spec §7) a été automatisée avec Playwright
piloté par Chromium en `--headless=new` + `--load-extension` — ce mode charge
réellement l'extension (contrairement au headless « classique », qui ne
supporte pas les extensions), donc le flux observé est identique à un usage
manuel réel, pas une simulation de mon fait :

- `npm run dev` lancé en tâche de fond, `/pack` chargé avec le CV par défaut
  (aucune donnée saisie n'était nécessaire, `docStore` en fournit un par
  défaut) → clic réel sur « Préparer pour l'extension » → toast + popup de
  l'extension confirmant le paquet reçu.
- Offre Greenhouse réelle et publique
  (`job-boards.greenhouse.io/thehonestcompanysandbox/jobs/140167`, la même
  que l'Architecte avait déjà identifiée) : bouton flottant, clic réel,
  **7/7 champs remplis** (prénom, nom, email, téléphone, ville, LinkedIn, CV
  joint — confirmé par le nom de fichier apparu dans le DOM après que
  Greenhouse a remplacé son widget d'upload par l'état « fichier attaché »,
  preuve que la page elle-même a réagi au fichier, pas seulement mon script).
  Aucune soumission (URL inchangée).
- Offre Lever réelle et publique
  (`jobs.lever.co/Aprio/cb5984b4-b2de-4662-8691-3b7ea2a21a44/apply`, trouvée
  par recherche web puisque la spec n'en citait aucune) : **6/8 champs
  remplis** (nom complet, email, téléphone, ville, LinkedIn, CV joint —
  confirmé par `C:\fakepath\CV_..._Lever.pdf` dans la valeur du champ
  fichier). Aucune soumission.

## Deux écarts au plan trouvés par cette vérification, corrigés dans le code

1. **Chargement de l'extension cassé entre Task 1 et Task 3.** Le plan ne
   stubait que `lib/fieldMatch.js` en Task 1, mais `manifest.json` référence
   aussi `content-autofill.js` (créé en Task 3 seulement) — un vrai
   chargement Chrome échouait avec « Could not load javascript
   'content-autofill.js' for script » tant que ce fichier n'existait pas.
   Trouvé en essayant réellement de charger l'extension (Task 1 Step 6, pas
   sauté). Corrigé par un stub vide, même traitement que `fieldMatch.js`.
2. **Reconnaissance de champ Greenhouse fausse sur un point.** La spec (§3,
   consultation de la doc API) supposait que les identifiants documentés
   (`first_name`, `last_name`, `email`, `phone`, `resume`, `cover_letter`)
   seraient exposés via l'attribut HTML `name`. Mesuré sur le DOM réel :
   c'est l'attribut `id` qui les porte, `name` est vide sur ces champs. Sans
   correction, la pièce jointe CV (recherchée uniquement par `name`) restait
   non attachée. `findField`/`findFileField` vérifient maintenant `name` et
   `id`.
3. **Critère de succès Lever non atteint au premier essai.** La spec §9.5
   exige « au moins Nom complet et Email » sur Lever — mais Lever n'a pas de
   champ prénom/nom séparé, un seul champ « Full name » (`name="name"`,
   label « Full name✱ »). Aucun des deux hints existants (firstName,
   lastName) ne le reconnaissait : 0 caractère du nom n'était rempli avant
   correction. Ajouté une entrée `fullName` dans `FIELD_HINTS` (attribut
   `name="name"`, `autocomplete="name"`, libellés « full name »/« nom
   complet ») remplie avec `firstName + " " + lastName` — un attribut/
   autocomplete standard, pas un sélecteur propre à Lever, donc cohérent
   avec la contrainte de la spec (§5.2, aucun sélecteur figé par ATS).

Ces trois écarts sont documentés en détail (offres testées, champs remplis
un par un) dans `WORK_HISTORY.md`, Journal du 02/08/2026.

## Vérifications (`web/`)

Après chaque tâche touchant `web/src/` : `tsc --noEmit`, `lint` (5 warnings
préexistants sans rapport, confirmés inchangés), `vitest run` (589 tests, 75
fichiers — 2 nouveaux, aucune assertion existante modifiée), `build` (28
routes). En fin de plan : `npx playwright test` (Chromium headless_shell
absent de l'environnement, installé via `npx playwright install chromium` —
38/38 tests e2e verts, aucune régression notamment sur `tests/e2e/pack.spec.ts`
malgré l'ajout du bouton dans `PackView.tsx`).

`extension/` : pas d'exécuteur de test automatisé (JS vanilla, DOM de page
tierce non simulable fidèlement par jsdom — comme documenté ailleurs dans ce
dépôt) ; vérifié manuellement comme décrit ci-dessus.

## Bornes respectées

Aucune dépendance npm ajoutée (`git diff web/package.json
web/package-lock.json` vide à chaque tâche). Aucun `any`/`@ts-ignore`/
`eslint-disable` ajouté. Aucun test existant modifié dans son assertion.
Aucun `alert`/`confirm`/`prompt` natif, aucune couleur en dur dans
`web/src/` (le CSS du bouton flottant vit dans `extension/content-autofill.js`,
explicitement hors de cette règle par le plan — page tierce sans les
variables de thème CVMatchr). Push non fait — reste au workflow. `BACKLOG.md` :
ligne déplacée de `## Prêt à coder` vers `## Terminé` (même geste que le
Bâtisseur du 01/08 pour le plan zod, avant même sa fusion).

## Pour la suite

`## Prêt à coder` de `BACKLOG.md` est maintenant vide. Reste en
`## À planifier` : mock interview, LinkedIn (optimisation profil + import),
CRM de networking (arbitrage propriétaire requis), skill gap, journal de
candidature, lettre de démission, plus les 3 chantiers de performance/
robustesse non liés à ce chantier.
