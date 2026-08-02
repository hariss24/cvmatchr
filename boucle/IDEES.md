# IDÉES — classement

**C'est le livrable de la boucle.** Elle explore, elle classe, elle écrit ici. Elle
n'implémente rien : le propriétaire lit ce fichier et décide seul de ce qui se construit.

## Comment lire une note

Chaque idée porte quatre notes de 1 à 5 et un total sur 20. Les deux premières comptent
double dans la lecture — une idée forte mais énorme se déclasse d'elle-même, et c'est
voulu : ce qu'on peut livrer vite compte autant que ce qui est beau sur le papier.

| Critère | 1 | 5 |
|---|---|---|
| **Apport** pour un candidat | confort marginal | fait gagner du temps ou des entretiens |
| **Facilité** de réalisation | plusieurs semaines, risque technique | quelques heures, terrain connu |
| **Écart** à la concurrence | tout le monde s'en passe | présent chez la majorité, absent ici |
| **Cohérence** avec la promesse | terrain voisin | au cœur de « postuler mieux, plus vite » |

Une note sans phrase qui la justifie ne vaut rien : chaque idée dit **pourquoi** elle est
notée ainsi, et ce qui la ferait monter ou descendre.

## Comment le propriétaire s'en sert

- `!` devant une ligne = « je la veux, prépare-la ».
- `~~ligne barrée~~` = refusée, elle descend en « Écartées » et n'en remonte plus.
- Une note contestée se corrige à la main : la boucle ne rediscute jamais un arbitrage
  écrit par le propriétaire, elle le recopie tel quel au classement suivant.

---

## Classement

*Premier classement, 02/08/2026. Source : `boucle/BACKLOG.md` (sections « À planifier »
et « Idées », hors lignes déjà écartées par le propriétaire — celles-ci restent
inchangées ci-dessous) et les trois constats de `boucle/constats/`. Deux lignes du
constat manques-fonctionnels ne sont pas classées ici : l'extension navigateur (§1) est
déjà construite (`## Terminé` de `BACKLOG.md`, en attente de fusion, ce n'est plus une
idée) ; le constat CI du 31/07 (`tsc --noEmit` cassé sur `useAutoDraft.test.ts`) est
vérifié résolu par lecture directe du fichier — plus une idée à classer non plus.*

### 1. Optimisation de profil LinkedIn (analyse + suggestions) — 14/20

| Critère | Note | Justification |
|---|---|---|
| Apport | 3 | LinkedIn est la vitrine que les recruteurs consultent en premier pour beaucoup de postes, mais le gain reste indirect (pas une candidature précise) — contrairement au tailoring CV/lettre qui agit directement sur l'embauche visée. |
| Facilité | 5 | Spec et plan déjà écrits et relus contre le code réel (`docs/superpowers/specs/2026-08-02-linkedin-optimisation-design.md`, `docs/superpowers/plans/2026-08-02-linkedin-optimisation.md`) : réutilise `src/lib/ats/engine.ts`, aucune nouvelle dépendance, aucun CSS neuf. Reste à exécuter le plan. |
| Écart | 3 | Présent chez 2 acteurs sérieux (Jobscan, Careerflow), absent à 100 % chez CVMatchr — pas une majorité comme l'extension, mais un canal entièrement ignoré aujourd'hui. |
| Cohérence | 3 | Reste dans « postuler mieux » mais élargit vers un canal (le profil) distinct de la candidature à une offre précise. |
| **Total** | **14** | Descendrait si le plan révélait un chevauchement caché avec l'ATS qui rendrait le nouveau domaine `src/lib/linkedin/` redondant — non constaté à la relecture. |

### 2. Autofill sur d'autres ATS (Workday, iCIMS, SmartRecruiters, Taleo, LinkedIn Easy Apply) — 13/20 — *estimation Facilité peu fiable*

| Critère | Note | Justification |
|---|---|---|
| Apport | 3 | Prolonge le manque le plus large mesuré par l'Éclaireur (autofill présent chez 7/8 produits), mais Greenhouse/Lever eux-mêmes n'ont été vérifiés que sur une offre chacun — l'ampleur réelle du gain par ATS supplémentaire reste à confirmer en usage. |
| Facilité | 2 | Contrairement à Greenhouse/Lever, la structure DOM de ces ATS n'est pas documentée publiquement (spec `2026-08-02-extension-autofill-design.md` §5.1/§8) — reverse engineering à refaire par plateforme, ampleur du travail non chiffrée. **Estimation peu fiable** tant qu'un premier ATS n'a pas été exploré. |
| Écart | 4 | Workday en particulier est très répandu chez les grandes entreprises — chaque ATS couvert élargit sensiblement la part de candidatures concernées. |
| Cohérence | 4 | Prolonge directement un chantier déjà construit et validé en usage réel, cœur de « postuler plus vite ». |
| **Total** | **13** | À rouvrir un ATS à la fois (Workday en premier, le plus répandu) une fois Greenhouse/Lever mesurés sur davantage d'offres réelles — pas seulement une chacune. |

