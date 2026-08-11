# 📜 WORK_HISTORY.md — Historique de travail (CVMatchr)

> Journal court et à jour de ce qui a été fait, pour qu'une nouvelle session sache
> d'où on part sans relire tout l'historique git ni l'archive complète. **Toute
> session/agent qui termine une tâche notable ajoute une entrée ici** (voir le
> format en bas de fichier) — pas besoin pour un commit trivial.
>
> Le détail exhaustif, phase par phase, des deux grandes réécritures (Next.js puis
> React PDF) est dans `docs/archive/REWRITE_PROGRESS.md` : **figé, ne plus y
> écrire**. N'y aller que si le résumé ci-dessous ne suffit pas.

---

## État actuel

*(une seule ligne, écrasée à chaque mise à jour — pas un historique)*

**Prochaine étape suggérée :** le **socle comptes + base serveur**. C'est le seul chantier qui transforme l'outil en produit : il débloque d'un coup les huit fonctionnalités listées en tête de `LIMITES.md` — alertes email sur le marché caché (la donnée est déjà produite chaque matin, il n'y a simplement personne à qui l'envoyer), synchronisation multi-appareils, offre payante, partage d'un CV par lien — et ferme la faille du quota, non corrigeable sans compteur serveur. La brique 3 vient d'ajouter du volume mais ne débloque aucune de ces fonctionnalités. Pistes secondaires, par ordre de rapport : **SuccessFactors et Talentsoft** (même méthode Common Crawl que Workday, API non mesurée) ; descendre le seuil SIRENE sous 50 salariés (à mesurer d'abord — le rendement chutait déjà à 0,113 % chez les 50–199) ; **surveiller le poids des données** (mémo 20,6 Mo hebdomadaire, index d'offres 7,9 Mo **quotidien** — presque doublé avec Workday). La chaîne est complète et vérifiée de bout en bout : index hebdomadaire (4 ATS devinés + Workday lu dans Common Crawl), scan quotidien, source branchée dans « Offres », pastille de fraîcheur, suite e2e fiable. Rappel de la mesure qui guide la suite : l'âge médian des offres moissonnées est de **46 jours** — la concurrence sur une offre dépend surtout de son ancienneté, pas du canal de publication.

---

## Résumé des chantiers passés (avant ce fichier)

- **Réécriture Next.js** (juin 2026, branche `feature/refonte-ui-nextjs`) : portage
  complet de l'app Flask/Python (rendu HTML + Playwright/Chromium) vers Next.js 16
  + React 19 + TypeScript. TERMINÉE. Incident notable le 24/06 : Gemini (agent de
  secours) a cassé `main` (suppression de `Toolbar.tsx`) — récupéré via reset sur
  `rewrite-nextjs` + sauvegardes (branche `gemini-backup-committed`).
- **Migration React PDF** (2026-07-04 → 2026-07-06, 5 phases) : passage du rendu
  HTML serveur (Playwright/Chromium) au rendu **react-pdf 100 % client**, puis
  démantèlement complet du moteur HTML serveur (`api/convert`, `render.ts`,
  `mergeHtml.ts`, dépendances Playwright/Chromium). TERMINÉE (Phase 5, 2026-07-06,
  144+ tests Vitest + 24 e2e verts). Détail complet dans
  `docs/archive/REWRITE_PROGRESS.md` et `docs/archive/2026-07-0*-react-pdf-phase-*.md`.
- **Grand ménage documentation** (commit `05840ca`, 2026-07-07) : archivage des
  trackers de la migration (`FILE_MAP.md`, `PROJECT_INDEX.md` v1, `SUIVI_TRAVAUX.md`,
  `REWRITE_PROGRESS.md`…) dans `docs/archive/`, `README.md`/`TODO.md` réécrits pour
  pointer vers `web/`.

---

## Journal

### 2026-08-11 : Supabase Auth, DB & Quotas — Task 7 : Vérification d'étanchéité & documentation
- **Quoi :** Rejeu des tests d'étanchéité PostgreSQL / RLS en Docker (`rls_etancheite.sql` -> `TOUS_LES_TESTS_OK`), création de `web/tests/manual/VERIF_BOUT_EN_BOUT.md`, mise à jour de `LIMITES.md` (verrou mono-utilisateur levé, ajouts des contraintes LWW et non-réplication des tables locales), mise à jour de `PROJECT_INDEX.md` (schéma Supabase, SyncEngine, grille tarifaire IA) et clôture du chantier.
- **Pourquoi :** Task 7 (dernière task) du plan `docs/superpowers/plans/2026-08-10-auth-database-implementation.md`. Valider le comportement bout-en-bout et documenter l'architecture finale.
- **Fichiers touchés :** `web/tests/manual/VERIF_BOUT_EN_BOUT.md`, `LIMITES.md`, `PROJECT_INDEX.md`, `WORK_HISTORY.md`.
- **Résultat vérifs :** `npx tsc --noEmit` propre, `npm run lint` vert (0 erreur, 4 warnings), `npx vitest run` (714/714 tests verts), `npm run build` réussi sans erreur (30/30 pages statiques).

### 2026-08-11 : Supabase Auth, DB & Quotas — Task 6 : Intégration UI — connexion et compteur de quota
- **Quoi :** Enrichissement du composant `UserMenu.tsx` (entrée « Se connecter avec Google » si non connecté, avatar/nom/QuotaBadge/Déconnexion si connecté, masqué si `isConfigured === false`), création du composant `QuotaBadge.tsx` affichant l'utilisation mensuelle des crédits IA via la RPC PostgreSQL `get_user_monthly_ai_usage`, et ajout des tests unitaires `UserMenuAuth.test.tsx`.
- **Pourquoi :** Task 6 du plan `docs/superpowers/plans/2026-08-10-auth-database-implementation.md`. Permettre aux utilisateurs de se connecter et de suivre visuellement leur quota mensuel de crédits IA.
- **Fichiers touchés :** `web/src/components/layout/UserMenu.tsx`, `web/src/components/auth/QuotaBadge.tsx`, `web/src/components/layout/UserMenuAuth.test.tsx`.
- **Résultat vérifs :** `npx tsc --noEmit` propre, `npm run lint` vert (0 erreur, 4 warnings), `npx vitest run` (714/714 tests verts), `npm run build` réussi sans erreur (30/30 pages statiques).
- **Commit :** `c58296b` (`feat(ui): connexion Google et compteur de quota dans le menu utilisateur`).

### 2026-08-11 : Supabase Auth, DB & Quotas — Task 5 : SyncEngine bidirectionnel & sanitization d'import
- **Quoi :** Implémentation du moteur de synchronisation bidirectionnel `syncEngine.ts` (`pushAll`, `pullAll`, `syncAll`, `resolveConflict`, `purgeLocalData`), des fonctions de mapping Dexie ↔ Supabase (`syncMapping.ts`), de la réinitialisation des timestamps de synchro lors des imports JSON dans `backup.ts` (`sanitizeImportedItem`), et raccordement de la purge au changement de compte/déconnexion dans `authStore.ts`.
- **Pourquoi :** Task 5 du plan `docs/superpowers/plans/2026-08-10-auth-database-implementation.md`. Assurer la synchronisation multi-appareils transparente sans fuite de données entre comptes.
- **Fichiers touchés :** `web/src/lib/storage/syncEngine.ts`, `web/src/lib/storage/syncMapping.ts`, `web/src/lib/storage/syncEngine.test.ts`, `web/src/lib/storage/backup.ts`, `web/src/state/authStore.ts`.
- **Résultat vérifs :** `npx tsc --noEmit` propre, `npm run lint` vert (0 erreur, 4 warnings), `npx vitest run` (712/712 tests verts), `npm run build` réussi sans erreur (30/30 pages statiques).
- **Commit :** `160b238` (`feat(sync): moteur bidirectionnel, purge au changement de compte et import sanitise`).

### 2026-08-11 : Supabase Auth, DB & Quotas — Task 4 : Dexie v13 & Soft Deletes
- **Quoi :** Migration Dexie v13 (index `updated_at`, `synced_at`, `deleted_at` sur `history`, `applications`, et `jobs`), ajout de la couche d'adaptation `syncFields.ts` (`toIso`, `pendingPush`, `touch`, `markDeleted`) et conversion des suppressions dures (`.delete()`) en suppressions douces (`markDeleted` + `.put()`). Application des filtres `deleted_at == null` sur l'ensemble des requêtes de lecture de la base IndexedDB.
- **Pourquoi :** Task 4 du plan `docs/superpowers/plans/2026-08-10-auth-database-implementation.md`. Préparer la réplication bidirectionnelle sans résurrection de documents supprimés.
- **Fichiers touchés :** `web/src/lib/storage/syncFields.ts`, `web/src/lib/storage/syncFields.test.ts`, `web/src/lib/storage/db.ts`, `web/src/lib/applications/types.ts`, `web/src/components/ui/UiHost.tsx`.
- **Résultat vérifs :** `npx tsc --noEmit` propre, `npm run lint` vert (0 erreur, 3 warnings), `npx vitest run` (708/708 tests verts), `npm run build` réussi sans erreur (30/30 pages statiques).
- **Commit :** `94f2e8e` (`feat(sync): migration Dexie v13, horodatages de synchro et suppressions douces`).

### 2026-08-11 : Supabase Auth, DB & Quotas — Task 3 : Application des quotas IA
- **Quoi :** Implémentation du garde de quotas serveur et de sécurité `guardAiRequest` (`lib/ai/guard.ts`) et des règles de tarification (`lib/ai/quota.ts`). Suppression du fallback silencieux sur la clé d'environnement serveur `process.env.GEMINI_API_KEY` dans `clients.ts` pour empêcher les visiteurs anonymes de consommer les crédits du serveur. Branchement des 8 routes API IA (`adapt-letter`, `ats-score`, `editor-chat`, `extract-meta`, `pdf-to-resume`, `tailor-resume`, `text-to-letter`, `text-to-resume`).
- **Pourquoi :** Task 3 du plan `docs/superpowers/plans/2026-08-10-auth-database-implementation.md`. Exiger une authentification Supabase avec quota atomique `consume_ai_credit` ou une clé API personnelle dans les en-têtes pour exécuter un appel IA.
- **Fichiers touchés :** `web/src/lib/ai/quota.ts`, `web/src/lib/ai/quota.test.ts`, `web/src/lib/ai/guard.ts`, `web/src/lib/ai/clients.ts`, `web/src/lib/ai/clients.test.ts`, `web/src/lib/supabase/middleware.ts`, et les 8 routes IA + leurs tests unitaires dans `web/src/app/api/`.
- **Résultat vérifs :** `npx tsc --noEmit` propre, `npm run lint` vert (0 erreur, 3 warnings), `npx vitest run` 704/704 tests verts (89 test files), `npm run build` réussi sans erreur (30/30 pages statiques).
- **Commit :** `14c2c79` (`feat(ai): application effective des quotas serveur et fin du repli sur la cle integree`).

### 2026-08-07 : Pertinence et géolocalisation de la source « Marché caché »

**Pourquoi.** Une recherche sur la source « Marché caché » rendait des offres hors-sujet et en filtrait à tort d'autres. Quatre causes identifiées et corrigées.

**Ce qui a été corrigé :**

1. **Filtre région/département par département réel (`dept`)** (commit `34225da`) : Le filtre textuel `normalize(lieu).includes(region)` écartait 91 offres franciliennes dont le libellé était "Paris" sans mention "Île-de-France". Désormais, le géocodage BAN extrait le code département (`dept`), rattaché aux régions via les codes INSEE (`departements.ts`).
2. **Tri à deux niveaux (pertinence puis date)** (commit `a4f3547`) : Le plafond de 60 se remplissait par date seule. Les offres correspondant au mot-clé réellement saisi par le candidat ont désormais la priorité (pertinence 2) sur celles issues de synonymes (pertinence 1).
3. **Persistance conditionnelle & Purge Dexie** (commit `2cdf33e`) : `shouldPersist` refuse les offres avec un score sous le seuil (lettre D). Ajout d'un bouton « Purger les offres hors-sujet » dans l'UI avec confirmation `uiConfirm`.
4. **Resserrement des synonymes HSE et données** (commit `c141226`) : Remplacement des termes isolés "securite" et "data" par des expressions précises.
   - `sécurité informatique` : 382 → 36 offres atteintes (-90,5 %)
   - `données` : 864 → 324 offres atteintes (-62,5 %)

**Vérification :** 692 tests Vitest verts, `npm run build` et `npm run lint` sans erreur (0 erreur, 3 warnings).

### 2026-08-06 : Marché caché — audit complet, puis six corrections mesurées

**Pourquoi.** Trois erreurs en vingt-quatre heures, toutes du même genre : une
étape vérifiée juste après l'avoir écrite, un défaut qui vivait une étape plus
loin, et c'est l'utilisateur ou une mesure faite après coup qui le trouvait. Les
tests passaient à chaque fois — ils testaient ce qui venait d'être construit,
pas ce que la chaîne produit bout à bout. D'où un audit qui part de l'écran du
candidat et remonte, plutôt que du code.

**L'audit.** Treize dimensions (extraction, exactitude Workday, cycle de vie,
doublons, filtre pays, correspondance des titres, plafond, filtre géographique,
texte en direct, coût, CI, conformité, tests). Une seule a pu être menée par
agents avant que la limite de dépense mensuelle ne coupe le reste ; les douze
autres ont été refaites à la main.

