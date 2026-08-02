# Optimisation de profil LinkedIn (analyse + suggestions)

> Spec de conception — 02/08/2026
> Traite la première ligne de `BACKLOG.md` § À planifier : « Manque fonctionnel —
> optimisation de profil LinkedIn (analyse + suggestions) ». Constat source :
> `boucle/constats/2026-08-01-manques-fonctionnels.md` §4 — présente chez 2 produits
> avec un outil dédié (Jobscan, Careerflow).

## 1. Problème

LinkedIn est, pour beaucoup de recruteurs, le premier document consulté — avant même
le CV. CVMatchr n'a aujourd'hui aucune notion de ce canal : il optimise un CV et une
lettre, jamais le profil LinkedIn. Jobscan (scan du profil contre une offre, score,
générateur de titre/résumé par IA) et Careerflow (score sur 14 sections, checklist,
feedback temps réel) couvrent ce manque. Absent à 100 % de CVMatchr.

## 2. Ce que cette spec couvre, et ce qu'elle ne couvre pas

Le constat source (§4) ne distingue qu'un seul axe : « analyse + suggestions » d'un
profil déjà écrit. Il ne parle jamais d'aller chercher ce profil à la place du
candidat — c'est une capacité **distincte**, documentée séparément (§5 du constat,
ligne `BACKLOG.md` à part) et explicitement écartée par cette spec (§8).

**Ce chantier couvre :** coller le texte de son profil LinkedIn (titre + à-propos +
expériences) dans CVMatchr, obtenir un score local instantané et gratuit, plus des
suggestions écrites par IA (accroches réécrites, corrections prioritaires) — un flux
« proche de `ats-score` », comme le suggère le constat.

## 3. Ce que fait la concurrence (rappel du constat)

- Jobscan (`jobscan.co/linkedin-optimization`, 01/08/2026) : scan du profil contre une
  offre, score, générateur de titre/résumé par IA.
- Careerflow (`careerflow.ai/linkedin-optimizer`, 01/08/2026) : score sur 14 sections,
  checklist, feedback temps réel, rédacteur de posts LinkedIn.

Aucune des deux ne publie sa méthode de calcul (produits fermés) — cette spec ne peut
donc s'appuyer que sur ce qui est vérifiable : la structure d'un profil LinkedIn
(titre/headline, section « À propos », expériences, compétences) est publique et
documentée par LinkedIn lui-même (aide LinkedIn, pages « optimiser mon profil »), pas
les seuils exacts d'un concurrent.

## 4. Décisions de conception

### 4.1 Entrée : texte collé, jamais un scraping ou une connexion LinkedIn

**Retenu :** l'utilisateur colle lui-même le texte de son profil dans deux champs —
un pour le titre (headline), un pour le reste (à-propos + expériences) — plus,
en option, une offre visée. Aucune connexion à un compte LinkedIn, aucune URL, aucun
scraping.

