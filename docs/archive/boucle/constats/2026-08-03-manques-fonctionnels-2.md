# Constat — manques fonctionnels (2e passage) au 2026-08-03

**Mesuré par :** relecture de `PROJECT_INDEX.md` §§4, 7, 8, 8bis, 9 (périmètre
fonctionnel actuel de CVMatchr) + `grep -rniE "grammai|orthographe"` et
`grep -rniE "salaire|negocia|négocia|salary"` et
`grep -rniE "alerte|notification|cron"` sur `web/src/` pour vérifier l'absence
côté code, confrontée à une consultation directe (WebSearch + WebFetch) des sites
officiels des 8 produits de référence, le 2026-08-03. Ce constat complète celui du
2026-08-01 (`2026-08-01-manques-fonctionnels.md`) sans le répéter : les 8 manques
qu'il liste sont déjà classés dans `IDEES.md` (extension = construite, mock
interview et CRM = écartées par le propriétaire, les 5 autres sont aux rangs 1,
2, 4, 11, 13). Les trois manques ci-dessous sont **nouveaux**, jamais mentionnés
dans `IDEES.md` ni dans `## Écartées`.

## Mesures

Vérification côté code que chaque capacité est bien absente de CVMatchr :

- **Négociation salariale** : `salaire`/`salary` n'apparaît que dans le module de
  notation d'offres (`lib/jobs/rank/`, `lib/jobs/profile.ts` — un salaire minimum
  filtre les offres), jamais dans un module d'aide à la négociation. Aucun fichier
  `web/src/lib/**/negoc*` ou équivalent.
- **Alertes / veille passive sur de nouvelles offres** : aucune occurrence de
  `alerte`/`notification`/`cron` liée aux offres (les seules occurrences
  d'« alerte »/« notification » sont `uiStore.ts`/`UiHost.tsx`, les toasts UI
  génériques, sans rapport). Le chasseur d'offres (`PROJECT_INDEX.md` §8) est
  intégralement **à la demande** : l'utilisateur doit rouvrir `/jobs` et relancer
  un scan pour voir de nouvelles offres, aucun mécanisme ne le prévient entre deux
  visites.
- **Correction grammaticale/orthographique dédiée** : une seule occurrence
  d'« orthographe » dans tout `web/src/` — `lib/ai/prompts.ts:337`, une clause
  générique du prompt de `editor-chat` (« tu peux : réécrire, reformuler,
  réorganiser, corriger l'orthographe, adapter le ton ») parmi d'autres capacités
  du chat libre. Il n'existe aucune fonctionnalité dédiée, déclenchable
  explicitement, qui scanne le CV/la lettre et rapporte les fautes trouvées —
  contrairement au score ATS (`AtsPanel.tsx`) qui, lui, a un bouton et un rapport
  structuré. La correction orthographique n'existe qu'en la demandant au chat, à
  l'aveugle, sans liste de fautes ni confirmation qu'aucune n'a été trouvée.

## Ce que fait la concurrence sur ce point

### 1. Assistant de négociation salariale — **moyenne**

- **Careerflow** — https://help.careerflow.ai/en/articles/13623212-salary-negotiator-assistant
  (consulté 2026-08-03) : « Salary Negotiator Assistant », outil IA intégré.
  Évalue si une offre correspond aux compétences/expérience du candidat, génère
  des arguments de négociation (salaire, avantages, titre, date de début), permet
  de s'entraîner sur des scénarios de négociation.
- **Teal** — https://help.tealhq.com/en/articles/10305790-offer-analysis-tool et
  https://help.tealhq.com/en/articles/10280100-compensation-analysis (référencées
  via recherche, contenu non chargeable directement — HTTP 403 sur la première,
  confirmées par recoupement de deux recherches indépendantes le 2026-08-03) :
  « Offer Analysis Tool » qui décompose une lettre d'offre en langage clair avec
  un agent IA pour poser des questions de suivi, et « Compensation Analysis » qui
  compare l'offre au marché à partir des offres déjà suivies dans le tracker.
- **Simplify** — https://simplify.jobs/blog/how-to-negotiate-salary-offer-2
  (consulté 2026-08-03) : service payant, session de 50 minutes avec un
  recruteur humain pour évaluer une offre (dont l'équity) et préparer la
  contre-proposition — garantie remboursement si le gain n'atteint pas 10 000 $.

Trois produits sur huit, dont deux automatisés par IA (Careerflow, Teal) et un
service humain payant (Simplify) — pas une majorité, mais un signal cohérent :
l'aide s'arrête chez CVMatchr à l'obtention de l'entretien/l'offre, jamais à sa
négociation.

Apport concret : au moment où une offre arrive, le candidat n'a aucun repère
(fourchette de marché, formulation) pour savoir s'il doit ou peut négocier — un
moment à fort enjeu financier, entièrement hors du parcours actuel de CVMatchr.

### 2. Alertes / veille passive sur de nouvelles offres — **grosse**, *sensible :
   touche à l'infrastructure serveur (envoi programmé, éventuellement des
   comptes) — voir remarque plus bas*