Deux constats ont été rapportés puis **retirés après contre-vérification** : « 25 %
de liens morts » (le détecteur lisait un texte de gabarit — les offres étaient
`active: true`, le taux réel est de 2 %) et « les doublons polluent l'affichage »
(ils sont regroupés en aval ; le vrai coût était ailleurs, dans le quota).

**Ce qui a été mesuré et corrigé, par ordre de coût pour le candidat :**

1. **La moitié du catalogue était invisible.** Ces boards sont ceux de grands
   groupes, qui publient en anglais pour des postes en France : « responsable
   RH » trouvait 30 offres et en laissait 147 ; « développeur » 293 contre 434.
   → `synonymes.ts`, 43 familles d'intitulés bâties sur les titres réels.
2. **Le rayon ne marchait pas pour 69 % des offres.** Une recherche lyonnaise ne
   voyait pas les 82 offres de Villeurbanne ; 884 offres de banlieue manquaient
   sur cinq agglomérations. → `geo.mjs` géocode les libellés à la construction :
   31 % → **92 %** d'offres situées.
3. **Une panne totale produisait un workflow vert.** Simulé : les cinq API
   tombant le même matin, le fichier produit était identique à l'octet, le script
   sortait en 0, `git diff` ne voyait rien. L'index serait resté gelé
   indéfiniment. → seuil de 10 % de boards injoignables, plus une péremption de
   14 jours sur les offres reprises d'un board mort.
4. **1 270 offres manquaient à l'appel** — Mango, Michelin, Renault, PwC, la
   RATP, Sanofi, absents alors qu'ils répondent tous correctement. Un gros board
   ouvre une requête par offre (Mango : 299 pour 283) et la moindre qui trébuchait
   faisait perdre le tout. → tolérance de 5 % d'échecs de détail, et attente
   entre réessais portée à 3 s puis 12 s.
5. **Quelques employeurs monopolisaient les résultats** : 34 offres Air Liquide
   sur 60 pour « infirmier ». → dédoublonnage **avant** le plafond et
   distribution par tours entre employeurs.
6. **Le dépôt est public sous MIT** et redistribuait des listes CC BY-NC sans
   attribution. `LIMITES.md` datait le problème au « jour où l'app devient
   payante » : faux, il existait dès la publication. → fichier `NOTICE`.

**Effet combiné, recherche à 30 km, offres affichées :** ressources humaines à
Paris 4 → 49 (4 → 39 employeurs), commercial à Lyon 22 → 58, ingénieur à
Toulouse 5 → 23 employeurs, développeur à Toulouse 8 → 18.