**Écarté explicitement : importer le profil via l'URL publique ou une connexion
LinkedIn.** C'est la ligne `BACKLOG.md` distincte « import direct du profil LinkedIn »
(§5 du constat), déjà signalée comme techniquement incertaine (LinkedIn bloque
activement le scraping non officiel) et nécessitant sa propre validation de
faisabilité **avant** d'écrire une spec. La mélanger à ce chantier ferait dépendre un
gain sûr (analyse d'un texte collé) d'un risque non résolu (accès aux données).
Cette spec livre la valeur qui ne dépend d'aucune permission LinkedIn.

### 4.2 Deux champs de texte (titre / corps), pas un seul bloc ni une saisie section par section

**Retenu :** « Titre (headline) » et « Corps du profil (à-propos + expériences) »,
deux `textarea` distinctes. Suffisant pour distinguer un axe « titre » d'un axe
« contenu » dans le score local (§4.4), sans imposer une saisie champ par champ que
personne ne fera pour un simple copier-coller depuis une page LinkedIn.

**Écarté explicitement : réplique des 14 sections de Careerflow** (photo, featured,
recommandations, endorsements…). La plupart de ces sections n'existent pas dans un
texte copié-collé (une photo ne se colle pas, une recommandation est écrite par un
tiers) — les répliquer sans donnée réelle derrière serait un score qui ment. Cette
spec ne score que ce qu'un texte collé peut réellement représenter : titre et corps.

**Écarté explicitement : une saisie structurée par expérience** (poste, entreprise,
dates, comme le formulaire CV). Le profil LinkedIn n'est pas repris ailleurs dans
CVMatchr (contrairement au CV, dont les champs alimentent aussi l'export PDF) — une
structure fine n'aurait aucun autre usage que ce seul écran, pour un coût de saisie
plus élevé qu'un copier-coller de la page « À propos » complète.

### 4.3 Offre visée optionnelle, saisie indépendante de l'éditeur

**Retenu :** un troisième champ, « Offre visée (optionnel) », propre à cet écran —
pas de préremplissage depuis `docStore.pendingJobDesc` ou l'éditeur.

**Écarté explicitement : préremplir depuis l'offre en cours dans l'éditeur.**
`PROJECT_INDEX.md` §11 documente déjà deux bugs vécus par ce dépôt où un état partagé
entre pages, restauré au mauvais moment, écrasait une donnée fraîche avec une donnée
d'une session précédente (`pendingJobDesc`, `useAutoDraft`). Un écran d'optimisation
LinkedIn n'a pas de raison logique d'être lié à l'offre actuellement ouverte dans
l'éditeur — les deux usages (adapter un CV à UNE offre / évaluer un profil LinkedIn
en général) sont distincts. Isoler l'état évite d'ajouter un troisième cas à cette
liste de pièges.

### 4.4 Score local (gratuit, instantané) réutilisant le moteur ATS existant

**Retenu :** un nouveau module `src/lib/linkedin/engine.ts`, qui **réutilise**
`src/lib/ats/engine.ts` plutôt que de dupliquer sa logique :

- `extractJobKeywords` (déjà exporté) : extrait les exigences pondérées d'une offre.
- `contains` et `normalize` (aujourd'hui privées à `ats/engine.ts` — à exporter, sans
  changement de comportement) : réutilisées telles quelles pour vérifier la présence
  d'un mot-clé dans le corps du profil.
- Les types `AtsReport`/`AtsAxis`/`Requirement`/`Priority`/`ScoredKeyword` sont
  réutilisés tels quels : leur forme (score, verdict, axes pondérés, mots-clés
  trouvés/manquants, corrections prioritaires) ne contient rien de spécifique à un CV
  — un profil LinkedIn produit un rapport de la même forme. `AtsAxisKey` est élargi
  de deux valeurs additives (`"title"`, `"completeness"`), sans toucher aux quatre
  existantes.

Quatre axes, deux jeux de poids selon qu'une offre est fournie ou non (la logique
détaillée, formules incluses, est dans le plan d'implémentation) :

| Axe | Poids (avec offre) | Poids (sans offre) | Mesure |
|---|---|---|---|
| Mots-clés | 35 % | *(exclu)* | `extractJobKeywords` + `contains`, comme l'ATS |
| Titre | 20 % | 30 % | longueur du titre (un intitulé LinkedIn par défaut fait ~30 caractères ; une accroche travaillée va plus loin — score plein à 80 caractères) |
| Impact | 25 % | 40 % | proportion de lignes du corps contenant un chiffre (même technique que l'axe Impact de l'ATS) |
| Complétude | 20 % | 30 % | longueur du corps + nombre de paragraphes distincts (un profil à une seule phrase n'est pas un profil rempli) |

**Écarté explicitement : un moteur entièrement neuf, sans lien avec `ats/engine.ts`.**
Le moteur ATS résout déjà, de façon testée et documentée, « quels mots-clés retenir
dans une offre » et « comment vérifier leur présence dans un texte » (accents, pluriel,
composés soudés, lexique de savoir-faire). Réécrire cette logique pour un second
domaine (le profil LinkedIn au lieu du CV) dupliquerait plusieurs centaines de lignes
déjà correctes, contre l'export de deux fonctions et l'élargissement d'un type union.

**Écarté explicitement : renommer `AtsReport`/`AtsAxis`/`Priority` en un nom neutre**
(ex. `ScoreReport`) au moment de les réutiliser. Toucherait tous les appels existants
du panneau ATS pour un seul gain cosmétique (Changements chirurgicaux, `CLAUDE.md`).
Le nom reste celui du premier domaine qui l'a défini ; c'est un compromis de nommage
assumé, pas un oubli.

### 4.5 Suggestions par IA : réutiliser `/api/ats-score` comme modèle, pas comme route

**Retenu :** une nouvelle route `/api/linkedin-score`, sur le même principe que
`/api/ats-score` — texte en entrée, l'IA ne calcule aucun score, elle :
1. extrait les exigences de l'offre visée **si elle est fournie** (`requirements`,
   même forme que l'ATS — vide sinon) ;
2. rédige 1 à 3 corrections prioritaires (`priorities`, zone = « Titre » ou « Corps ») ;
3. propose jusqu'à 3 accroches de titre réécrites (`titleSuggestions`), dans le TON du
   candidat — le prompt inclut `HUMAN_TONE_RULE` (déjà utilisée par `tailor-resume`,
   `editor-chat`, `adapt-letter`) pour que ces réécritures ne sonnent pas IA. C'est
   exactement le défaut que cette règle existe pour éliminer ailleurs dans ce dépôt ;
   l'oublier ici referait apparaître le problème qu'elle a déjà résolu une fois.

Le score reste calculé côté client par le moteur local (§4.4), à partir des
`requirements` retournées — reproductible d'un appel à l'autre, comme l'ATS.

**Écarté explicitement : une route unique partagée entre `ats-score` et
`linkedin-score`.** Les deux analysent des textes de nature différente (un CV formel
structuré / un profil LinkedIn avec un titre court et un ton plus personnel) et
produisent une sortie supplémentaire propre à LinkedIn (`titleSuggestions`) que l'ATS
n'a pas. Fusionner les deux routes introduirait un paramètre de mode et des branches
conditionnelles pour un gain de duplication minime (les deux routes font l'appel IA,
parsent le JSON, coercent — la coercition commune est déjà factorisée, voir §4.6).

### 4.6 Coercition JSON partagée entre les deux routes

**Retenu :** `coerceRequirements`/`coercePriorities`, aujourd'hui privées à
`src/app/api/ats-score/route.ts`, déplacées dans un module partagé
`src/lib/ai/coerceAi.ts` (comportement inchangé), avec une nouvelle fonction
`coerceTitleSuggestions` à côté. `ats-score/route.ts` et `linkedin-score/route.ts`
importent les deux premières ; seule la seconde route utilise la troisième.

**Écarté explicitement : dupliquer `coerceRequirements`/`coercePriorities`** dans la
nouvelle route. Même logique de robustesse JSON (doublons écartés, types douteux
coercés) déjà écrite et testée via `ats-score/route.test.ts` — la dupliquer serait
recopier un bug potentiel deux fois plutôt que le corriger une fois.

### 4.7 Composants d'affichage partagés

**Retenu :** les sous-composants d'affichage du rapport (`Axes`, `Pills`,
`Priorities`, le bloc « Sections détectées », et la fonction `scoreClass`),
aujourd'hui définis à l'intérieur de `AtsPanel.tsx`, sont extraits vers
`src/components/shared/ScoreReportParts.tsx` (comportement visuel inchangé) et
réutilisés par le nouvel écran LinkedIn.

**Écarté explicitement : dupliquer le JSX du rapport dans le nouvel écran.** Même
raisonnement qu'en §4.6 — la forme du rapport (`AtsReport`) est déjà partagée, son
affichage doit l'être aussi, sans quoi une future retouche visuelle (ex. le format
des pastilles de mots-clés) devrait être répétée à deux endroits en risquant de
diverger.

