# Constat — manques fonctionnels (3e passage) au 2026-08-05

**Mesuré par :** relecture de `PROJECT_INDEX.md` §§4, 6, 7, 10 (périmètre fonctionnel
actuel de CVMatchr : modèle de données du CV, génération PDF, IA, arborescence UI) +
`grep -rniE "traduc|translat"`, `grep -rniE "portfolio|site (personnel|web)|lien
partag|shareable|public.?link"` et `grep -rniE "relecture|proofread|human review"` sur
`web/src/` pour vérifier l'absence côté code, confrontée à une consultation directe
(WebSearch + WebFetch) des sites officiels des 8 produits de référence, le
2026-08-05. Ce constat complète ceux du 2026-08-01 et du 2026-08-03
(`2026-08-01-manques-fonctionnels.md`, `2026-08-03-manques-fonctionnels-2.md`) sans
les répéter. Les trois manques ci-dessous sont **nouveaux**, jamais mentionnés dans
`IDEES.md` ni dans `## Écartées`.

## Mesures

Vérification côté code que chaque capacité est bien absente de CVMatchr :

- **Traduction du CV/lettre dans une autre langue** : les deux seules occurrences de
  `traduc`/`translat` dans tout `web/src/` sont `lib/ai/prompts.ts:326` — une clause du
  prompt du chat de l'éditeur qui **exclut explicitement** « toute demande hors sujet
  (cuisine, code, culture générale, jeux, **traduction indépendante du CV**… ) » — et
  une occurrence de la fonction CSS `translate(...)` dans `TailorModal.tsx`, sans
  rapport. CVMatchr non seulement n'offre pas de traduction, il la refuse
  explicitement si on la demande au chat libre.
- **Publier son CV en ligne (site personnel ou lien partageable)** : les seules
  occurrences de « portfolio » dans `web/src/` sont des exemples de libellé pour un
  champ personnalisé libre de l'en-tête (`schema.ts:73`, `sections.ts:91/101`,
  `FormEditor.tsx:642/658` — « Permis B », « Portfolio », « Mobilité », « GitHub »
  cités comme exemples de texte que l'utilisateur peut taper lui-même). Aucune trace
  de génération de page web, de lien public ou de partage — le seul export existant
  est le fichier PDF téléchargé (`PROJECT_INDEX.md` §6).
- **Relecture de CV par un humain (service payant)** : zéro occurrence de
  `relecture`/`proofread`/`human review` dans tout `web/src/`. Le seul chemin de
  relecture aujourd'hui est le chat IA de l'éditeur (`editor-chat`, IA uniquement,
  jamais un humain).

## Ce que fait la concurrence sur ce point

### 1. Traduction du CV en une autre langue — **petite à moyenne**

- **Kickresume** — https://www.kickresume.com/en/resume-translation/ (consulté
  2026-08-05) : fonctionnalité dédiée « Proofread & Translate » dans la barre latérale
  de l'éditeur, 8 langues (anglais US/UK, espagnol, portugais, français, allemand,
  tchèque, slovaque, « bientôt plus »), traduction en moins d'une minute, **gratuite**
  y compris pour un compte gratuit, mise en forme préservée, propulsée par GPT-4
  « optimisé pour le contenu de CV ».
- **Enhancv** — https://help.enhancv.com/en/articles/2804484-how-to-create-your-resume-in-another-language
  (consulté 2026-08-05) : changement de la langue de l'éditeur qui traduit
  automatiquement les intitulés de section lors de la création d'un nouveau CV,
  couvrant français, espagnol, allemand et d'autres langues européennes — moins
  abouti que Kickresume (pas de traduction en un clic du contenu déjà écrit) mais une
  capacité réelle et documentée.

Apport concret : un candidat qui postule dans un pays non francophone (ou dont le
recruteur est basé ailleurs) doit aujourd'hui retraduire son CV entièrement à la main
ou via un outil tiers, en perdant la mise en forme — pas de chemin intégré à CVMatchr.

### 2. Publier son CV en ligne (site personnel ou lien partageable) — **moyenne**

- **Kickresume** — https://www.kickresume.com/en/online-web/ (consulté 2026-08-05) :
  générateur de site web personnel en un clic depuis un CV existant, 1 gabarit gratuit
  + 6 gabarits premium, URL publique personnalisable, personnalisation (fond,
  polices, dates).