- **Teal** — https://help.tealhq.com/en/articles/13456939-using-teal-s-job-search
  (référencée via recherche, consulté 2026-08-03) : une recherche sauvegardée
  propose un choix explicite entre alerte instantanée (offres ingérées « presque
  toutes les heures ») et résumé quotidien par e-mail.
- **Careerflow** — https://www.careerflow.ai/job-search (consulté 2026-08-03) :
  alertes e-mail en temps réel dès qu'une offre correspondant aux critères
  (poste, lieu, mots-clés) est publiée.

Apport concret : le chasseur d'offres de CVMatchr est un outil qu'il faut
rouvrir soi-même — pas de mécanisme qui prévient le candidat qu'une offre
correspondant à son profil vient d'apparaître entre deux visites, contrairement
aux deux produits ci-dessus. **Remarque d'ampleur** : contrairement aux deux
autres manques de ce constat, celui-ci ne se règle pas par un module de calcul
pur. CVMatchr est aujourd'hui 100 % local par utilisateur (IndexedDB, pas de
compte, `PROJECT_INDEX.md` §9) — un envoi programmé d'e-mail suppose soit un
job planifié serveur avec un stockage d'adresse e-mail hors du navigateur, soit
une notification push navigateur (qui ne fonctionne que navigateur ouvert et ne
couvre pas le cas où l'utilisateur ne revient jamais). C'est le manque le plus
lourd des trois : il touche potentiellement au sujet sensible « comptes et
authentification » listé dans `MISSION.md`.

### 3. Correction grammaticale/orthographique dédiée avec rapport — **petite**

- **Enhancv** — https://enhancv.com/resources/resume-grammar-checker/ (consulté
  2026-08-03) : outil dédié qui scanne le CV, relève fautes de grammaire et
  d'orthographe, incohérences de temps/format/style, et donne des corrections
  suggérées — gratuit, page produit séparée du reste du service.
- **Kickresume** — cité via https://www.kickresume.com/en/resume-optimization/
  (consulté 2026-08-03) : correcteur orthographique/grammatical intégré par IA
  pour éliminer fautes et formulations maladroites, avec en complément une
  option payante de relecture par un correcteur humain professionnel.
- Pour mémoire, écart avec Jobscan : son Match Report évalue le « ton » du CV
  parmi 30+ paramètres mais rien dans les sources consultées n'indique un rapport
  de fautes dédié comparable — capacité non generalisée à tous, mais réelle chez
  deux acteurs sur huit.

Apport concret : aujourd'hui la seule façon de faire corriger l'orthographe d'un
CV chez CVMatchr est de le demander explicitement au chat de l'éditeur, sans
liste de fautes trouvées ni confirmation que le document est propre — contre un
bouton dédié avec rapport chez deux concurrents. Chevauchement partiel à vérifier
avant de spécifier : le panneau ATS (`AtsPanel.tsx`) est déjà l'emplacement
naturel d'un tel rapport (axe « Structure » existant), un nouvel onglet/axe y
serait probablement moins coûteux qu'un nouveau panneau.

## Écart au seuil de MISSION.md

Seuil : « aucune capacité présente chez ≥ 2 des produits de référence et absente
ici ». Les manques n°1 (3/8 produits) et n°3 (2/8 produits) franchissent le
seuil au sens strict. Le manque n°2 (alertes) n'est confirmé que chez 2/8
produits (Teal, Careerflow) sur les huit consultés — franchit aussi le seuil,
mais avec une base plus étroite que les deux autres constats du 08/01 et
celui-ci pour les items n°1/n°3.

## Écart à la concurrence

En retard sur : l'après-obtention d'une offre (négociation salariale), la veille
passive entre deux visites (alertes), et la vérification orthographique en tant
que fonctionnalité autonome et rapportée (aujourd'hui noyée dans le chat libre).
Aucun des trois n'est un différenciateur où CVMatchr est en avance — à la
différence du tracker à statut dérivé (déjà noté avantage réel dans le constat
du 08/01, toujours vrai, aucun changement mesuré ici).

## Chantiers proposés

1. **Assistant de négociation salariale** — gain attendu : couvre un moment à
   fort enjeu financier aujourd'hui hors du parcours CVMatchr ; réutiliserait
   probablement l'infra IA existante (nouveau prompt, pas de nouvelle
   intégration externe) — proche en coût des chantiers déjà spécifiés comme
   l'optimisation LinkedIn.
2. **Alertes sur de nouvelles offres correspondant au profil** — gain attendu :
   couvre la veille passive, absente à 100 % aujourd'hui ; **signalé sensible**
   — suppose un arbitrage explicite du propriétaire sur l'infrastructure
   (job planifié serveur + stockage d'un contact hors navigateur, ou
   notification push navigateur avec ses limites) avant toute spec, pas
   seulement un chantier de calcul pur comme les deux autres.
3. **Correction orthographique/grammaticale dédiée avec rapport** — gain
   attendu : le plus petit des trois, probablement une extension du panneau ATS
   existant plutôt qu'un nouveau panneau — à vérifier avant de spécifier
   (chevauchement avec l'axe « Structure » de `AtsPanel.tsx`).