### 4.8 Nouvelle page `/linkedin`, pas une modale

**Retenu :** page dédiée `app/linkedin/page.tsx` (`LinkedInView.tsx`), sur le modèle
de `/profil` (en-tête secondaire, bouton Retour, `.pane.pack-page`). Accès depuis le
menu utilisateur (`UserMenu.tsx`), à côté de « Mes infos » et « Paramètres ».

**Écarté explicitement : une modale accessible depuis `TailorModal`/`AtsPanel`,
comme le panneau ATS.** L'analyse ATS a un sens *dans le contexte* d'un CV et d'une
offre déjà ouverts dans l'éditeur (le CV vient de `docStore.json`). L'optimisation
LinkedIn n'a pas cette dépendance : le texte est collé indépendamment de tout document
ouvert. Une page dédiée, comme `/profil`, correspond mieux à un outil autonome
qu'une modale accrochée à un contexte d'édition qui ne lui sert à rien.

**Écarté explicitement : ajouter un quatrième écran à la navigation segmentée
principale** (`SegmentedNav.tsx`, actuellement Éditeur / Offres / Candidatures).
Ces trois écrans sont les parcours principaux, visités à chaque session ; l'analyse
LinkedIn est un outil ponctuel, comme « Mes infos » ou « Paramètres » — le menu
utilisateur est le bon niveau de visibilité, pas la barre principale.