**Ce qui reste ouvert.** SmartRecruiters interdit explicitement l'accès
automatisé dans son `robots.txt` (36 % de l'index) : ce n'est pas un défaut à
coder, c'est une décision à prendre le jour où l'app aura des utilisateurs.
Aucun test ne touche le réseau réel, donc un changement d'API resterait invisible
de la CI. Détail dans `LIMITES.md` § 8.1 bis et § 8.2.

**Commits** : `85822a6`, `f39d57e`, `eb24bc4`, `168ca51`, `43fd841`, `a0f5689`.
139 tests node, 677 Vitest, tsc, lint et build passent. Rien n'est poussé.

### 2026-08-06 : Marché caché — Brique 3, Workday entre par la lecture

**Le verrou.** Les quatre ATS de la brique 1 se découvrent en devinant un slug
depuis un nom d'entreprise. Workday l'interdit : son adresse porte un
identifiant attribué au contrat (`airliquidehr.wd3/AirLiquideExternalCareer` —
« AirLiquide », deviné, rend 404). Or c'est là que sont les grands employeurs
français. **Solution : arrêter de deviner, lire.** Common Crawl publie l'index
des adresses rencontrées sur le web ; on y trouve les vraies.

**Résultat : 361 boards Workday, 8 538 offres françaises.** L'index passe de 503
à 864 boards, les offres légères de 11 076 à **19 555**. Thales 1 541, Airbus
469, Deloitte 417, Chanel 399, Air Liquide 312, Grand Frais 343, Valeo 251,
Michelin 200, RATP 111. Une recherche « ingénieur » à Paris rend 43 offres dont
34 Workday (Safran AI, Exegy, Wakam, Capfi).

**Le service d'index de Common Crawl est en panne**, 504 sur *toutes* les
requêtes, y compris `url=example.com` — vérifié avant d'accuser les nôtres. On
lit donc directement les fichiers sur `data.commoncrawl.org` : 74 ms au lieu
d'un timeout, et une dépendance de moins. `cluster.idx` fait 99 Mo mais il est
trié : une dichotomie sur les plages d'octets isole la zone Workday en
13 appels de 4 Ko, puis 20 blocs (6,7 Mo, 8 s) donnent 1 458 locataires.

**Cinq pièges, tous révélés par la mesure et non par l'intuition :**

1. **La facette pays est *ignorée*, pas refusée**, quand le board ne l'a pas
   configurée : GEA rend ses 356 offres à l'identique avec et sans le filtre
   France. Un premier sondage annonçait « Dollar Tree, 23 838 offres en
   France ». 26 484 fausses offres sur 125 boards. D'où la vérification
   préalable de l'existence de la facette.
2. **`estFrancais` est inutilisable ici.** Workday n'expose aucun pays, et écrit
   « Vitry-sur-Seine », « Gentilly », « Le Trait » — aucune liste de villes ne
   couvrira 35 000 communes. C'est le pays déclaré par Workday qui tranche,
   jamais une déduction depuis le nom de la ville. (`searchText: "France"` ne
   filtre pas non plus : il remonte Bogota, Madrid, Hong Kong.)
3. **Un locataire a souvent plusieurs vitrines, sans recoupement.** Détecté par
   Hariss, qui a comparé une offre à la source : `workday.wd5/Workday` porte
   5 offres FR, `Workday_Early_Career` aucune ; les 18 offres de `..._PROSOL`
   sont absentes des 343 de `..._GRAND_FRAIS` (0 offre commune dans les deux
   cas). N'en garder qu'une jetait **1 253 offres**.
4. **Le locataire n'est pas un nom d'entreprise.** Le candidat lisait « Ag »
   pour Airbus, « Cc » pour Chanel, « Fina » pour Deloitte, « Alliancewd » pour
   Renault. `nomWorkday` déduit le nom de l'adresse : 101 noms redressés sur
   291. Restent 34 sigles non capitalisés (Abb, CSL) — lisibles, non raffinés
   pour ne pas casser les 327 cas justes.
5. **Une entrée sur vingt n'est pas une offre** : Workday renvoie des objets
   sans titre ni chemin (Accenture), qui auraient produit des cartes vides. Et
   **Accenture n'expose pas non plus `locationsText`** : ses 200 offres
   entraient sans ville, donc absentes des recherches par rayon.

**Deux échecs d'exécution, instructifs.**

*Le premier passage a rendu 0 sur 1 458.* Cause : `mois()` et `estFrais()`
exigent une date en argument, appelées sans elles jettent. L'exception,
rattrapée par `enLot`, était **indiscernable d'un board injoignable**. Le
garde-fou `null` ≠ `0` a de nouveau tenu : zéro écriture, index intact. Et le
diagnostic a dû éliminer les fausses pistes une à une (adresses correctes, code
correct en séquentiel 9/11, cadence correcte 36/40) avant d'arriver au code du
script — un échec à *exactement* 100 % ne ressemble pas à un problème réseau.
Corrigé ; le script tient désormais un journal écrit **immédiatement sur
disque** (`appendFileSync`), parce que `console.log` reste en tampon quand la
sortie est redirigée : 1 h 40 sans une ligne alors qu'il échouait depuis la
première seconde.

*Un ouvrier est ensuite resté 15 minutes bloqué* pendant que les 1 450 autres
boards étaient finis : les détails s'ouvraient en file indienne. Passés à six de
front, avec un test qui provoque une panne au milieu du lot pour vérifier que
l'erreur n'est pas avalée par les autres.

**Effet de bord mesuré à temps.** Cette parallélisation, combinée aux 12 boards
de front de `build-boards-offres.mjs`, faisait 72 requêtes simultanées :
121 boards Workday sur 361 sont tombés, dont Thales, Airbus, Deloitte et
Chanel — **6 144 offres perdues**, et le script ne réessayait jamais. Workday
passe à 3 boards de front avec deux réessais : 22 indéterminés au lieu de 123.

**Décision de qualité (Hariss) :** une offre sans lieu exploitable n'entre pas
dans l'index. Le filtre vit **à l'écriture du fichier**, pas seulement chez
chaque ATS — les offres reprises d'un board injoignable viennent du fichier
précédent, donc d'un code plus ancien (93 offres Europcar), et le même trou
existait déjà ailleurs (56 offres `lever:ippon`).

**Vérifié :** `node --test` 112/112 · Vitest 660/660 · `tsc` propre · `lint`
0 erreur · `build` OK · recherche réelle bout en bout. Index final :
19 555 offres, 828 entreprises, **0 sans lieu, 0 sans titre, 0 sans URL**.
`boards-fr.yml` gagne une étape Workday (timeout 180 → 300 min),
`boards-offres.yml` passe de 60 à 150 min.

**Non fait :** SuccessFactors et Talentsoft. Même méthode probable, mais chacun
a son API à mesurer — les empiler aurait multiplié l'inconnu au lieu d'en lever
une proprement.

### 2026-08-05 : `LIMITES.md` — inventaire de ce qui n'est pas résolu

- **Quoi :** un fichier à la racine qui rassemble ce qui était éparpillé entre les sections « Réserves » de six specs, les points de vigilance du journal et les lignes ouvertes de `TODO.md`. Référencé depuis `CLAUDE.md` (lecture nº3), `PROJECT_INDEX.md` et `TODO.md`.
- **Convention posée :** une limite y reste tant qu'elle n'est pas levée ; quand elle l'est, on la barre avec sa date et son commit plutôt que de la supprimer — savoir qu'une contrainte a existé évite d'y retomber.
- **Le document part de la cause, pas du symptôme.** Le verrou principal est que tout vit dans IndexedDB : ni base serveur, ni comptes. Huit fonctionnalités en découlent et attendent le même socle — dont **toute offre payante** (le compteur de quota est local et se remet à zéro en vidant le cache) et les **alertes email sur le marché caché**, dont la donnée est déjà produite chaque matin sans personne à qui l'envoyer.
- **Chiffres consignés :** rendement de la découverte par nom d'entreprise 0,33 % (≥ 200 salariés) → **0,113 %** (PME) ; 399 des 503 boards viennent de listes en **CC BY-NC**, donc bloquantes le jour d'une exploitation commerciale ; trois filtres (contrat, qualification, temps de travail) **inopérants** sur la source marché caché ; rayon géographique vrai pour 53 % des offres seulement ; données commitées 20,4 Mo + 4,2 Mo par semaine et par jour.
- **Commit :** `0f1a4ee` — docs: inventaire des limites non résolues et des fonctionnalités bloquées

### 2026-08-05 : Marché caché — l'index s'ouvre aux PME de 50 à 199 salariés

**Résultat : 448 → 503 boards, 9 714 → 11 098 offres françaises.** Les 55 nouveaux sont tous SmartRecruiters, dont COLISEE FRANCE (1 192 offres), SPIE BATIGNOLLES (541) et SCALIAN (479). L'index léger passe à 11 076 offres, dont **1 385 nouvelles** — premier signal de fraîcheur réel depuis la mise en place de `decouverteLe`.

- **⚠️ Le découpage par département ne fonctionne pas** — à ne jamais réessayer. `departement=75` change bien le total annoncé mais ne renvoie que **12 résultats conformes sur 25**, le premier ayant son siège dans le 95 : le filtre porte sur les **établissements** (une chaîne nationale avec une boutique à Paris ressort dans « 75 ») et le classement reste national, si bien que les premières pages de chaque département sont presque identiques — 400 lignes n'avaient donné que **170 entreprises distinctes**.
- **La section NAF est la bonne partition** : une entreprise n'a qu'une activité principale. Même mesure, 5 146 lignes → **5 122 noms distincts** (0,5 % de recouvrement). C'est la seule façon de passer sous le plafond d'affichage de 10 000 résultats. Ouvre **49 438 PME** (tranche 21 → 33 760, tranche 22 → 15 678).
- **Ces PME ne sont sondées que contre SmartRecruiters**, et c'est une mesure : sur 5 122 d'entre elles testées contre les quatre ATS, 5 boards trouvés, **tous SmartRecruiters**. Le sixième, `ibanfirst` chez Greenhouse, figurait déjà dans l'index via la liste publique. Zéro Lever, zéro Ashby — même constat qu'au-dessus de 200 salariés, où 47 des 49 boards issus de SIRENE sont SmartRecruiters et **aucun** n'est Greenhouse ou Lever.

**L'incident qui a failli passer pour un succès.** Le premier passage réel a rendu **71 724 réponses indéterminées sur 85 840** — 84 % du travail jeté — et j'ai failli prendre ses 11 nouveaux boards pour un résultat. Diagnostic reproduit : SmartRecruiters accepte **environ 4 800 requêtes** puis refuse tout le reste de la fenêtre avec un `429` portant un `retry-after: 0` inutilisable, et `compterFR` traitait tout statut non-OK comme un échec définitif.

- **`compterFR` retente un 429**, avec un plancher de 2 s — repartir aussitôt renverrait dans le mur.
- **La passe SmartRecruiters est bridée** à 4 requêtes de front avec 200 ms de pause (`enLot` accepte désormais une pause). Mesuré : 25 000 requêtes à 12 de front → **4 825 réponses et 20 175 refus** ; à cadence réduite → **6 000 requêtes, zéro refus, 16 par seconde**. Les trois autres ATS gardent la cadence pleine, ils ne bronchent pas.
- Deuxième passage : **70 649 sondages, zéro indéterminée**.
- **La discipline `null` ≠ `0` a tenu pendant l'incident** : aucune des 71 724 non-réponses n'a été écrite, l'index n'a pas été amputé ni commité vide. C'est exactement ce pour quoi elle avait été posée.

- **Coûts :** mémo 12 → **20,4 Mo** ; workflow hebdomadaire relevé de 120 à **180 minutes** (le passage à froid a duré ~75 min ; le mémo en épargnera ensuite la majeure partie).
- **Réserve :** trois sections (22/C, 22/G, 22/H) ont été interrompues par l'API SIRENE, soit ~860 PME non énumérées ce coup-ci. Elles rentreront au passage suivant.
- **Vérifs :** `node --test` **73/73**, Vitest 658/658, `tsc` propre, `lint` 0 erreur, `build` OK, Playwright `jobs` 9/9.
- **Commit :** `99b5c9b` — feat(boards): ouvrir l'index aux PME de 50 à 199 salariés

### 2026-08-05 : Suite Playwright stabilisée — la contention, pas la lenteur

- **Symptôme :** des échecs différents à chaque exécution complète (`chat`, `editor`, `import-text`, `export`, `form-reorder`…), tous verts relancés seuls, et **reproductibles sur du code inchangé** — donc pas une régression.
- **Diagnostic :** tous portaient **la même assertion**, l'apparition de l'aperçu PDF. Chaque test qui y touche fabrique un vrai PDF (react-pdf) puis le rastérise (pdf.js) — du calcul lourd dans le navigateur. À huit workers sur seize cœurs, ces rendus se disputaient le processeur au point de ne jamais aboutir : « element(s) not found », **y compris après quinze secondes**.
- **Hypothèse écartée par la mesure :** porter le délai d'attente global à 15 s ne suffisait pas (8 échecs sur une exécution). À quatre workers, le délai d'origine de 5 s suffit — ce qui désigne la contention, pas la lenteur. La première correction a donc été annulée.

| Parallélisme | Échecs par exécution complète | Durée |
|---|---|---|
| 8 workers (défaut, 50 % des cœurs) | 4, 8, 3, 0, 5, 1 | 39 à 56 s |
| 4 workers (`workers: "25%"`) | **1 sur 31 exécutions** | 26 à 30 s |

- Moins de parallélisme est **à la fois plus sûr et plus rapide** : le surengagement coûtait plus en contention qu'il ne rapportait. Pourcentage plutôt que nombre en dur, pour garder la proportion sur une machine plus petite — un `workers: 4` en dur y serait pire que le défaut.
- **`retries: 1`** rend visible ce qui reste : une régression réelle échoue deux fois et reste `failed`, un aléa passe au second essai et s'affiche `flaky`. C'est aussi ce qui donne enfin un sens à `trace: "on-first-retry"`, qui **n'enregistrait jamais rien** avec `retries: 0` (le second essai n'existait pas) — d'où l'unique échec resté inexpliqué faute de trace. Enregistrer la trace de tous les tests aurait coûté 60 % de temps (27 s → 43 s) pour la même information.
- **Vérifs :** 5 exécutions complètes consécutives avec la configuration finale, **38/38**, 27 s chacune. `tsc` propre, `lint` 0 erreur.
- **Commit :** `d8e9c6e` — fix(e2e): stabiliser Playwright en réduisant le parallélisme

