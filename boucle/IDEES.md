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

*Mise à jour du 03/08/2026 (Arbitre) : les trois idées du constat
`2026-08-02-cout-appels-externes.md`, ajoutées non notées par l'Éclaireur le 02/08, sont
maintenant notées et intégrées au classement. Le reste des notes n'a pas bougé — voir
`boucle/journal/2026-08-03-arbitre.md` pour le détail des égalités tranchées.*

*Mise à jour du 03/08/2026 (Arbitre, deuxième réveil) : les trois idées du constat
`2026-08-03-hygiene-du-depot.md`, ajoutées non notées par l'Éclaireur, sont maintenant
notées et intégrées au classement. Les 14 idées déjà notées gardent leurs notes et
justifications à l'identique, seule leur numérotation a changé — voir
`boucle/journal/2026-08-03-arbitre-2.md` pour le détail des égalités tranchées.*

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

### 3. `/pack` : dédupliquer `/api/extract-meta` et sauter l'appel quand l'entreprise/le poste sont déjà connus — 13/20

Constat détaillé : `boucle/constats/2026-08-02-cout-appels-externes.md` §1-2.

| Critère | Note | Justification |
|---|---|---|
| Apport | 3 | Corrige aussi un vrai bug de fond, pas seulement un coût : `resolveMeta` (`lib/letter/adapt.ts:26-31`) fait aujourd'hui primer une extraction IA imparfaite sur une entreprise/poste déjà exacts (venus de `/jobs` via « Candidater ») — le candidat peut se retrouver avec une lettre adressée à une raison sociale reformulée ou tronquée par l'IA. Reste à 3 : le gain principal (latence, appel évité) est peu perceptible en soi. |
| Facilité | 5 | Correction ciblée et déjà entièrement spécifiée par le constat (§1-2) : mémoriser `(jobDesc, résultat)` sur le modèle exact d'`AtsPanel.tsx:39`, et inverser la priorité dans `resolveMeta`. Pas de nouvelle dépendance, terrain connu. |
| Écart | 1 | Pas une capacité comparée à la concurrence — un défaut interne au code de CVMatchr, le constat le dit explicitement (§ Écart à la concurrence). |
| Cohérence | 4 | Viole directement un seuil vérifiable et explicite de `MISSION.md` (« aucun appel facturé répété pour une même donnée dans un même parcours »), sur le parcours « Candidater », l'un des plus centraux du produit. |
| **Total** | **13** | Égalité avec l'idée n°2 tranchée en sa faveur par Écart (4 contre 1) : l'autofill sert davantage la promesse par une capacité comparée à la concurrence, celle-ci corrige un défaut interne. |

### 4. Identification des compétences manquantes vs une offre (« skill gap ») — 12/20 — *estimation Facilité peu fiable*