- **Rezi** — https://www.rezi.ai/rezi-changelog (consulté 2026-08-05, entrée datée
  d'octobre 2024, toujours documentée en 2026) : lien de partage généré
  automatiquement pour chaque CV (`app.rezi.ai/s/<identifiant>`), personnalisable
  depuis octobre 2024 (`app.rezi.ai/s/jacob` au lieu d'une chaîne aléatoire), pensé
  pour « le networking, la candidature et obtenir un avis ».

Les deux formes diffèrent en ampleur (site complet avec gabarits chez Kickresume,
simple page de consultation à lien stable chez Rezi) mais répondent au même besoin :
montrer son CV sans envoyer de fichier PDF téléchargeable. Apport concret : un lien
web se colle dans un message LinkedIn, un e-mail de relance ou une candidature en
ligne sans pièce jointe — CVMatchr ne produit aujourd'hui qu'un fichier PDF à
télécharger et joindre manuellement.

### 3. Relecture de CV par un humain (service payant) — **moyenne**, *service humain,
pas seulement un chantier de code*

- **Careerflow** — https://www.careerflow.ai/resume-review (consulté 2026-08-05) :
  « toutes les relectures sont effectuées par des experts humains », retour détaillé
  sous 3 jours ouvrés par e-mail, trois paliers de prix (79 $/199 $/249 $ selon
  l'ancienneté du candidat, tarifs réduits affichés au 2026-08-05).
- **Rezi** — https://www.rezi.ai/pricing (consulté 2026-08-05) : le plan Pro
  (29 $/mois) inclut une relecture professionnelle gratuite par mois par « un expert
  CV et recrutement », vendue à l'unité sur le plan gratuit (« à partir de 8 $ »).
- **Kickresume** — https://www.kickresume.com/en/resume-optimization/ (consulté
  2026-08-05) : service de relecture professionnelle par « éditeurs humains
  experts », CV et lettre de motivation, disponible en anglais et espagnol.

Trois produits sur huit offrent ce service, tous payants et **humains** (pas de l'IA
supplémentaire) — un signal cohérent que la relecture par un humain reste perçue
comme une valeur ajoutée distincte du correcteur automatique. Apport concret :
CVMatchr n'offre aujourd'hui aucun moyen de faire relire un document par une personne
réelle, seulement par l'IA du chat de l'éditeur — un candidat qui veut un second avis
humain doit sortir du produit.

## Écart au seuil de MISSION.md

Seuil : « aucune capacité présente chez ≥ 2 des produits de référence et absente
ici ». Les trois manques franchissent le seuil : traduction (2/8 : Kickresume,
Enhancv), publication en ligne (2/8 : Kickresume, Rezi), relecture humaine (3/8 :
Careerflow, Rezi, Kickresume — le plus large des trois).

## Écart à la concurrence

En retard sur : la portabilité du CV hors du format PDF (traduction, publication en
ligne) et l'accès à un avis humain payant en complément de l'IA. Point notable : sur
la traduction, CVMatchr n'est pas seulement en retard, il **refuse activement** la
demande dans son chat libre (`prompts.ts:326`) — un candidat qui tente cette demande
aujourd'hui reçoit un rejet explicite plutôt qu'un silence. Aucun des trois manques ne
touche un différenciateur où CVMatchr est en avance (tracker à statut dérivé,
inchangé, toujours un avantage réel non mesuré ici).

## Chantiers proposés

1. **Traduction du CV/lettre dans une autre langue** — gain attendu : réutiliserait
   probablement l'infra IA existante (nouveau prompt dédié, pas de nouvelle
   intégration externe), sur un modèle proche de `tailor-resume` ou `adapt-letter` —
   à vérifier avant de spécifier si un simple prompt de traduction préserve fidèlement
   la structure JSON du CV sans repasser par tout le pipeline de génération.
2. **Publier son CV en ligne (lien partageable)** — gain attendu : la variante la plus
   simple (lien de consultation stable, à la Rezi) semble plus proche de l'existant
   qu'un site personnel complet à la Kickresume (pas de nouveaux gabarits ni
   d'hébergement de site) — mais suppose une décision d'architecture (CVMatchr est
   100 % local aujourd'hui, `PROJECT_INDEX.md` §9 : publier un lien public suppose un
   minimum de stockage ou de rendu côté serveur) à trancher avant toute spec, terrain
   voisin du sujet sensible « migration des données hors d'IndexedDB » nommé dans
   `MISSION.md`.
3. **Relecture de CV par un humain (service payant)** — gain attendu : capacité la
   plus large chez la concurrence (3/8) mais la plus étrangère au produit actuel :
   suppose soit un partenariat avec des relecteurs externes, soit une nouvelle ligne
   de service humaine que CVMatchr n'opère pas aujourd'hui — hors du modèle
   « application locale sans opération humaine côté serveur », touche potentiellement
   au sujet sensible « modèle économique » nommé dans `MISSION.md`.