### 2026-08-04 : Marché caché — quatre défauts corrigés, et la fraîcheur affichée

Quatre défauts trouvés en relisant et en mesurant la source fraîchement branchée.

- **Le filtre de lieu était ignoré.** Une recherche à Toulouse renvoyait des offres parisiennes. `web/src/lib/jobs/boardsLieu.ts` applique la distance réelle aux offres qui portent des coordonnées (**5 104 sur 9 579, soit 53 %** — SmartRecruiters est le seul ATS à en fournir) et rapproche les libellés pour les autres, après avoir retiré du libellé le code INSEE et l'arrondissement (« Paris 12e (75012) » → « paris »). **Limite assumée :** le rayon n'est vrai que pour les 53 % à coordonnées ; ailleurs c'est une correspondance de ville stricte, donc une offre à Boulogne sortira d'une recherche « Paris » si son ATS ne donne pas de coordonnées. Une offre sans lieu **ni** coordonnées est gardée — l'absence d'information n'est pas une preuve d'éloignement.
- **Les offres clignotaient.** Un board injoignable voyait ses offres sortir du fichier, puis y revenir le lendemain datées du jour — annoncées comme neuves à tort. Mesuré : **3 boards indéterminés sur 448, 345 offres concernées en un seul passage**. `reprendreIndetermines` garde les entrées du passage précédent, dans la même discipline qu'en Brique 1 : `null` = « on ne sait pas ».
- **`publieLe` ment chez Greenhouse** (c'est `updated_at`, 1 578 offres) : une correction de faute de frappe rajeunissait une annonce de trois mois. L'ancienneté se mesure désormais sur la **plus ancienne des deux dates connues**, `publieLe` et `decouverteLe` — cette dernière ne peut pas être rajeunie par l'entreprise.
- **Le texte arrivait en HTML brut.** Greenhouse encode son `content` en entités (`&lt;p&gt;…`), SmartRecruiters rend du HTML direct. La carte affichait littéralement `<p>ALTEN joue un rôle…`, et surtout la notation ATS et « Adapter mon CV » recevaient les balises comme du texte d'offre. `texteBrut` décode, retire les balises, puis redécode (les entités ne se révèlent qu'au premier passage). Vérifié en direct après correction : **0 offre sur 53 ne contient encore du HTML**.

**Affichage de la fraîcheur** — le mot « Nouveau » existait déjà sur la carte et voulait dire « pas encore ouverte », pas « offre récente » ; il **évinçait la date**, seule information qui dise combien de candidats sont déjà passés. Trois faits tiennent maintenant dans le même emplacement sans un mot de plus : pastille de 6 px = repérée au dernier scan quotidien, couleur de la date = pas encore ouverte, date toujours lisible. Mesuré sur mobile (375 px) : bloc de **79 × 17 px**, une seule ligne, aucun débordement horizontal. Tolérance d'un jour dans `estFraiche` : le scan tourne à 06:00 UTC, sans elle la pastille disparaîtrait chaque nuit.

- **Vérifs :** `node --test` 64/64, Vitest **658/658**, `tsc` propre, `lint` 0 erreur, `build` OK, Playwright `jobs` + `mobile` 13/13.
- **Test en direct :** « ingénieur », Paris + 10 km, marché caché seul → 53 offres, toutes en Île-de-France (Boulogne, Saint-Ouen, Montrouge…), textes propres.
- **Commit :** `f4bcb2d` — fix(boards): lieu, ancienneté fiable, texte lisible, et pastille de fraîcheur

⚠️ **Suite Playwright instable en parallèle sur cette machine** : la suite complète a rendu 5 échecs puis 1 échec sur des specs *différentes* (`editor`, `chat`, `import-text`, `form-reorder`), toutes vertes relancées seules — et **reproduit à l'identique sur le code d'avant ces changements** (vérifié par `git stash`). C'est de la contention, pas une régression. *(Résolu le 05/08/2026 — voir l'entrée du jour.)*

### 2026-08-04 : Marché caché — quatrième source branchée sur « Offres »

- **Quoi :** Brique 2, Tasks 3 à 5. `boardsText.ts` récupère le texte complet en direct ; `boardsFr.ts` expose `searchBoards(profile)` ; `boards` devient un `SourceId` à part entière (route de recherche, dédoublonnage, `SourcePicker`, `JobsView`, `profileSchema`, `getApiUsage`). Décochée par défaut.
- **Coût réseau par ATS :** Greenhouse et SmartRecruiters ont un endpoint par offre (1 appel/offre) ; Lever et Ashby n'en ont pas, leur endpoint liste porte déjà `descriptionPlain` — donc **un seul appel par board touché**, pas par offre.
- **Défaut trouvé à la mesure, pas en relecture :** le plafond de 60 candidates se prélevait sur l'index rangé par `ats/slug/id`, donc toujours sur la tête de l'alphabet. Mesuré en direct sur « développeur » : **0 offre SmartRecruiters sur 60**, tout l'alphabet s'arrêtant avant. Les candidates sont maintenant triées **de la plus récente à la plus ancienne avant le plafond**. Après correction : **39 offres dont 33 SmartRecruiters**, les trois premières publiées le jour même (ALTEN). Le tri sert aussi le but du dispositif — une offre du jour a moins de candidats.
- **Fausse piste à ne pas refaire :** le premier test navigateur ne remontait aucune offre du marché caché. Ce n'était pas le pipeline : le profil cherchait « Webmaster », qui n'apparaît dans **aucun** des 9 579 titres de l'index. Vérifier le mot-clé contre l'index avant de suspecter le code.
- **Test manuel (navigateur, `/jobs`) :** mot-clé « développeur », les quatre sources cochées → **180 cartes affichées dont 37 offres du marché caché**, liens pointant vers greenhouse.io / lever.co / ashbyhq.com / jobs.smartrecruiters.com, textes complets (aucune offre à texte vide), 5,2 s pour le groupe. `BoardIcon` accepte bien un domaine vide et retombe sur l'initiale.
- **Vérifs :** `node --test` 61/61, Vitest **630/630**, `tsc` propre, `lint` 0 erreur (5 warnings préexistants), `build` OK, Playwright **38/38**.
- **Commit :** `25f76e9` — feat(jobs): brancher le marché caché comme quatrième source d'offres

### 2026-08-04 : Marché caché — scan quotidien et date de découverte