## 5. Architecture

```
web/src/lib/ats/engine.ts                    Modifié — export `contains`, `normalize` ;
                                              AtsAxisKey élargi ("title", "completeness")
web/src/lib/ai/coerceAi.ts                   Créé — coerceRequirements/coercePriorities
                                              (déplacées) + coerceTitleSuggestions
web/src/app/api/ats-score/route.ts           Modifié — importe depuis coerceAi.ts
web/src/components/shared/ScoreReportParts.tsx  Créé — Axes/Pills/Priorities/
                                              SectionBadges/scoreClass (extraits)
web/src/components/modals/AtsPanel.tsx       Modifié — utilise ScoreReportParts.tsx

web/src/lib/linkedin/engine.ts               Créé — moteur local (§4.4)
web/src/lib/linkedin/engine.test.ts          Créé
web/src/lib/ai/prompts.ts                    Modifié — SYSTEM_LINKEDIN_SCORE
web/src/app/api/linkedin-score/route.ts      Créé
web/src/app/api/linkedin-score/route.test.ts Créé

web/src/app/linkedin/page.tsx                Créé
web/src/components/linkedin/LinkedInView.tsx Créé
web/src/components/layout/UserMenu.tsx       Modifié — lien vers /linkedin

PROJECT_INDEX.md                             Modifié — nouvelle section courte
```