### 3. Identification des compétences manquantes vs une offre (« skill gap ») — 12/20 — *estimation Facilité peu fiable*

| Critère | Note | Justification |
|---|---|---|
| Apport | 3 | Va au-delà du score de correspondance actuel : dit concrètement au candidat ce qui manque pour une offre précise, actionnable immédiatement. |
| Facilité | 3 | Chevauchement possible avec `src/lib/ats/engine.ts` (qui extrait déjà les « exigences » de l'offre) jamais vérifié — pourrait être un nouvel affichage du même calcul plutôt qu'un moteur neuf. **Estimation peu fiable** tant que ce chevauchement n'est pas confirmé ou infirmé. |
| Écart | 2 | Présent chez 2 produits (Careerflow, Enhancv), pas une majorité. |
| Cohérence | 4 | Directement lié à l'adéquation candidat/offre — au cœur de « postuler mieux ». |
| **Total** | **12** | Monterait à Facilité 5 si la vérification confirme un simple nouvel affichage du calcul ATS existant ; descendrait si un moteur distinct s'avère nécessaire. |

### 4. Performance `/jobs` — remesurer le chronométrage réel sous throttling — 12/20

| Critère | Note | Justification |
|---|---|---|
| Apport | 3 | Vérifie si le plan déjà livré (poids -56 %, `docs/superpowers/plans/2026-08-01-jobs-allegement-bundle.md`) a effectivement fait passer `/jobs` sous le seuil de 2 s de `MISSION.md`, ou si le chantier doit rouvrir — lève une incertitude sur un chiffre déjà largement investi. |
| Facilité | 5 | Remesure seule, script Playwright + throttling déjà écrit une fois (constat du 31/07) — quelques heures. |
| Écart | 1 | Seuil technique interne à `MISSION.md`, pas une comparaison à la concurrence (les concurrents n'exposent pas leur `/jobs` équivalent sans compte, constat du 31/07 §« Écart à la concurrence »). |
| Cohérence | 3 | Seuil explicite de `MISSION.md` pour la recherche d'offres, un des parcours principaux du produit. |
| **Total** | **12** | Un manque fonctionnel prime sur un dépassement technique sauf facteur 2 (`MISSION.md`) — cette remesure ne construit rien, elle informe seulement si le chantier est clos ou pas. |

### 5. Alléger `/` (l'éditeur) — lazy-load des modales d'import/adaptation — 11/20

| Critère | Note | Justification |
|---|---|---|
| Apport | 2 | `/` reste à ~1,34 Mo (zod compris) mais jamais mesuré contre le seuil de 2,5 s — pas de dépassement confirmé à ce jour, seulement un poids élevé. |
| Facilité | 4 | Même modèle que le plan `/jobs` déjà livré (`import()` dynamique des modales `ImportTextModal`/`TailorModal`/`ImportPdfModal`), terrain connu. |
| Écart | 1 | Chantier de performance pure, pas de comparaison à la concurrence pertinente. |
| Cohérence | 4 | Le seuil de chargement de l'éditeur est un des seuils vérifiables les plus centraux de `MISSION.md` — premier écran du produit. |
| **Total** | **11** | À mesurer d'abord (temps réel sous Slow 4G + CPU x4) avant de décider si le lazy-load est nécessaire — le poids seul ne dit pas si le seuil est dépassé. |

### 6. Robustesse du scan face à une offre malformée — 11/20

| Critère | Note | Justification |
|---|---|---|
| Apport | 3 | Une seule offre malformée d'une source tierce fait échouer tout le scan en silence (`rankOffer` lève sur `contractLabel` absent) — un candidat perdrait un scan entier de résultats pour une seule donnée sale, sans message clair au-delà d'un toast. |
| Facilité | 4 | Correction ciblée probable (isoler l'échec par offre plutôt que par scan entier), terrain connu, pas de nouvelle dépendance. |
| Écart | 1 | Robustesse interne, pas une fonctionnalité comparée à la concurrence. |
| Cohérence | 3 | La fiabilité perçue du chasseur d'offres (une des fonctions cœur) dépend de ne pas perdre un scan entier pour une cause externe. |
| **Total** | **11** | Non reproduit en production à ce jour (le type `JobOffer` rend le champ obligatoire) — une source tierce malformée suffirait à déclencher le cas. |

### 7. Performance `/pack` — mesurer le vrai temps d'interactivité (Monaco/react-pdf) — 11/20

| Critère | Note | Justification |
|---|---|---|
| Apport | 2 | Informe si le seuil de 2,5 s (marge actuelle de 120 ms seulement, constat du 31/07) est réellement tenu — ne construit rien par elle-même. |
| Facilité | 5 | Remesure seule, mais nécessite d'identifier un sélecteur fiable pour « Monaco et react-pdf prêts » (non trouvé lors du premier audit faute de temps) — reste dans l'ordre de quelques heures. |
| Écart | 1 | Seuil technique interne, pas de comparaison à la concurrence disponible (TTFB marketing seul obtenu, non comparable à l'app derrière connexion). |
| Cohérence | 3 | Seuil explicite de `MISSION.md` pour l'éditeur, le cœur du produit. |
| **Total** | **11** | La marge de 120 ms mesurée est trop faible pour trancher sans cette remesure — à traiter comme un quasi-échec plutôt qu'une marge confortable tant que non refait. |

### 8. Journal de candidature (réalisations, culture d'entreprise, questions à poser) — 10/20

| Critère | Note | Justification |
|---|---|---|
| Apport | 2 | Valeur incertaine pour un candidat isolé — capitalise sur des réalisations au fil du temps, mais demande une saisie manuelle récurrente sans garantie d'usage réel. |
| Facilité | 4 | CRUD simple, pas de nouvelle IA ni dépendance — terrain connu. |
| Écart | 2 | Présent chez 2 produits (Teal, Simplify), pas une majorité. |
| Cohérence | 2 | Va à contre-courant du principe directeur du tracker actuel (statut dérivé, zéro saisie, `PROJECT_INDEX.md` §8 bis) — même tension que le CRM déjà écarté par le propriétaire. |
| **Total** | **10** | Même tension structurelle que la ligne « CRM de networking » déjà écartée (voir Écartées ci-dessous) — signalé explicitement pour que le propriétaire tranche en connaissance de cause plutôt que par surprise. |

### 9. Import direct du profil LinkedIn pour préremplir le CV — 8/20

| Critère | Note | Justification |
|---|---|---|
| Apport | 2 | Réduirait la friction du premier CV, mais l'import PDF/texte existe déjà et couvre l'essentiel du besoin — confort marginal plus qu'un gain net. |
| Facilité | 1 | Faisabilité technique non validée : LinkedIn bloque activement le scraping non officiel (conditions d'utilisation, rate-limiting) — les 2 concurrents qui l'offrent n'exposent pas comment ils contournent cette contrainte. Risque d'être bloquant avant même d'écrire une spec. |
| Écart | 2 | Présent chez 2 produits (Rezi, Kickresume), pas une majorité. |
| Cohérence | 3 | Touche à l'import CV, terrain connu de la promesse « postuler mieux, plus vite », côté onboarding. |
| **Total** | **8** | À vérifier en premier, avant toute spec : la faisabilité technique (API officielle LinkedIn payante ? scraping toléré ?), sans quoi le chantier s'arrête avant de commencer. |

### 10. Capture d'offre native dans l'extension navigateur (éviter le copier-coller d'URL) — 8/20 — *estimation Facilité peu fiable*

| Critère | Note | Justification |
|---|---|---|
| Apport | 1 | L'essentiel du gain existe déjà via `/api/extract-job` (coller une URL) — l'écart marginal (éviter le copier-coller) n'a jamais été chiffré. |
| Facilité | 3 | S'appuierait sur l'autofill Greenhouse/Lever déjà construit, mais l'ampleur du travail restant n'a jamais été estimée. **Estimation peu fiable.** |
| Écart | 2 | Capture native présente chez les mêmes 7/8 produits que l'autofill, mais CVMatchr couvre déjà l'équivalent fonctionnel par URL — écart réel réduit. |
| Cohérence | 2 | Terrain voisin de l'extension déjà construite, mais gain marginal plutôt que central. |
| **Total** | **8** | Explicitement écartée du premier chantier autofill (spec `2026-08-02-extension-autofill-design.md` §2) faute de gain net démontré face à l'extracteur d'URL existant — à chiffrer une fois Greenhouse/Lever mesurés en usage réel plus large. |

### 11. Générateur de lettre de démission — 8/20

| Critère | Note | Justification |
|---|---|---|
| Apport | 1 | Usage ponctuel, une fois le candidat déjà embauché ailleurs — hors de la mission « produire un CV et une lettre adaptés à une offre précise ». |
| Facilité | 4 | Réutiliserait probablement l'infra lettre existante (`letter/adapt.ts`, templates) — coût faible si un chantier lettre est déjà ouvert pour une autre raison. |
| Écart | 2 | Présent chez 2 produits (Rezi, Kickresume), mention pour mémoire dans le constat source. |
| Cohérence | 1 | Hors du parcours candidature qui est le cœur de la promesse du produit. |
| **Total** | **8** | Mention pour mémoire seulement dans le constat source lui-même — à ne prioriser que si un chantier lettre s'ouvre pour une autre raison, jamais en tête de liste. |

## Écartées

- **Préparation d'entretien par IA (mock interview)** — écartée le 02/08/2026. Présente
  chez 4 produits (Rezi, Kickresume, Enhancv, Careerflow), techniquement proche de
  l'existant. Le propriétaire la juge secondaire. Voir
  `boucle/constats/2026-08-01-manques-fonctionnels.md` §2.
- **CRM de networking / suivi de contacts** — écartée le 02/08/2026. Présente chez 4
  produits, mais en tension avec le principe « le suivi ne coûte rien à l'utilisateur ».
  Voir `boucle/constats/2026-08-01-manques-fonctionnels.md` §3.

**Une idée écartée ne remonte jamais d'elle-même**, même si un audit ultérieur la
retrouve chez la concurrence. Seul le propriétaire peut la rouvrir.