- **Quoi :** les deux cadences sont séparées. `.github/workflows/boards-fr.yml` reste hebdomadaire et ne commite plus que l'index et son mémo ; le nouveau `.github/workflows/boards-offres.yml` moissonne les offres **chaque jour à 06:00 UTC** (après la fenêtre du job hebdomadaire, verrou `boucle-autonome` partagé).
- **Champ ajouté :** `decouverteLe` (`YYYY-MM-DD`) sur chaque offre, reporté du passage précédent par `scripts/boards/nouveaute.mjs` et mis au jour courant si l'offre est inconnue. Un « Nouveau depuis hier » côté app se lit désormais directement dans les données.
- **Pourquoi pas `publieLe` :** Greenhouse renvoie `updated_at` — une simple retouche rajeunit l'offre ; Ashby et SmartRecruiters ont chacun leur notion, et le champ est parfois vide. `decouverteLe` est notre propre constat, homogène sur les quatre ATS.
- **Ordre du fichier inchangé** (ats → slug → id) : la datation intervient après le tri, pour qu'un diff quotidien ne montre que ce qui a réellement bougé.
- **Passage d'amorçage :** 445 boards exploitables sur 448 (3 indéterminés), **9 579 offres**, toutes datées du 04/08/2026 — normal, il n'existait pas de passage antérieur. Le signal « nouveau » n'a de sens qu'à partir du passage suivant.
- **Vérifs :** `node --test` 61/61, Vitest 617/617, `tsc` propre, `lint` 0 erreur (5 warnings préexistants), `build` OK.
- **Commit :** `0aa8661` — feat(boards): scan quotidien des offres et date de découverte
- **Point de vigilance :** `boards-offres.json` fait ~3,4 Mo et sera committé quotidiennement. À surveiller sur quelques semaines ; si l'historique gonfle trop, sortir ce fichier du dépôt (artefact ou stockage externe) plutôt que d'espacer le scan.

### 2026-08-04 : Marché caché — Brique 2, Task 2 + réorientation mesurée de la suite

- **Quoi :** orchestrateur `scripts/build-boards-offres.mjs` → `web/src/lib/jobs/data/boards-offres.json` (**9 719 offres légères** issues des 448 boards), test de cohérence `boards-offres.test.ts`, moisson branchée sur le workflow hebdomadaire. Spec et plan de la Brique 2 versionnés (ils étaient restés non suivis).
- **Bug corrigé :** SmartRecruiters pagine par `offset`, **pas par `page`** — `page=0,1,2,3` renvoyait les mêmes 100 offres, dupliquant chaque board autant de fois qu'il avait de pages. Vérifié en direct : `offset=100` renvoie bien les suivantes.
- **Vérifs :** `node --test` 55/55, Vitest 617/617, `tsc` propre, `lint` 0 erreur, `build` OK.
- **Commit :** `d3d3d41` — feat(boards): moisson des offres françaises des boards indexés

**Mesures qui réorientent la suite** (faites le 04/08/2026, à conserver — elles contredisent la direction initiale) :

- **Âge des 9 719 offres : médiane 46 jours**, 75ᵉ centile 146 jours, 4 278 offres (44 %) de plus de 60 jours, 1 490 de moins de 7 jours, **617 de moins de 48 h**. Une offre de 46 jours a déjà été recopiée par les agrégateurs et a accumulé ses candidats. **La concurrence est fonction de l'ancienneté, pas du canal.** D'où la priorité au scan quotidien plutôt qu'à l'élargissement de l'index.
- **Seuil SIRENE mal choisi :** le périmètre « ≥ 200 salariés » de la Brique 1 a été retenu pour une raison d'ingénierie (chaque tranche tenait sous le plafond de pagination), pas au service de l'objectif. Or les grands employeurs sont précisément ceux qui reçoivent le plus de candidatures. Les tranches 11, 12, 21 et 22 (10 à 199 salariés) dépassent **toutes** le plafond d'affichage de 10 000 : des dizaines de milliers de PME sont hors périmètre, et ce sont celles où la concurrence est la plus faible.
- **ATS non énumérables — verrou levé :** l'index public de Common Crawl (126 collections, sans clé) permet d'énumérer les locataires Workday et Flatchr, que la Brique 1 avait écartés faute de pouvoir deviner leur URL. Vérifié : `POST {tenant}.wdN.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs` répond en JSON sans authentification (3M : 651 offres). Deviner l'URL sans Common Crawl échoue — testé sur 10 entreprises françaises, 0 succès (trois inconnues : locataire, datacentre, nom du site).
- **Sites carrières sans ATS :** pas besoin de crawler. Vérifié sur `emploi.sncf.com` — la page de liste expose un `ItemList` JSON-LD et la page de détail un `JobPosting` complet (titre, date, pays `FR`, ville, description de 6 948 caractères), **rendus côté serveur**. Un `fetch` suffit. Firecrawl, crawl4ai, Scrapy et consorts résolvent l'extraction, qui n'est pas le goulot ; le goulot était la découverte d'URL, que Common Crawl règle gratuitement.
- **Réserve honnête :** ce balisage `JobPosting` existe pour Google for Jobs — ces offres sont donc déjà sur Google, et l'app a déjà cette source (`jsearch`, désactivée par défaut, plafonnée à 200 appels/mois). L'avantage de la moisson directe est l'exhaustivité, l'absence de quota et la fraîcheur — **pas** l'invisibilité.

### 2026-08-04 : Marché caché — Brique 2, Task 1 (plan `docs/superpowers/plans/2026-08-04-marche-cache-offres.md`)

- **Quoi :** module `scripts/boards/offres.mjs` — `listerOffresFR(ats, slug, fetchImpl?)` : liste les offres françaises LÉGÈRES (id, titre, lieu, url, date) sans texte, par ATS ; SmartRecruiters paginé (page 0-base, limit 100), URL publique construite (`jobs.smartrecruiters.com/{slug}/{id}`), lat/lng repris quand présents ; `null` = réponse inexploitable, jamais un résultat partiel.
- **Pourquoi :** complète `ats.mjs` (Brique 1, qui ne fait que compter) sans le modifier pour ne prendre aucun risque de régression ; la duplication des URLs est assumée.
- **Fichiers touchés :** créés `scripts/boards/offres.mjs`, `scripts/boards/offres.test.mjs`.
- **Résultat vérifs :** `node --test` 55/55 verts (Tasks B1 + B2-T1) ; pas de fichier web touché.
- **Commit :** `41fa843` — feat(boards): listage léger des offres françaises par board

### 2026-08-04 : Marché caché — Brique 1, Task 8 (plan `docs/superpowers/plans/2026-08-04-marche-cache-index.md`)