Aucune dépendance npm ajoutée. Aucune nouvelle table Dexie, aucune nouvelle donnée
persistée (l'analyse est éphémère, comme un calcul de score ATS non sauvegardé).

## 6. Flux complet

```
/linkedin (LinkedInView)
  Titre (textarea) + Corps (textarea) + Offre visée (textarea, optionnelle)
  → clic « Analyser mon profil »
    → POST /api/linkedin-score { title_text, body_text, job_desc }
        → SYSTEM_LINKEDIN_SCORE (IA) : requirements (si offre fournie) + priorities
          + titleSuggestions
    → succès : analyzeLinkedInWithRequirements(titleText, bodyText, requirements)
      (score recalculé localement à partir des exigences extraites par l'IA —
      reproductible, comme l'ATS)
    → échec (quota, réseau, clé absente) : repli sur
      analyzeLinkedInProfile(titleText, bodyText, jobDesc) — 100 % local, gratuit,
      instantané — + toast « Analyse IA indisponible — score algorithmique local
      affiché. » (copie identique à `AtsPanel`, cohérence de ton dans tout le dépôt)
  → affichage : score, verdict, 3-4 axes pondérés, accroches suggérées (si IA),
    corrections prioritaires (si IA), mots-clés couverts/manquants (si offre fournie),
    sections détectées (Titre / Corps du profil / Offre visée)
```

## 7. Tests et vérification

1. `web/src/lib/linkedin/engine.test.ts` (Vitest, pur) : `analyzeLinkedInProfile` et
   `analyzeLinkedInWithRequirements` — poids selon offre fournie ou non, formules des
   quatre axes, verdicts, sections détectées. Détail des cas et valeurs attendues
   dans le plan.
2. `web/src/app/api/linkedin-score/route.test.ts` (Vitest, `complete` moqué) : miroir
   de `ats-score/route.test.ts` — coercition, 400 si corps du profil vide, 502 si
   aucune priorité exploitable, `requirements` forcé à `[]` si aucune offre fournie
   même si l'IA en renvoie.
3. **Régression** : `web/src/lib/ats/engine.test.ts` et
   `web/src/app/api/ats-score/route.test.ts` doivent rester verts après l'extraction
   §4.6/§4.7 (comportement inchangé, seulement déplacé).
4. **Vérification manuelle** (aucun test de rendu React n'existe pour `AtsPanel`,
   même précédent ici — cohérent avec le reste du dépôt) : `npm run dev`, ouvrir
   `/linkedin`, coller un titre et un extrait du CV de test
   (`web/tests/fixtures/base_resume.json`) reformulé en profil, coller
   `web/tests/fixtures/job_sharkninja.txt` comme offre visée, vérifier que le score
   varie selon la présence de l'offre, que les accroches suggérées et les corrections
   prioritaires s'affichent, et que sans clé IA disponible le repli local s'affiche
   avec le toast attendu.

## 8. Hors périmètre (chantiers distincts, notés en `BACKLOG.md`)

- Import automatique du profil LinkedIn (scraping ou connexion) — ligne distincte du
  backlog, faisabilité technique à valider en premier (§4.1).
- Réplique des 14 sections façon Careerflow (photo, recommandations, featured…) — pas
  représentable depuis un texte collé (§4.2).
- Génération de posts LinkedIn (Careerflow) — capacité différente, non mentionnée par
  le constat source pour CVMatchr.
- Sauvegarde du profil LinkedIn collé (historique d'analyses) — outil ponctuel sans
  état persistant, comme un calcul de score ATS non sauvegardé.

## 9. Critères de succès vérifiables

1. `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (depuis `web/`) passent, sans
   régression sur le nombre de tests verts existants, avec les nouveaux tests en plus.
2. Aucune dépendance npm ajoutée (`git diff web/package.json web/package-lock.json`
   vide).
3. Coller un titre + un corps de profil sans offre visée produit un score local
   instantané (3 axes : Titre/Impact/Complétude, poids 30/40/30).
4. Ajouter une offre visée fait apparaître un quatrième axe Mots-clés (poids 35, les
   trois autres passant à 20/25/20) et une liste de mots-clés couverts/manquants.
5. Le bouton « Analyser mon profil » tente d'abord l'IA (accroches suggérées +
   corrections prioritaires) et retombe sur le score local avec un toast explicite si
   l'appel échoue.
6. `/linkedin` est accessible depuis le menu utilisateur (`UserMenu.tsx`).
7. `AtsPanel.tsx` (panneau ATS existant) fonctionne à l'identique après l'extraction
   des composants partagés — aucune régression visuelle ni fonctionnelle.

## 10. Limites connues

- Les seuils du moteur local (longueur de titre à 80 caractères, longueur de corps à
  400 caractères, etc.) sont des heuristiques d'ingénierie, documentées comme telles
  — pas des chiffres mesurés chez un concurrent (leurs méthodes de calcul sont
  fermées, §3). Même nature que les poids déjà choisis dans `ats/engine.ts`
  (structure/impact/adéquation), qui ne prétendent pas non plus reproduire une
  méthodologie externe publiée.
- Un profil collé partiellement (ex. sans les expériences) sous-score la Complétude
  et l'Impact sans que ce soit un défaut réel du profil LinkedIn — dégradé assumé,
  comme un CV dont une rubrique masquée fait chuter le score ATS.