| Critère | Note | Justification |
|---|---|---|
| Apport | 3 | Va au-delà du score de correspondance actuel : dit concrètement au candidat ce qui manque pour une offre précise, actionnable immédiatement. |
| Facilité | 3 | Chevauchement possible avec `src/lib/ats/engine.ts` (qui extrait déjà les « exigences » de l'offre) jamais vérifié — pourrait être un nouvel affichage du même calcul plutôt qu'un moteur neuf. **Estimation peu fiable** tant que ce chevauchement n'est pas confirmé ou infirmé. |
| Écart | 2 | Présent chez 2 produits (Careerflow, Enhancv), pas une majorité. |
| Cohérence | 4 | Directement lié à l'adéquation candidat/offre — au cœur de « postuler mieux ». |
| **Total** | **12** | Monterait à Facilité 5 si la vérification confirme un simple nouvel affichage du calcul ATS existant ; descendrait si un moteur distinct s'avère nécessaire. |

### 5. Performance `/jobs` — remesurer le chronométrage réel sous throttling — 12/20

| Critère | Note | Justification |
|---|---|---|
| Apport | 3 | Vérifie si le plan déjà livré (poids -56 %, `docs/superpowers/plans/2026-08-01-jobs-allegement-bundle.md`) a effectivement fait passer `/jobs` sous le seuil de 2 s de `MISSION.md`, ou si le chantier doit rouvrir — lève une incertitude sur un chiffre déjà largement investi. |
| Facilité | 5 | Remesure seule, script Playwright + throttling déjà écrit une fois (constat du 31/07) — quelques heures. |
| Écart | 1 | Seuil technique interne à `MISSION.md`, pas une comparaison à la concurrence (les concurrents n'exposent pas leur `/jobs` équivalent sans compte, constat du 31/07 §« Écart à la concurrence »). |
| Cohérence | 3 | Seuil explicite de `MISSION.md` pour la recherche d'offres, un des parcours principaux du produit. |
| **Total** | **12** | Un manque fonctionnel prime sur un dépassement technique sauf facteur 2 (`MISSION.md`) — cette remesure ne construit rien, elle informe seulement si le chantier est clos ou pas. |

### 6. Alléger `/` (l'éditeur) — lazy-load des modales d'import/adaptation — 11/20

| Critère | Note | Justification |
|---|---|---|
| Apport | 2 | `/` reste à ~1,34 Mo (zod compris) mais jamais mesuré contre le seuil de 2,5 s — pas de dépassement confirmé à ce jour, seulement un poids élevé. |
| Facilité | 4 | Même modèle que le plan `/jobs` déjà livré (`import()` dynamique des modales `ImportTextModal`/`TailorModal`/`ImportPdfModal`), terrain connu. |
| Écart | 1 | Chantier de performance pure, pas de comparaison à la concurrence pertinente. |
| Cohérence | 4 | Le seuil de chargement de l'éditeur est un des seuils vérifiables les plus centraux de `MISSION.md` — premier écran du produit. |
| **Total** | **11** | À mesurer d'abord (temps réel sous Slow 4G + CPU x4) avant de décider si le lazy-load est nécessaire — le poids seul ne dit pas si le seuil est dépassé. |

### 7. Robustesse du scan face à une offre malformée — 11/20

| Critère | Note | Justification |
|---|---|---|
| Apport | 3 | Une seule offre malformée d'une source tierce fait échouer tout le scan en silence (`rankOffer` lève sur `contractLabel` absent) — un candidat perdrait un scan entier de résultats pour une seule donnée sale, sans message clair au-delà d'un toast. |
| Facilité | 4 | Correction ciblée probable (isoler l'échec par offre plutôt que par scan entier), terrain connu, pas de nouvelle dépendance. |
| Écart | 1 | Robustesse interne, pas une fonctionnalité comparée à la concurrence. |
| Cohérence | 3 | La fiabilité perçue du chasseur d'offres (une des fonctions cœur) dépend de ne pas perdre un scan entier pour une cause externe. |
| **Total** | **11** | Non reproduit en production à ce jour (le type `JobOffer` rend le champ obligatoire) — une source tierce malformée suffirait à déclencher le cas. |

### 8. Câbler ou retirer le filtre « Cadre / Non-cadre » (`QUALIFICATION_OPTIONS`) — 11/20

Constat détaillé : `boucle/constats/2026-08-03-hygiene-du-depot.md` §4.

| Critère | Note | Justification |
|---|---|---|
| Apport | 3 | Le filtre est déjà câblé jusqu'à l'appel réel à l'API France Travail (`francetravail.ts:97`) et compté dans le nombre de filtres actifs affiché — l'ajouter à l'écran donne au candidat un critère de recherche supplémentaire réellement fonctionnel, sans lui faire découvrir une fausse promesse (aujourd'hui la valeur reste figée sur « indifférent » quoi qu'il fasse). |
| Facilité | 4 | Il ne manque qu'un `<select>` sur le modèle exact de ses deux voisines déjà rendues dans le même fichier (`EXPERIENCE_OPTIONS`, `WORK_TIME_OPTIONS`, toutes deux dans `FilterBar.tsx`) — reste à 4 et pas 5 car une décision produit reste à trancher (l'ajouter, ou retirer tout le champ si jugé sans intérêt), pas seulement du code. |
| Écart | 1 | Aucun concurrent observé n'expose de cas symétrique : un filtre backend prêt mais absent de l'UI n'est par nature pas visible chez un concurrent dont on ne voit jamais le code. Teal et Huntr n'affichent simplement aucun filtre sans effet observable, ce qui confirme le principe sans donner de mesure d'écart directe. |
| Cohérence | 3 | Filtre de recherche d'offres, terrain central de « postuler mieux, plus vite », mais reste un raffinement de recherche plutôt que le cœur du parcours candidature. |
| **Total** | **11** | Égalité de total avec l'idée « Robustesse du scan » (n°7) — profil identique sur les quatre critères (Apport 3, Facilité 4, Écart 1, Cohérence 3). Conservée juste après elle : aucune raison objective identifiée de l'y faire passer devant. |

### 9. Performance `/pack` — mesurer le vrai temps d'interactivité (Monaco/react-pdf) — 11/20

| Critère | Note | Justification |
|---|---|---|
| Apport | 2 | Informe si le seuil de 2,5 s (marge actuelle de 120 ms seulement, constat du 31/07) est réellement tenu — ne construit rien par elle-même. |
| Facilité | 5 | Remesure seule, mais nécessite d'identifier un sélecteur fiable pour « Monaco et react-pdf prêts » (non trouvé lors du premier audit faute de temps) — reste dans l'ordre de quelques heures. |
| Écart | 1 | Seuil technique interne, pas de comparaison à la concurrence disponible (TTFB marketing seul obtenu, non comparable à l'app derrière connexion). |
| Cohérence | 3 | Seuil explicite de `MISSION.md` pour l'éditeur, le cœur du produit. |
| **Total** | **11** | La marge de 120 ms mesurée est trop faible pour trancher sans cette remesure — à traiter comme un quasi-échec plutôt qu'une marge confortable tant que non refait. |

### 10. `/api/editor-chat` : élaguer l'historique et ne pas répéter un `doc_json` inchangé — 10/20

Constat détaillé : `boucle/constats/2026-08-02-cout-appels-externes.md` §3. Chaque message
du chat éditeur (`ChatPanel.tsx`) repart avec tout l'historique de la conversation
(`historyRef.current`, sans limite) **et** le CV/lettre entier en JSON (`doc_json`), même
si le document n'a pas changé depuis le tour précédent — le serveur
(`editor-chat/route.ts:40-48`) ne compare jamais le JSON reçu à celui d'avant. Mesuré sur
le fixture `base_resume.json` (sans photo) : 4 742 caractères de JSON répétés à
l'identique à chaque tour d'une conversation sans modification appliquée, en plus d'un
historique qui grossit de façon quadratique.

| Critère | Note | Justification |
|---|---|---|
| Apport | 2 | Le chat répondrait en théorie plus vite une fois l'historique et le JSON répétés élagués (moins de tokens envoyés/traités), mais aucun constat n'a mesuré de lenteur perçue aujourd'hui — gain réel non chiffré. |
| Facilité | 4 | Correction ciblée décrite précisément par le constat : comparer le `doc_json` reçu à celui du tour précédent côté serveur, limiter l'historique envoyé aux N derniers échanges côté client. Pas de nouvelle dépendance ; reste à 4 et pas 5 car la taille de fenêtre d'historique à retenir est un choix à trancher, pas une valeur déjà donnée. |
| Écart | 1 | Coût interne, pas une capacité comparée à la concurrence. |
| Cohérence | 3 | Correspond au seuil « coût des appels externes » de `MISSION.md`, mais sur une fonctionnalité secondaire (le chat de l'éditeur) plutôt que sur le parcours principal comme l'idée n°3. |
| **Total** | **10** | Égalité avec l'idée « Journal de candidature » tranchée en sa faveur par Cohérence (3 contre 2) : celle-ci sert un seuil explicite de `MISSION.md`, l'autre est en tension avec un principe déjà établi du produit (voir sa justification). |

### 11. Journal de candidature (réalisations, culture d'entreprise, questions à poser) — 10/20

| Critère | Note | Justification |
|---|---|---|
| Apport | 2 | Valeur incertaine pour un candidat isolé — capitalise sur des réalisations au fil du temps, mais demande une saisie manuelle récurrente sans garantie d'usage réel. |
| Facilité | 4 | CRUD simple, pas de nouvelle IA ni dépendance — terrain connu. |
| Écart | 2 | Présent chez 2 produits (Teal, Simplify), pas une majorité. |
| Cohérence | 2 | Va à contre-courant du principe directeur du tracker actuel (statut dérivé, zéro saisie, `PROJECT_INDEX.md` §8 bis) — même tension que le CRM déjà écarté par le propriétaire. |
| **Total** | **10** | Même tension structurelle que la ligne « CRM de networking » déjà écartée (voir Écartées ci-dessous) — signalé explicitement pour que le propriétaire tranche en connaissance de cause plutôt que par surprise. |

### 12. Faire de `DEFAULT_STALE_DAYS` la seule source de vérité du délai de 30 jours — 9/20

Constat détaillé : `boucle/constats/2026-08-03-hygiene-du-depot.md` §3.

| Critère | Note | Justification |
|---|---|---|
| Apport | 1 | Aucun changement observable aujourd'hui pour le candidat : les deux nombres (`DEFAULT_STALE_DAYS = 30` et le `30` en dur de `settingsStore.ts:64`) sont actuellement identiques — le gain est préventif, pas immédiat. |
| Facilité | 5 | Une ligne : `src/state/settingsStore.ts:64` doit importer `DEFAULT_STALE_DAYS` au lieu de répéter `30` en dur. Aucune ambiguïté, aucune décision produit à trancher. |
| Écart | 1 | Défaut d'organisation interne au code de CVMatchr, pas comparable à un concurrent dont on ne voit jamais le code. |
| Cohérence | 2 | Touche un seuil nommé de `MISSION.md` (hygiène du dépôt : « aucun fichier ni export sans appelant démontré »), mais sur une valeur qui régit une fonctionnalité secondaire (le calcul du statut « sans suite » du tracker de candidatures), pas un parcours central. |
| **Total** | **9** | Corrige une désynchronisation silencieuse *potentielle*, pas encore réelle aujourd'hui — à traiter avant qu'un des deux nombres change sans l'autre, pas en urgence. |

### 13. Import direct du profil LinkedIn pour préremplir le CV — 8/20

| Critère | Note | Justification |
|---|---|---|
| Apport | 2 | Réduirait la friction du premier CV, mais l'import PDF/texte existe déjà et couvre l'essentiel du besoin — confort marginal plus qu'un gain net. |
| Facilité | 1 | Faisabilité technique non validée : LinkedIn bloque activement le scraping non officiel (conditions d'utilisation, rate-limiting) — les 2 concurrents qui l'offrent n'exposent pas comment ils contournent cette contrainte. Risque d'être bloquant avant même d'écrire une spec. |
| Écart | 2 | Présent chez 2 produits (Rezi, Kickresume), pas une majorité. |
| Cohérence | 3 | Touche à l'import CV, terrain connu de la promesse « postuler mieux, plus vite », côté onboarding. |
| **Total** | **8** | À vérifier en premier, avant toute spec : la faisabilité technique (API officielle LinkedIn payante ? scraping toléré ?), sans quoi le chantier s'arrête avant de commencer. |

### 14. Supprimer les fonctions mortes de `db.ts` et `completeJson` de `clients.ts` — 8/20

Constat détaillé : `boucle/constats/2026-08-03-hygiene-du-depot.md` §1-2.

| Critère | Note | Justification |
|---|---|---|
| Apport | 1 | Suppression de code jamais exécuté (`deleteDraft`, `listHistoryEntries`, `getHistoryEntry`, `saveExplored`, `listJobsByGrade`, `deleteTemplate` dans `db.ts`, `completeJson` dans `clients.ts`) — aucun effet observable côté produit. |
| Facilité | 4 | Zéro appelant démontré par grep exhaustif pour les sept exports (constat §1-2) — reste à 4 et pas 5 car `saveExplored` porte une ambiguïté à trancher avant de supprimer : son propre commentaire décrit un mécanisme de non-re-notation du chasseur d'offres jamais branché dans le pipeline de scan — à supprimer, ou à réellement câbler si ce mécanisme est toujours voulu. C'est une décision produit, pas seulement une suppression mécanique. |
| Écart | 1 | Défaut d'organisation interne au code de CVMatchr, pas comparable à un concurrent dont on ne voit jamais le code. |
| Cohérence | 2 | Touche le seuil nommé de `MISSION.md` sur l'hygiène du dépôt, mais sur du code de stockage jamais exécuté et invisible pour l'utilisateur — aucun lien avec un parcours candidat. |
| **Total** | **8** | Corrige la violation la plus nette et la plus large des trois idées du constat (sept exports à zéro appelant, la totalité des cas trouvés par l'audit) — mais reste un chantier d'hygiène pure, sans gain candidat direct. |

### 15. Capture d'offre native dans l'extension navigateur (éviter le copier-coller d'URL) — 8/20 — *estimation Facilité peu fiable*

| Critère | Note | Justification |
|---|---|---|
| Apport | 1 | L'essentiel du gain existe déjà via `/api/extract-job` (coller une URL) — l'écart marginal (éviter le copier-coller) n'a jamais été chiffré. |
| Facilité | 3 | S'appuierait sur l'autofill Greenhouse/Lever déjà construit, mais l'ampleur du travail restant n'a jamais été estimée. **Estimation peu fiable.** |
| Écart | 2 | Capture native présente chez les mêmes 7/8 produits que l'autofill, mais CVMatchr couvre déjà l'équivalent fonctionnel par URL — écart réel réduit. |
| Cohérence | 2 | Terrain voisin de l'extension déjà construite, mais gain marginal plutôt que central. |
| **Total** | **8** | Explicitement écartée du premier chantier autofill (spec `2026-08-02-extension-autofill-design.md` §2) faute de gain net démontré face à l'extracteur d'URL existant — à chiffrer une fois Greenhouse/Lever mesurés en usage réel plus large. |

### 16. Générateur de lettre de démission — 8/20

| Critère | Note | Justification |
|---|---|---|
| Apport | 1 | Usage ponctuel, une fois le candidat déjà embauché ailleurs — hors de la mission « produire un CV et une lettre adaptés à une offre précise ». |
| Facilité | 4 | Réutiliserait probablement l'infra lettre existante (`letter/adapt.ts`, templates) — coût faible si un chantier lettre est déjà ouvert pour une autre raison. |
| Écart | 2 | Présent chez 2 produits (Rezi, Kickresume), mention pour mémoire dans le constat source. |
| Cohérence | 1 | Hors du parcours candidature qui est le cœur de la promesse du produit. |
| **Total** | **8** | Mention pour mémoire seulement dans le constat source lui-même — à ne prioriser que si un chantier lettre s'ouvre pour une autre raison, jamais en tête de liste. |

### 17. Compter/plafonner les appels IA comme les job-boards — 8/20 — *sensible : touche
potentiellement à un vrai plafond produit, pas seulement un compteur*

Constat détaillé : `boucle/constats/2026-08-02-cout-appels-externes.md` §4. Aucune des
huit routes IA (`/api/tailor-resume`, `/api/adapt-letter`, `/api/ats-score`,
`/api/editor-chat`, `/api/pdf-to-resume`, `/api/text-to-resume`, `/api/text-to-letter`,
`/api/extract-meta`) n'est comptée ni limitée — `web/src/middleware.ts` ne vérifie qu'un
mot de passe partagé. Seuls les appels `francetravail`/`adzuna`/`jsearch` ont un compteur
(`db.ts:614-659`), et il est explicitement « local et indicatif […] pas à faire
autorité » selon son propre commentaire — rien ne bloque un dépassement. Sans clé
personnelle, tous les appels IA retombent sur la clé serveur partagée
(`GEMINI_API_KEY`).

| Critère | Note | Justification |
|---|---|---|
| Apport | 1 | Un plafond ne fait gagner ni temps ni entretien à un candidat — c'est une mesure de protection du coût serveur, pas une capacité qui sert directement l'utilisateur ; un blocage mal calibré ajoute même de la friction sur le parcours. |
| Facilité | 2 | Pattern de comptage déjà existant à étendre (`bumpApiUsage`/`getApiUsage`, `db.ts:614-659`), mais son propre commentaire le dit « local et indicatif […] pas à faire autorité » — le rendre vraiment autoritaire (avertissement puis blocage) suppose de trancher un seuil produit et une UX de blocage, pas seulement du code. **Estimation peu fiable** tant que ce seuil et ce comportement ne sont pas décidés. |
| Écart | 3 | Jobscan (5 scans/mois gratuits) et Teal (10 crédits IA) plafonnent tous deux chaque geste IA dès leur offre gratuite, vérifié en direct sur leurs pages de tarifs (constat §« Ce que fait la concurrence ») — mais c'est une pratique de maîtrise de coût côté fournisseur, pas une capacité candidate-facing au sens strict du critère. |
| Cohérence | 2 | Un plafond introduit de la friction sur des parcours IA centraux (adapter la lettre, scorer l'ATS) — en tension avec « postuler mieux, plus vite » plutôt qu'à son service, même si nécessaire à la soutenabilité du produit. |
| **Total** | **8** | Dernière du classement à égalité de total (8) parmi quatre autres idées (n°13, 14, 15, 16) : la seule des cinq où la Cohérence traduit une tension active avec la promesse (une friction ajoutée sur un parcours IA central) plutôt qu'un simple terrain voisin ou un défaut d'hygiène neutre et invisible pour l'utilisateur, comme chez les autres. Placée après elles. Signalée explicitement comme sensible : décider d'un plafond sur la clé serveur partagée est un choix de modèle économique, à trancher par le propriétaire en connaissance de cause. |

## Nouvelles idées non notées (Éclaireur, 03/08/2026, 2e réveil)

Constat détaillé : `boucle/constats/2026-08-03-manques-fonctionnels-2.md`. Trois
manques fonctionnels nouveaux, absents du constat du 02/08 déjà classé. Non
notés : c'est à l'Arbitre de les noter et de les intégrer au classement
ci-dessus au prochain réveil.

- **Assistant de négociation salariale** — présent chez Careerflow (IA, arguments
  de négociation à partir de l'offre), Teal (analyse d'offre + comparaison au
  marché) et Simplify (service payant humain, 3/8 produits consultés). Absent à
  100 % de CVMatchr : rien entre l'obtention d'une offre et son acceptation.
  Ampleur estimée moyenne, réutiliserait l'infra IA existante.
- **Alertes sur de nouvelles offres correspondant au profil** — présent chez Teal
  (instantané ou résumé quotidien par e-mail) et Careerflow (e-mail temps réel),
  2/8 produits. CVMatchr est intégralement à la demande : sans notification,
  rien ne prévient le candidat entre deux visites de `/jobs`. **Sensible** :
  contrairement aux deux autres idées de ce constat, ce n'est pas un module de
  calcul pur — ça suppose un envoi programmé serveur (donc potentiellement un
  contact hors navigateur, l'app étant 100 % locale aujourd'hui) ou une
  notification push navigateur avec ses limites. Ampleur estimée grosse.
- **Correction orthographique/grammaticale dédiée avec rapport** — présent chez
  Enhancv (outil dédié, gratuit, liste de fautes) et Kickresume (correcteur IA +
  option de relecture humaine payante), 2/8 produits. Chez CVMatchr, la seule
  voie existante est de le demander au chat libre de l'éditeur (`prompts.ts:337`),
  sans rapport ni liste de fautes. Chevauchement probable avec le panneau ATS
  existant (`AtsPanel.tsx`, axe « Structure ») à vérifier avant de spécifier.
  Ampleur estimée petite.

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