- **Quoi :** exécution de la source B (SIRENE), workflow hebdomadaire `boards-fr.yml`, documentation (spec « Réserves », `PROJECT_INDEX.md`). **Deux correctifs** ont été nécessaires à `scripts/boards/sources.mjs` : politesse + retry sur 429 (l'API SIRENE plafonne en pagination rapide — premier run : 2 100 entreprises au lieu de 14 651), et dérivation des slugs depuis `nom_raison_sociale` (repli `nom_complet` sans parenthèse — « ACCOR (ACCOR) » donnait `accor-accor`, jamais le slug du board). Tests ajoutés pour les deux.
- **Pourquoi :** l'index doit couvrir les entreprises françaises et SmartRecruiters, que la source A (listes publiques, 98 % US) ne peut pas atteindre.
- **Chiffres réels :** 14 630 entreprises énumérées, 97 838 couples testés (97 755 exploitables, 83 indéterminées). Index final : **448 boards, 9 714 offres FR** (source A seule : 399 / 3 980), dont **47 `smartrecruiters`** et 49 entrées avec SIREN. Accor retrouvé (`smartrecruiters`/`accor`, 193 offres FR, SIREN 602036444). Mémo : 128 275 couples.
- **Fichiers touchés :** créé `.github/workflows/boards-fr.yml` ; modifiés `scripts/boards/sources.mjs`, `sources.test.mjs`, `web/src/lib/jobs/data/boards-fr.json`, `boards-fr-testes.json`, `docs/superpowers/specs/2026-08-04-marche-cache-index-design.md`, `PROJECT_INDEX.md`.
- **Résultat vérifs :** `node --test` 46/46 ; `tsc` OK ; `lint` 0 erreur ; Vitest 612/612 ; `build` OK.
- **Commit :** `e6a84c9` — feat(boards): source SIRENE, rafraîchissement hebdomadaire et documentation
- **Note :** rendement réel de la source B ~0,33 % des entreprises testées ; des employeurs connus (Nexton, Thales) restent hors index (nom légal ≠ slug du board) — inscrit dans la spec « Réserves ».

### 2026-08-04 : Marché caché — Brique 1, Task 7 (plan `docs/superpowers/plans/2026-08-04-marche-cache-index.md`)

- **Quoi :** test de cohérence Vitest `web/src/lib/jobs/data/boards-fr.test.ts` (6 champs, `ats` connu, `offresFR ≥ 1`, pas de doublon, trié) + étape CI `Tests des scripts de l'index des boards` dans `web.yml`.
- **Pourquoi :** même convention que `rome-data.test.ts` — on teste le fichier produit, pas les scripts ; un zéro dans l'index ou un ordre instable doit casser la suite.
- **Fichiers touchés :** créé `web/src/lib/jobs/data/boards-fr.test.ts` ; modifié `.github/workflows/web.yml`.
- **Résultat vérifs :** `node --test` 44/44 ; `tsc` OK ; `lint` 0 erreur ; Vitest **612/612** (607 + 5) ; `build` OK.
- **Commit :** `8c02aa3` — test(boards): cohérence de l'index et tests de script en CI

### 2026-08-04 : Marché caché — Brique 1, Task 6 (plan `docs/superpowers/plans/2026-08-04-marche-cache-index.md`)

- **Quoi :** `scripts/boards/lot.mjs` (concurrence plafonnée, une tâche qui jette ne tue pas le lot), orchestrateur `scripts/build-boards-fr.mjs` (CLI `--source`, `--complet`, `null` jamais écrit), et **premier index réel issu de la source A**.
- **Pourquoi :** l'orchestrateur relie les cinq modules ; l'exécution réelle de la source A valide la chaîne de bout en bout.
- **Chiffres réels (source A, 04/08/2026) :** 15 862 slugs dans les listes publiques, 15 850 réponses exploitables / 12 indéterminées, **399 boards français, 3 980 offres FR**, ~5 min. Conforme à l'estimation (200-400).
- **Fichiers touchés :** créés `scripts/boards/lot.mjs`, `scripts/boards/lot.test.mjs`, `scripts/build-boards-fr.mjs`, `web/src/lib/jobs/data/boards-fr.json` (399 entrées), `web/src/lib/jobs/data/boards-fr-testes.json` (15 850 couples).
- **Résultat vérifs :** `node --test` 44/44 verts ; `tsc` OK ; `lint` 0 erreur ; Vitest 607/607 ; `build` OK.
- **Commit :** `71a4462` — feat(boards): orchestrateur et premier index issu des listes publiques

### 2026-08-04 : Marché caché — Brique 1, Task 5 (plan `docs/superpowers/plans/2026-08-04-marche-cache-index.md`)

- **Quoi :** module `scripts/boards/sources.mjs` — `slugsDesListes()` (listes publiques Greenhouse/Lever/Ashby de Feashliaa, CC BY-NC, isolées pour remplacement futur) et `entreprisesFrancaises()` (SIRENE, tranches 31→53, paginé à 25).
- **Pourquoi :** deux sources de découverte complémentaires — la source A balaie les slugs publics (98 % américains), la source B part des entreprises françaises et est la seule voie vers SmartRecruiters.
- **Fichiers touchés :** créés `scripts/boards/sources.mjs`, `scripts/boards/sources.test.mjs`.
- **Résultat vérifs :** `node --test` 41/41 verts (Tasks 1-5) ; pas de fichier web touché.
- **Commit :** `4cc6784` — feat(boards): énumération des listes publiques et des entreprises SIRENE

### 2026-08-04 : Marché caché — Brique 1, Task 4 (plan `docs/superpowers/plans/2026-08-04-marche-cache-index.md`)

- **Quoi :** module `scripts/boards/memo.mjs` — `cle`, `mois`, `estFrais` (TTL mensuelle), `nomDepuisSlug`, `trierIndex`/`trierMemo`, `fusionner` (ajout/màj/retrait d'un board à zéro, siren conservé).
- **Pourquoi :** deux fichiers aux rôles opposés — l'index (`boards-fr.json`) doit rester un diff lisible, le mémo (`boards-fr-testes.json`) retient tout, échecs compris, sans quoi l'incrémental n'existe pas.
- **Fichiers touchés :** créés `scripts/boards/memo.mjs`, `scripts/boards/memo.test.mjs`.
- **Résultat vérifs :** `node --test` 34/34 verts (Tasks 1-4) ; pas de fichier web touché.
- **Commit :** `5b64cd7` — feat(boards): index, mémo des tests et TTL mensuelle

### 2026-08-04 : Marché caché — Brique 1, Task 3 (plan `docs/superpowers/plans/2026-08-04-marche-cache-index.md`)

- **Quoi :** module `scripts/boards/ats.mjs` — `compterFR(ats, slug, fetchImpl?)` par ATS (Greenhouse, Lever, Ashby, SmartRecruiters), avec distinction stricte `null` (panne réseau/5xx/JSON illisible = « on ne sait pas ») vs `0` (testé, rien trouvé).
- **Pourquoi :** sans cette distinction, une panne d'un ATS viderait l'index au premier incident et le commiterait ; SmartRecruiters est compté via `totalFound` filtré côté serveur (`country=fr`).
- **Fichiers touchés :** créés `scripts/boards/ats.mjs`, `scripts/boards/ats.test.mjs`.
- **Résultat vérifs :** `node --test` 23/23 verts (Tasks 1-3) ; pas de fichier web touché.
- **Commit :** `aa5da85` — feat(boards): comptage des offres françaises par ATS, sans confondre panne et vide

### 2026-08-04 : Marché caché — Brique 1, Task 2 (plan `docs/superpowers/plans/2026-08-04-marche-cache-index.md`)

- **Quoi :** module `scripts/boards/france.mjs` — `estFrancais(lieu, paysIso?)`, fonction pure : champ pays structuré → marqueur de pays → ville/région française, avec gardes contre les homonymes étrangers (Paris TX, Grande-Bretagne).
- **Pourquoi :** reconnaître « une offre en France » malgré les quatre formats de lieu incompatibles des ATS ; sans la règle ville/région, deux boards réels (On Running, Loft Orbital) sortiraient entièrement de l'index.
- **Fichiers touchés :** créés `scripts/boards/france.mjs`, `scripts/boards/france.test.mjs`.
- **Résultat vérifs :** `node --test` 13/13 verts (Task 1 + 2) ; pas de fichier web touché.
- **Commit :** `8c5a3b2` — feat(boards): détection des offres situées en France

### 2026-08-04 : Marché caché — Brique 1, Task 1 (plan `docs/superpowers/plans/2026-08-04-marche-cache-index.md`)

- **Quoi :** module `scripts/boards/slugs.mjs` (nom d'entreprise → slugs candidats), jumeau de `ats.ts` de l'app, épinglé par des vecteurs de test identiques ; commentaire de jumelage ajouté dans `ats.test.ts`.
- **Pourquoi :** le script de build (`.mjs`) ne peut pas importer le `.ts` de l'app ; la dérivation est dupliquée et verrouillée par tests pour qu'une divergence casse une suite.
- **Fichiers touchés :** créés `scripts/boards/slugs.mjs`, `scripts/boards/slugs.test.mjs` ; modifié `web/src/lib/jobs/ats.test.ts` (commentaire 3 lignes).
- **Résultat vérifs :** `node --test` 5/5 verts ; `tsc --noEmit` OK ; `lint` 0 erreur (5 warnings pré-existants) ; Vitest 607/607 ; `build` OK.
- **Commit :** `d97ef03` — feat(boards): dérivation des slugs candidats, jumelle de celle de l'app

### 2026-08-03 : Détecteur d'ATS — quatre ATS au lieu de deux, choisis par la mesure

- **Quoi :** ajout d'Ashby et SmartRecruiters ; interrogation en parallèle ;
  `boardUrl()` centralise les adresses de pages carrières ; Dexie v12 purge les
  `none` de la v11.
- **Pourquoi :** sur un scan réel, **9 entreprises sur 9 rendaient `none`**. Un
  sondage de 8 ATS sur 49 entreprises françaises a montré que Greenhouse et Lever
  seuls ne couvrent quasiment que la tech américaine. Résultat du sondage :
  ashby 8, lever 6, smartrecruiters 4, greenhouse 2 ; workable, recruitee,
  teamtailor et personio **0**. Nexton — présente dans le scan de l'utilisateur —
  a 137 offres sur SmartRecruiters.
- **Fichiers touchés :** `web/src/lib/jobs/ats.ts`, `ats.test.ts` (réécrit :
  accents corrompus), `web/src/components/jobs/JobCard.tsx`, `JobsView.tsx`,
  `web/src/lib/storage/db.ts`, `PROJECT_INDEX.md`, spec du 03/08.
- **Vérif :** 607 tests verts, `tsc --noEmit` propre, `lint` 0 erreur, `build` OK.
  **Vérifié à l'écran** : le lien « Offres directes chez Nexton » s'affiche sur la
  carte et mène à careers.smartrecruiters.com/nexton (Lille 6 postes, Lyon 11).

### 2026-08-03 : Détecteur d'ATS — Phase 1 (Task 6 et 7, plan `docs/superpowers/plans/2026-08-03-detecteur-ats.md`)

- **Quoi :** résolution en tâche de fond des ATS et affichage d'un lien direct sur la carte de l'offre.
- **Pourquoi :** trouver les offres à la source permet de réduire la concurrence par rapport aux jobboards classiques.
- **Fichiers touchés :** modifiés `web/src/components/jobs/JobsView.tsx`, `web/src/components/jobs/JobCard.tsx`, `web/src/app/globals.css`, `PROJECT_INDEX.md`, `WORK_HISTORY.md`.
- **Résultat vérifs (`web/`) :** `npm test`, `npm run lint`, `npm run build` tous verts.

### 2026-08-03 : Détecteur d'ATS — Phase 1 (Task 5, plan `docs/superpowers/plans/2026-08-03-detecteur-ats.md`)

- **Quoi :** ajout d'un bouton "Exporter l'annuaire ATS" dans la page Paramètres et de son handler `exportAtsDirectory`.
- **Pourquoi :** permettre de récupérer un dictionnaire clé-valeur JSON de l'annuaire mis en cache.
- **Fichiers touchés :** modifiés `web/src/app/settings/page.tsx` et `web/src/lib/storage/backup.ts`.
- **Résultat vérifs (`web/`) :** `tsc --noEmit`, `lint`, `build` tous verts.

### 2026-08-03 : Détecteur d'ATS — Phase 1 (Task 4, plan `docs/superpowers/plans/2026-08-03-detecteur-ats.md`)

- **Quoi :** ajout de la table `atsDirectory` dans Dexie (`db.ts`, v11) et des helpers associés (`getAtsEntry`, `saveAtsEntry`, `allAtsEntries`).
- **Pourquoi :** stocker localement le résultat de la résolution des ATS (y compris les "none") pour éviter de bombarder les APIs Greenhouse/Lever au fil de la navigation.
- **Fichiers touchés :** modifié `web/src/lib/storage/db.ts`.
- **Résultat vérifs (`web/`) :** `tsc --noEmit`, `lint`, `npm test` tous verts.

### 2026-08-03 : Détecteur d'ATS — Phase 1 (Task 3, plan `docs/superpowers/plans/2026-08-03-detecteur-ats.md`)

- **Quoi :** création de la route API `POST /api/jobs/ats` pour résoudre par lot les ATS d'une liste d'entreprises (limite 60).
- **Pourquoi :** le proxy côté serveur est obligatoire pour contourner le CORS des APIs de Greenhouse et Lever (interdites depuis le navigateur).
- **Fichiers touchés :** créé `web/src/app/api/jobs/ats/route.ts`.
- **Résultat vérifs (`web/`) :** `tsc --noEmit`, `lint` tous verts.

### 2026-08-03 : Détecteur d'ATS — Phase 1 (Task 2, plan `docs/superpowers/plans/2026-08-03-detecteur-ats.md`)

- **Quoi :** implémentation de la fonction `resolveAts` pour interroger les endpoints publics de Greenhouse et Lever et vérifier la présence d'offres.
- **Pourquoi :** permet de vérifier si un slug d'entreprise est valide et actif sur un des ATS supportés.
- **Fichiers touchés :** modifiés `web/src/lib/jobs/ats.ts` et `web/src/lib/jobs/ats.test.ts`.
- **Résultat vérifs (`web/`) :** `tsc --noEmit`, `lint`, `vitest run src/lib/jobs/ats.test.ts` (12 tests verts), `build` tous verts.

### 2026-08-03 : Détecteur d'ATS — Phase 1 (Task 1, plan `docs/superpowers/plans/2026-08-03-detecteur-ats.md`)

- **Quoi :** création de `lib/jobs/ats.ts` (types `AtsProvider`, `AtsMatch`, constante `NO_ATS` et fonctions pures `normalizeCompany` et `atsSlugs`) et de ses tests `ats.test.ts`. Les slugs sont dérivés en minuscules, sans accent, en variante tiretée et collée.
- **Pourquoi :** première brique pour le détecteur d'ATS, permettant de deviner les slugs possibles pour une entreprise donnée.
- **Fichiers touchés :** créés `web/src/lib/jobs/ats.ts` et `web/src/lib/jobs/ats.test.ts`.
- **Résultat vérifs (`web/`) :** `tsc --noEmit`, `lint`, `vitest run src/lib/jobs/ats.test.ts` (5 tests verts), `build` tous verts. Aucune dépendance npm ajoutée.


### 2026-08-02 : Extension navigateur — autofill de candidature Greenhouse/Lever (Tasks 1-3, plan `docs/superpowers/plans/2026-08-02-extension-autofill.md`)

- **Quoi :** nouveau répertoire `extension/` (Manifest V3, JavaScript vanilla,
  zéro dépendance npm) qui remplit les formulaires de candidature Greenhouse
  et Lever depuis un paquet {identité, lettre, CV en base64} préparé sur
  `/pack` — `manifest.json`, `content-bridge.js` (pont `postMessage` →
  `chrome.storage.local`), `popup.html`/`popup.js`, `lib/fieldMatch.js`
  (reconnaissance générique de champ) et `content-autofill.js` (bouton
  flottant + remplissage, jamais de soumission). Côté `web/src/` :
  `lib/extension/autofillPackage.ts` (construction pure du paquet, testée
  TDD — rouge confirmé en déplaçant temporairement le fichier avant de
  l'écrire, puis vert), `lib/extension/bridge.ts` (`postAutofillPackage`,
  `postMessage` + accusé de réception avec délai de 800 ms) et le bouton
  `ExtensionExportButton.tsx` monté dans `PackView.tsx`.
- **Pourquoi :** manque fonctionnel le plus large mesuré par l'Éclaireur le
  01/08 (autofill présent chez 7 des 8 produits de référence, absent de
  CVMatchr). Spec : `docs/superpowers/specs/2026-08-02-extension-autofill-design.md`.
  Plan : `docs/superpowers/plans/2026-08-02-extension-autofill.md`.
- **Écarts constatés au plan, corrigés par vérification réelle (pas supposée) :**
  1. Le plan ne stubait que `lib/fieldMatch.js` en Task 1, mais `manifest.json`
     référence aussi `content-autofill.js` (créé en Task 3) — un chargement
     réel dans Chrome (`chromium --headless=new --load-extension=...`)
     échouait avec « Could not load javascript 'content-autofill.js' for
     script » tant que ce fichier n'existait pas. Stub vide ajouté, même
     modèle que `fieldMatch.js`.
  2. `fieldMatch.js` (Task 3) cherchait les identifiants documentés par
     l'API Greenhouse (`first_name`, `last_name`, `email`, `phone`, `resume`,
     `cover_letter`) via l'attribut `name`. Mesuré sur une offre Greenhouse
     réelle (`job-boards.greenhouse.io/thehonestcompanysandbox/jobs/140167`,
     02/08/2026) : ces identifiants sont exposés en attribut `id`, pas
     `name`, sur le DOM rendu — l'attribut `name` HTML est vide sur ces
     champs. `findField`/`findFileField` vérifient maintenant les deux.
  3. La spec §9.5 exige « au moins Nom complet et Email » sur Lever, mais
     Lever n'a pas de champ prénom/nom séparé : un seul champ « Full name »
     (`name="name"`, `label` = « Full name✱ », mesuré sur une offre Lever
     réelle, `jobs.lever.co/Aprio/cb5984b4-b2de-4662-8691-3b7ea2a21a44/apply`,
     02/08/2026). Ajout d'une entrée `fullName` (attribut `name="name"`,
     `autocomplete="name"`, libellés « full name »/« nom complet ») dans
     `FIELD_HINTS`, remplie avec `firstName + " " + lastName` — toujours un
     attribut/autocomplete standard, jamais un sélecteur propre à Lever.
- **Vérification manuelle réelle (protocole spec §7/plan Task 3 Step 4),
  automatisée via Playwright + Chromium headless=new + `--load-extension`
  faute d'affichage graphique dans cet environnement — flux bout en bout
  identique à un usage réel : `/pack` → clic « Préparer pour l'extension »
  → ouverture de l'offre → clic sur le bouton flottant :**
  - **Greenhouse** (`job-boards.greenhouse.io/thehonestcompanysandbox/jobs/140167`) :
    7/7 champs remplis (prénom, nom, email, téléphone, ville, LinkedIn — ce
    dernier via un champ `question_876060` reconnu par libellé — et le CV en
    pièce jointe, confirmé par le nom de fichier `CV_Testeur_Autofill.pdf`
    apparu dans le DOM après remplacement du widget d'upload par l'état
    « fichier attaché »). Aucune soumission (URL inchangée après clic).
  - **Lever** (`jobs.lever.co/Aprio/cb5984b4-b2de-4662-8691-3b7ea2a21a44/apply`) :
    6/8 champs remplis (nom complet, email, téléphone, ville, LinkedIn via
    `urls[LinkedIn]` reconnu par libellé, CV en pièce jointe confirmé par
    `C:\fakepath\CV_Testeur_Autofill_Lever.pdf`) — prénom/nom séparés non
    remplis (dégradé attendu, absorbés par `fullName`), les deux champs
    obligatoires du critère §9.5 (nom complet, email) le sont. Aucune
    soumission (URL inchangée après clic).
- **Fichiers touchés :** créés `extension/manifest.json`,
  `extension/content-bridge.js`, `extension/content-autofill.js`,
  `extension/lib/fieldMatch.js`, `extension/popup.html`, `extension/popup.js`,
  `extension/README.md`, `web/src/lib/extension/autofillPackage.ts`,
  `web/src/lib/extension/autofillPackage.test.ts`,
  `web/src/lib/extension/bridge.ts`,
  `web/src/components/pack/ExtensionExportButton.tsx` ; modifié
  `web/src/components/pack/PackView.tsx`.
- **Résultat vérifs (`web/`) :** `tsc --noEmit`, `lint` (5 warnings
  préexistants sans rapport), `vitest run` (589 tests, 75 fichiers — 2
  nouveaux tests verts), `build` (28 routes générées) tous verts. Aucune
  dépendance npm ajoutée. `extension/manifest.json` : JSON valide, chargement
  Chrome sans erreur (vérifié après correction de l'écart n°1).
- **Task 4 (même réveil) :** `extension/` documenté dans `PROJECT_INDEX.md`
  (§2 structure + nouvelle section 8 ter, résumant les deux écarts mesurés
  ci-dessus). Plan bouclé (4/4 tasks), 3 commits.

### 2026-08-01 : Retrait de zod du bundle JS de toutes les pages sauf l'éditeur (plan `docs/superpowers/plans/2026-08-01-zod-global-allegement-bundle.md`)

- **Quoi :** `DEFAULT_RESUME`/`DEFAULT_LETTER` (deux littéraux objets, aucun
  appel zod) extraits de `lib/resume/schema.ts` — le fichier qui définit tous
  les schémas zod de l'app — vers un nouveau fichier zod-libre,
  `lib/resume/defaults.ts` (`import type` uniquement vers `schema.ts`). Les 14
  fichiers (production + tests) qui les consommaient sont repointés vers ce
  nouveau fichier, en 3 commits (`docStore.ts`/`docStore.test.ts` d'abord, puis
  `normalize.ts`/`newResume.ts`/`profile.ts`/`letter/adapt.ts`, puis les 7
  fichiers de test restants). Plus aucun fichier n'importe ces deux constantes
  depuis `schema.ts` (vérifié par grep, seule une mention en commentaire
  subsiste, inoffensive).
- **Pourquoi :** `docStore.ts`, chargé sur **toutes** les routes via
  `RootLayout → UiHost → useGlobalUndoRedo`, importait `DEFAULT_RESUME`/
  `DEFAULT_LETTER` **par valeur** depuis `schema.ts` — un module JS s'exécute
  en entier à son évaluation, donc importer n'importe quel export de valeur de
  ce fichier embarquait tout zod (283 Ko) dans le bundle de l'importeur, même
  sur des routes (`/login`, `/help`…) sans aucun besoin de validation de CV.
  Constat initial : Journal 2026-08-01 précédent (`/jobs`, chunk zod partagé
  retrouvé identique sur `/`, `/login`, `/help`, `/pack`). Spec :
  `docs/superpowers/specs/2026-08-01-zod-global-allegement-bundle-design.md`
  — documente aussi un premier correctif partiel (ne migrer que `docStore.ts`
  avec un ré-export dans `schema.ts`) testé et **réfuté** par la mesure (le
  chunk zod restait identique sur toutes les routes tant qu'un seul autre
  fichier multi-routes touchait encore `schema.ts` par valeur).
- **Fichiers touchés :** création de `lib/resume/defaults.ts` ; modifiés :
  `lib/resume/schema.ts`, `state/docStore.ts`, `state/docStore.test.ts`,
  `lib/resume/normalize.ts`, `lib/resume/normalize.test.ts`,
  `lib/storage/newResume.ts`, `lib/storage/useAutoDraft.test.ts`,
  `lib/profile/profile.ts`, `lib/profile/profile.test.ts`,
  `lib/letter/adapt.ts`, `lib/letter/adapt.test.ts`,
  `lib/pdfgen/ResumeDocument.test.tsx`, `lib/pdfgen/LetterDocument.test.tsx`,
  `lib/templates/defaults.test.ts`.
- **Résultat vérifs :** `tsc --noEmit`, `lint` (une seule erreur pré-existante
  et sans rapport, `app/settings/page.tsx:35`, confirmée présente avant ce
  chantier via `git stash`), `vitest run` (587 tests, 74 fichiers, aucune
  assertion changée) tous verts après la migration complète (Task 3). 3
  commits (un par task du plan).
- **Mesure finale (Task 4, build de prod propre, `.next` supprimé avant
  rebuild, serveur redémarré) :** le chunk zod de ce build
  (`2jtker1b16bz3.js`, 283 405 o, 485 occurrences du mot « zod », identifié
  sans ambiguïté malgré un second fichier de 1,44 Mo contenant fortuitement le
  mot — en fait une table de métriques de police contenant `zodieresis`, 1
  seule occurrence, sans rapport) :

  | Route | Avant (o) | Après (o) | Δ | zod présent |
  |---|---|---|---|---|
  | `/` (éditeur) | 1 336 939 | 1 336 975 | +36 (bruit) | **oui** (légitime) |
  | `/login` | 1 041 693 | 755 611 | -286 082 | non |
  | `/help` | 1 053 919 | 767 837 | -286 082 | non |
  | `/pack` | 1 055 011 | 769 067 | -285 944 | non |
  | `/jobs` | 1 088 472 | 802 423 | -286 049 | non |
  | `/history` | 1 040 110 | 754 028 | -286 082 | non |
  | `/profil` | 1 043 719 | 757 637 | -286 082 | non |
  | `/settings` | 1 066 563 | 781 683 | -284 880 | non |
  | `/candidatures` | 1 066 749 | 780 667 | -286 082 | non |

  Confirmé : `/` garde le chunk zod (légitime, les modales d'import/tailor
  l'utilisent réellement via `normalize.ts`), les 8 autres routes ne le
  chargent plus, et chacune perd bien plus que le seuil de 250 000 o exigé par
  le plan (critère §7.4 de la spec). `/` reste à ~1,34 Mo, hors périmètre de ce
  chantier — piste distincte notée en `BACKLOG.md` § Idées.

### 2026-08-01 : Allègement du bundle JS initial de `/jobs` (plan `docs/superpowers/plans/2026-08-01-jobs-allegement-bundle.md`)

- **Quoi :** `buildRomeTargets` (`lib/jobs/rome.ts`) et `buildRankContext`
  (`lib/jobs/rank/index.ts`) passent d'un chargement statique du référentiel
  ROME (1,43 Mo) à un `import()` dynamique caché en mémoire (module-level
  promise), déclenché seulement au premier scan. `JobsView.tsx` attend
  désormais `buildRankContext` et charge `profileSchema.ts` (zod) par
  `import()` dynamique au montage plutôt qu'en import statique.
- **Pourquoi :** `docs/archive/boucle/constats/2026-07-31-performance.md` mesurait `/jobs`
  à ~3,9 s sous Slow 4G, contre un seuil MISSION.md de 2 s — imputable au
  poids réseau (1 Mo+ mesuré alors, 2,43 Mo re-mesuré le 01/08/2026 avant ce
  chantier, voir la spec pour le désaccord non tranché entre les deux
  mesures). Le référentiel ROME entier n'était utile qu'au moment d'un scan,
  jamais à l'atterrissage.
- **Fichiers touchés :** `lib/jobs/rome.ts`, `lib/jobs/rome.test.ts`,
  `lib/jobs/rank/index.ts`, `lib/jobs/rank/index.test.ts`,
  `lib/jobs/rank/criteria.test.ts`, `components/jobs/JobsView.tsx`,
  `components/jobs/JobsView.scan.test.ts`.
- **Résultat vérifs :** `tsc --noEmit`, `lint`, `vitest run` (584 tests),
  `build` et `playwright test tests/e2e/jobs.spec.ts` (9 tests) tous verts
  après chaque tâche. Un commit par tâche (3 commits).
- **Mesure finale (Task 4, build de prod propre, `.next` supprimé avant
  rebuild) :** poids JS total référencé par le HTML de `/jobs` avant tout
  clic : **1 088 377 o** (13 fichiers), contre **2 488 883 o** mesurés le
  01/08/2026 avant ce chantier — **-56 %**. Le chunk contenant
  `rome-competences.json` (1,43 Mo, confirmé par grep `M1855`) est bien
  absent du chargement initial, se charge une seule fois au premier clic sur
  « Rechercher » (vérifié par un script Playwright ad hoc, jeté après usage)
  et ne se recharge pas à un second scan dans la même session — critères
  §7.2a et §7.4 de la spec remplis.
  **Cible de 700 Ko NON atteinte (critère §7.3)** : un chunk de 283 405 o
  contenant zod (1112 occurrences du mot, donc la bibliothèque elle-même, pas
  seulement des schémas) reste chargé au premier atterrissage de `/jobs`.
  Investigation : ce chunk est **partagé par toute l'app** (retrouvé
  identique sur `/pack` et `/history`), chargé via `docStore.ts` (importé par
  `JobsView.tsx` pour `setPendingJobDesc`/`setCompany`/`setRole`) qui dépend
  transitivement du schéma zod du CV (`lib/resume/schema.ts`) — une
  dépendance **totalement indépendante** de `profileSchema.ts` (celui-ci a
  bien été retiré du bundle initial, sa signature dynamique fonctionne). La
  spec 2026-08-01 §2.3 avait attribué ce poids à `profileSchema.ts` seul ;
  cette mesure montre que c'était une attribution incomplète — le même chunk
  zod était déjà référencé sur `/`, `/login`, `/help`, `/pack` avant ce
  chantier (déjà noté comme point non résolu par l'audit du 31/07, chantier
  proposé n°3). Hors périmètre de ce plan (qui ne touchait que
  `profileSchema.ts`) : ne pas retoucher `docStore.ts` ou
  `lib/resume/schema.ts` sans nouvelle spec — impact potentiel sur toutes les
  pages qui consomment `docStore`.
- **Non fait faute de temps/environnement :** chronométrage Slow 4G + CPU x4
  (méthodologie de l'audit du 31/07) — Chromium a dû être installé dans cette
  session (`npx playwright install chromium`), le temps n'a pas permis de
  relancer une mesure de timing complète après l'avoir fait ; seule la mesure
  de poids (Task 4 §7.3) et la vérification fonctionnelle (e2e + réseau) ont
  été faites.

Les entrées de **juillet 2026** (97 entrées) sont dans
[`WORK_HISTORY-2026-07.md`](WORK_HISTORY-2026-07.md).

---

## Format d'une entrée

Nouvelle entrée **en tête** du Journal (ordre antichronologique) :

```
### AAAA-MM-JJ : Titre court
- **Quoi :** ce qui a été fait.
- **Pourquoi :** la raison / le déclencheur.
- **Fichiers touchés :** liste, ou renvoi au commit.
- **Résultat vérifs :** ce qui a été vérifié concrètement (commande + résultat), ou N/A si doc-only.
- **Commit :** hash + message (si applicable).
```
