# LIMITES.md — ce que CVMatchr ne sait pas encore faire

> Inventaire des limites **connues et non résolues**, et des fonctionnalités
> **bloquées par une brique d'infrastructure absente** (comptes, base serveur,
> paiement). Chaque ligne dit d'où vient la limite et ce qui la lèverait — pas
> une liste de souhaits, une liste de contraintes constatées.
>
> À ne pas confondre avec :
> - `TODO.md` — les fonctionnalités souhaitées, par priorité.
> - `WORK_HISTORY.md` — le journal de ce qui a été fait et pourquoi.
> - `PROJECT_INDEX.md` — l'architecture actuelle.
>
> **Convention :** une limite reste ici tant qu'elle n'est pas levée. Quand elle
> l'est, on la barre en indiquant la date et le commit, on ne la supprime pas —
> savoir qu'une contrainte a existé évite d'y retomber.

**Dernière mise à jour : 11 août 2026.**

---

## 1. ~~Le verrou principal : tout vit dans le navigateur~~ (Levé le 11/08/2026 — commit `160b238`)

`PROJECT_INDEX.md` §1 : CVMatchr intègre désormais Supabase Auth (OAuth Google), une base PostgreSQL distante (RLS, fonctions atomiques de quota `consume_ai_credit`), et un moteur de réplication bidirectionnelle (`SyncEngine`).

### 1.1 Nouvelles limites d'architecture d'authentification et de synchronisation

| Limite | Ce qui se passe concrètement |
|---|---|
| ~~**Conflits hors-ligne (Last-Write-Wins)**~~ | **Levé le 15/08/2026** (chantier *Le serveur devient la source unique*) : la double copie et le moteur de réplication bidirectionnelle ont été supprimés. Le serveur Supabase est désormais la source unique de vérité. |
| **Photos de profil en base64 dans JSONB** | Les photos de profil sont stockées encodées en base64 directement dans le champ JSONB `content` (table `documents`). Le catalogue des documents sépare désormais les résumés légers du contenu complet, limitant le transit de la photo à l'ouverture dans l'éditeur. Aucun stockage objet (Supabase Storage) n'est raccordé. |
| ~~**Tables Dexie non synchronisées**~~ | **Levé le 15/08/2026** : `profile` (« Mes infos »), `jobProfile` (« Critères de recherche ») et `templates` (« Modèles de lettre ») sont désormais persistés sur le serveur dans les tables `user_settings` et `templates`. |
| ~~**Briques RGPD UI absentes**~~ | **Partiellement levé le 20/08/2026** : la page `/compte` porte la suppression du compte, qui déclenche la cascade `ON DELETE CASCADE`. **L'export des données en un clic n'existe toujours pas** : une demande de portabilité se traite encore à la main. |
| **Mots de passe compromis acceptés** | Supabase sait refuser un mot de passe figurant dans les fuites connues (« Prevent use of leaked passwords »), mais **cette option est réservée au plan Pro** — constaté le 21/08/2026 sur le plan gratuit. Notre seule règle est donc une longueur de 8 caractères : `motdepasse123` est accepté. Contournement possible sans changer de plan : interroger nous-mêmes l'API publique HaveIBeenPwned au moment du choix du mot de passe. |

---

## 2. Sources d'offres — ce qui reste hors de portée

### 2.1 LinkedIn et Indeed

Inscrit dans `TODO.md` en priorité haute et toujours ouvert : **les deux
bloquent les robots**. Aucune solution retenue à ce jour. C'est une des raisons
d'être du marché caché — contourner le problème plutôt que l'affronter.

### 2.2 ATS hors de portée

`docs/superpowers/specs/2026-08-04-marche-cache-index-design.md`, « Hors scope » :

- ~~**ATS exigeant l'URL du locataire** : Workday, SuccessFactors, Talentsoft.~~ **Levé pour Workday le 06/08/2026** (commit de la brique 3) : les adresses ne se devinent toujours pas, elles se **lisent** dans l'index public de Common Crawl (`scripts/boards/crawl.mjs`). 2 467 vitrines énumérées, **361 boards français, 8 538 offres**. **Levé pour Talentsoft le 21/08/2026** : voir §2.2 quater. La contrainte reste entière pour **SuccessFactors** — voir §2.2 ter.
- **ATS à authentification** : Taleez, Flatchr, Digitalrecruiters, Welcome to the Jungle. Aucune piste.

### 2.2 ter SuccessFactors reste hors de portée — mesuré, pas supposé

Sondé le 21/08/2026 depuis `careers.bouygues-construction.com`. La plateforme est
bien identifiée (CDN `rmkcdn.successfactors.com`), et l'extraction serait facile
une fois l'adresse connue : `sitemap.xml` liste toutes les offres avec la ville
dans le slug. **C'est la DÉCOUVERTE qui bloque, pas la moisson.**

- L'espace de noms partagé de SuccessFactors est `*.jobs2web.com` : **39 hôtes
  dans Common Crawl, aucun français** (Assa Abloy, BNSF, Illinois, London-gov).
- `bouygues-construction.jobs2web.com` n'existe pas : les clients français sont
  tous sur un domaine propre.
- Les préfixes `successfactors.eu` et `successfactors.com` rendent **0 bloc**
  dans l'index CDX.
- Le seul endpoint structuré documenté (OData `JobRequisition`) exige des
  permissions Recruteur non publiques, côté employeur.

⚠️ Deux pistes séduisantes ont été **réfutées** lors de la recherche du
21/08/2026, et ne doivent pas être reprises sans preuve neuve : SuccessFactors
n'expose **pas** de `sitemap.xml` public standard à la racine du domaine, et
l'agrégateur tiers qui annonce moissonner 275 000 offres SuccessFactors n'a
fourni aucune preuve vérifiable.

**Piste non épuisée** : il existerait une liste publique d'instances RMK
(`cetteup.com`), non vérifiée faute de budget. À tester en premier le jour où le
sujet est rouvert — l'effort est faible.

### 2.2 quater Ce que Talentsoft coûte et ne dit pas

Intégré le 21/08/2026 (`scripts/boards/talentsoft.mjs`). Un seul appel RSS
(`/handlers/offerRss.ashx?LCID=1036&top=1000`) rend tout le board avec titre,
lieu, description et date — c'est l'ATS le moins cher de la chaîne. Mais :

- **Plafond de 1 000 offres par board, silencieux.** Mesuré le 21/08/2026 :
  SPIE et EDF rendent exactement 1 000 offres avec `top=2000`. Aucun champ ne
  signale la troncature et **aucune pagination n'a été trouvée** sur cet
  endpoint. Les boards les plus fournis sont donc incomplets, sans qu'on sache
  de combien.
- **Aucun code pays dans le flux.** `LCID=1036` sélectionne la **langue**
  française, pas le pays : PSA y publie Kenitra et Amsterdam, et des locataires
  entiers sont suisses ou allemands (Chur, Vaduz, 130 adresses argoviennes).
  C'est le géocodage Base Adresse Nationale qui tranche le pays — un libellé
  qu'elle situe est en France. Conséquence : **une offre française dont le
  libellé ne se géocode pas est perdue**, et sur PSA cela représente une part
  des 77 offres écartées sur 243.
- **`estFrancais` est inutilisable sur cette source.** Sans code pays ni région
  dans le libellé, elle rejette « SOCHAUX », « Poissy », « Marcoule » et
  « Vélizy-Villacoublay », qui sont bien françaises. L'avoir retenue aurait vidé
  la moisson en silence — le même mode de panne que le tri alphabétique du 04/08
  et la clé de tri manquante du 06/08.
- **Le lieu ne se lit PAS dans la dernière `<category>`.** PSA, BRGM et Dassault
  y mettent la ville, mais Orange et Kronospan y mettent le type de contrat : la
  règle positionnelle inventait des villes nommées « CDI », « Stage » et
  « Unbefristet ». Le lieu est lu dans les étiquettes de la description, elles
  aussi renommées par chaque entreprise (« Ville », « Lieu de travail »).
- **Certains locataires ne publient aucun lieu** (Orange, Kronospan). Leurs
  offres n'entrent pas dans l'index, conformément à la règle générale.
- **Le nom de l'employeur est déduit de l'hôte** (`nomTalentsoft`), comme chez
  Workday : les sigles ressortent capitalisés (« Brgm » et non « BRGM »).
  Lisible, jamais trompeur, non raffiné davantage.

### 2.2 bis Ce que Workday coûte et ne dit pas

- **Aucun pays dans la liste d'offres.** Seul un libellé libre, souvent une commune inconnue de toute liste (« Vitry-sur-Seine », « Le Trait »). `estFrancais` est donc inutilisable ici : c'est le pays déclaré par Workday qui tranche, lu soit dans la facette du board, soit dans le détail de chaque offre.
- **La facette pays est ignorée, pas refusée, quand le board ne l'a pas configurée.** GEA rend ses 356 offres à l'identique avec et sans le filtre France. Croire ce total produisait **26 484 fausses offres** sur un échantillon de 125 boards (mesuré le 05/08/2026). D'où la vérification préalable de l'existence de la facette, verrouillée par test.
- **Coût par offre pour les boards sans facette pays** : un appel de détail par offre candidate, six de front. C'est le poste le plus lourd de toute la chaîne.
- **Le nom de l'entreprise n'est pas donné.** Il est déduit de l'adresse (`nomWorkday`) : sans cela le candidat lisait « Ag » pour Airbus, « Cc » pour Chanel. 101 noms redressés sur 291, mais **34 restent des sigles non capitalisés** (Abb, Cae, CSL) et quelques-uns gardent un nom de site (« Zollmedicalcorp »). Lisible, jamais trompeur — non raffiné davantage pour ne pas casser les 327 cas justes.
- **Une entrée sur vingt n'est pas une offre** : Workday renvoie des objets ne portant que des métadonnées internes, sans titre ni chemin (relevé chez Accenture). Écartés.

### 2.3 Rendement de la découverte par nom d'entreprise

Le passage du nom légal SIRENE au slug du board ne marche que dans une minorité
des cas : **~0,33 %** des entreprises de 200 salariés et plus, **0,113 %** des
PME (55 boards pour 48 576 entreprises, mesuré le 05/08/2026). Le rendement
baisse donc à mesure qu'on descend en taille — ce qui pèsera sur la décision de
passer un jour sous 50 salariés. Des employeurs connus (Nexton, Thales) restent hors index parce que leur
nom légal ne ressemble pas au slug de leur board. Aucune solution générale — il
faudrait une correspondance nom → domaine → slug, qui n'existe pas.

### 2.4 Champs que les boards ne donnent pas

Pour les offres du marché caché (`boardsFr.ts`) :

- **Type de contrat et salaire toujours vides.** Aucun des cinq ATS n'expose de distinction CDI/CDD fiable. Conséquence directe : les filtres **« Contrat », « Qualification » et « Temps de travail » ne s'appliquent pas** à cette source. Une offre du marché caché remonte quel que soit le réglage de ces pastilles.
- ~~**Le rayon géographique n'est vrai que pour une partie des offres**~~ — **levé le 06/08/2026.** SmartRecruiters restait le seul ATS à fournir des coordonnées, soit 31 % de l'index ; pour les 69 % autres, « à 30 km de Lyon » se réduisait à « le libellé contient le mot Lyon », et Villeurbanne n'en fait pas partie. Coût mesuré avant correction : **884 offres de banlieue invisibles** sur cinq agglomérations, dont 580 en Île-de-France et 82 à Villeurbanne. `scripts/boards/geo.mjs` géocode désormais les libellés à la construction de l'index (Base Adresse Nationale) : **92 % des offres sont situées**, et une recherche à 30 km gagne 2 357 offres à Paris, 462 à Lyon, 168 à Lille. Ce qui reste : les 8 % non situés (« France » seul, « Remote », lieux-dits comme Sophia Antipolis) retombent sur la comparaison de libellés, et **une offre sur 19 555 reste mal placée** (« Saint Paul, Saint Pault Lès Durance », libellé fautif sans région).
- ~~**Le filtre région / département ignorait les coordonnées et les libellés sans nom explicite de région**~~ — **levé le 07/08/2026** (commit `34225da`). Une recherche francilienne écartait 91 offres parisiennes écrivant « Paris » sans la mention « Île-de-France ». Les départements sont désormais extraits du géocodage BAN (`dept`) et rattachés aux régions par leurs codes INSEE (`departements.ts`).
- **Limite des libellés multi-sites** : un libellé énumérant plusieurs villes (« Dublin, Ireland / Paris, France ») est géocodé sur une seule commune (Paris) et reçoit `dept: "75"`. L'offre passe alors un filtre région Île-de-France même si le poste principal est à l'étranger.
- **Une offre sans lieu exploitable n'entre pas dans l'index** (`build-boards-offres.mjs`, décision du 06/08/2026). Sans ville, elle serait absente des recherches par rayon tout en s'affichant ailleurs — incohérence invisible pour le candidat. Le filtre vit à l'écriture du fichier et pas seulement chez chaque ATS, parce que les offres reprises d'un board injoignable viennent du fichier précédent, donc d'un code plus ancien. 56 offres écartées au dernier passage, toutes de `lever:ippon`.
- **Plafond de 60 offres par recherche** dont on récupère le texte complet. Nombre choisi, jamais mesuré sur un usage réel. Depuis le 06/08/2026, ces 60 places sont mieux dépensées : les annonces que le dédoublonnage fusionnera de toute façon sont écartées **avant** le plafond (Colisée publiait quinze fois le même poste, qui prenaient quinze places pour une seule ligne affichée), et la sélection sert la meilleure offre de chaque employeur avant la deuxième de quiconque. « infirmier » rendait 34 offres Air Liquide sur 60 et 45 lignes affichées ; il en rend 60, chez 13 employeurs.

### 2.4 ter La correspondance des intitulés est désormais conjonctive

`matchTitre` et `synonymes.ts` : depuis le 18/08/2026 (chantier *Mots-clés conjonctifs*,
plan `docs/superpowers/plans/2026-08-18-mots-cles-conjonctifs.md`), la correspondance
est **strictement conjonctive** :
- Tout mot-clé composé ou synonyme élargi exige la présence de **tous ses termes**
  (ex. « chef de projet marketing » devient « project manager » + « marketing », éliminant
  les faux positifs « Chef de projet Achats » qui polluaient à 100 % les résultats).
- La sélection et le classement consomment désormais la même structure `Critere`
  (module `synonymes.ts` unique).
- Le classement utilise le maximum (au lieu de la moyenne) pour ne pas pénaliser
  la recherche multi-métiers, et calcule une **enveloppe honnête** (`max: 0` sur les
  champs non fournis par la source : distance, contrat, salaire, expérience).

**Ce que ça ne fait toujours pas** : la table de 43 familles est écrite à la main et
ne couvre que les métiers les plus fréquents de l'index. Un métier absent de la table
n'est trouvé que par son intitulé exact. Il n'y a ni analyse morphologique
(« ingénieure » au féminin, pluriels irréguliers), ni recherche dans le texte de
l'annonce — un poste intitulé « Consultant » qui décrit exactement le métier du
candidat reste invisible.


### 2.4 bis 92 % des offres Workday n'ont pas de date de publication

7 871 des 8 538. Le champ `startDate` n'est renseigné que par une minorité de
boards. Conséquences : **l'âge affiché sur la carte est vide** pour ces offres,
et le classement retombe sur `decouverteLe` — la date du premier scan qui les a
vues, donc au mieux la date d'entrée dans l'index, jamais la vraie parution.
Une offre publiée il y a six mois mais découverte hier passe pour récente.

⚠️ Ce trou a failli coûter cher : trier sur `publieLe` seul renvoyait ces
7 871 offres après le plafond de 60 candidates. Mesuré le 06/08/2026,
« ingénieur » retenait **0 offre Workday sur 1 770 candidates** — Thales, Airbus
et Safran invisibles. Corrigé par `dateEffective` (`boardsFr.ts`), verrouillé par
test. C'est la deuxième fois qu'une clé de tri manquante élimine silencieusement
une source entière, après le tri alphabétique du 04/08.

### 2.5 La date de publication n'est pas fiable chez Greenhouse

Le champ exposé est `updated_at` : une correction de faute de frappe rajeunit
une annonce de trois mois. Contourné pour le filtre d'ancienneté (on retient la
plus ancienne de `publieLe` et `decouverteLe`), **mais l'âge affiché sur la
carte reste celui annoncé par l'ATS**. Concerne 1 578 offres de l'index.

### 2.6 Licence des listes publiques — l'attribution était due dès la publication

Les listes de slugs de la source A (`scripts/boards/sources.mjs`) viennent de
`Feashliaa/job-board-aggregator`. Son **code** est MIT, mais son répertoire
`data/` — celui que nous lisons — est sous **CC BY-NC 4.0 : attribution
obligatoire, usage non commercial** (vérifié dans son README le 06/08/2026).
Portée mesurée le même jour : **399 des 864 boards** de l'index, soit **3 895
des 19 555 offres**.

⚠️ Cette page a longtemps dit que le problème arriverait « le jour où CVMatchr
devient payant ». **C'était faux sur deux points**, relevés le 06/08/2026 :

- le « BY » exige une attribution, qui n'existait nulle part ;
- le dépôt est **public et sous MIT** (vérifié : `github.com/hariss24/cvmatchr`,
  `"visibility": "public"`). Publier un dérivé sous MIT accorde à quiconque
  l'usage commercial et la sous-licence — exactement ce que le « NC » refuse.
  Le déclencheur n'était donc pas la monétisation, mais la publication, déjà
  faite.

Corrigé le 06/08/2026 : le fichier `NOTICE` porte l'attribution et exclut les
données du périmètre MIT, et `LICENSE` y renvoie.

**Reste à faire** : régénérer ces slugs depuis Common Crawl, comme c'est déjà
le cas pour Workday (`scripts/boards/crawl.mjs`). Tout est isolé dans
`slugsDesListes` pour que le remplacement ne touche rien d'autre. Tant que ce
n'est pas fait, la part dérivée de ces listes ne peut pas être exploitée
commercialement sans accord de l'auteur, qui invite à le contacter.

### 2.7 Google for Jobs n'est pas un avantage caché

Les sites carrière exposent leur balisage `JobPosting` **pour** Google for Jobs.
Ces offres sont donc déjà chez Google, et l'app a déjà cette source (`jsearch`,
désactivée par défaut, plafonnée à 200 appels/mois). L'avantage de la moisson
directe est l'exhaustivité, l'absence de quota et la fraîcheur — **pas**
l'invisibilité. À ne pas se raconter autrement.

---

## 3. Poids des données dans le dépôt

Quatre fichiers de données sont commités et régénérés automatiquement
(tailles relevées le 06/08/2026) :

| Fichier | Taille | Rythme de réécriture |
|---|---|---|
| `boards-fr-testes.json` | **20,6 Mo** | hebdomadaire |
| `boards-offres.json` | **8,4 Mo** | **quotidien** |
| `boards-geo.json` | 355 Ko | quotidien, mais quasi figé |
| `boards-fr.json` | 126 Ko | hebdomadaire |

Git compresse bien des fichiers presque identiques, mais la trajectoire est à
surveiller : le mémo a doublé en ouvrant l'index aux PME, et l'index d'offres a
presque doublé avec Workday (4,2 → 8,4 Mo), **réécrit chaque jour**. Descendre
encore le seuil SIRENE, ou ajouter SuccessFactors, aggraverait les deux.

Deux mesures rassurantes du 06/08/2026, à ne pas confondre avec la trajectoire
ci-dessus : le dépôt entier pèse **4,2 Mo** compressés (`git count-objects -vH`),
et les 8,4 Mo d'offres **ne partent jamais dans le navigateur** — la recherche
s'exécute sur le serveur (`export const runtime = "nodejs"`), aucun fichier
client ne contient l'index. Côté serveur, le charger coûte 20 ms et 30 Mo de
mémoire : rien d'alarmant avant plusieurs centaines de milliers d'offres.
**Si l'historique gonfle trop, la bonne réponse est de sortir ces fichiers du
dépôt** (artefact de build ou stockage externe), pas d'espacer les scans — qui
sont justement toute la valeur.

---

## 4. Qualité et exactitude

### 4.1 Notation des offres

`docs/archive/superpowers/specs/2026-07-28-notation-lettres-design.md` §9 :

- **Les pondérations sont des hypothèses**, pas des valeurs mesurées. L'affichage du détail par critère existe précisément pour permettre de les corriger à l'usage — ce qui n'a pas encore été fait.
- **Les offres non-France-Travail sont notées sur le seul texte** (~52 % du volume) : pas de code métier, donc pas de filtre anti-bruit.
- **Aucun jugement sur le fond.** Un algorithme ne dira jamais « ces missions ressemblent à du commercial déguisé en marketing ».
- **Aucune taxonomie ne couvre tous les intitulés de poste** — assumé, c'est la raison du poids majoritaire donné à la description.

### 4.2 Score LinkedIn

Les seuils (80 caractères de titre, 400 de corps…) sont des **heuristiques
d'ingénierie**, pas des chiffres mesurés chez un concurrent — leurs méthodes
sont fermées. Un profil collé partiellement sous-score sans que ce soit un
défaut réel.

### 4.3 Logos d'entreprise

**Un nom d'entreprise n'identifie pas une entreprise.** « Nexton » désigne aussi
un vendeur pakistanais, un éditeur japonais et un lotissement américain — tous
réellement nommés ainsi. Annuaires comme domaines devinés y tombent. Le taux
d'erreur résiduel est structurel.

### 4.4 Extension d'autofill

- Les sélecteurs Lever ne reposent sur **aucune source publique confirmée**.
- Un ATS change son DOM sans préavis : un futur échec de reconnaissance ne sera pas nécessairement une régression.
- **Greenhouse et Lever seulement.** Workday a un DOM jugé trop lourd, hors périmètre.
- Le paquet transite en clair dans `chrome.storage.local` (nom, email, téléphone, CV). Cohérent avec le modèle 100 % local, mais à revoir le jour du multi-utilisateur.

---

## 5. Limites d'interface acceptées

- **Aperçu des sauts de page** — différé : trop complexe à simuler avec précision dans React PDF avant le rendu final.
- **Annuler/Rétablir inopérant pendant la frappe** dans un champ (`if (isInputOrTextarea) return;` laisse l'undo natif du navigateur). Volontaire, couvert par les tests.
- **Affichage avant/après de l'adaptation IA** jugé mauvais par l'utilisateur (`TODO.md`) : refonte pleine largeur en desktop, slider en mobile — non faite.
- **Pas d'ancres de navigation dans le formulaire** : sur un CV long, il faut faire défiler. À brainstormer (`TODO.md`).

---

## 6. Limites de l'IA

- **Anthropic ne supporte pas les images** : avec une clé `sk-ant-…`, l'import de CV en PDF ne fonctionne pas. Seul Gemini le permet.
- **L'IA invente parfois un titre de poste** au lieu de reprendre celui de l'offre (« Content & UX Manager » au lieu de « Product Information Manager »). Ouvert dans `TODO.md`.
- **La photo de profil n'est jamais envoyée à une IA** — contrainte volontaire, jamais à lever.

---

## 7. Ce qui n'a jamais été éprouvé

- **Validation de bout en bout sur un vrai CV importé** : le chantier « zéro perte » est terminé côté code mais n'a pas été éprouvé sur un CV réel aux rubriques inhabituelles, dans les quatre modèles. Ouvert depuis le 17/07/2026.
- **L'app n'a jamais été utilisée par quelqu'un d'autre que son auteur.** Toutes les hypothèses d'ergonomie sont non vérifiées.

---

## 8. Dette de fonctionnement

- **Le push est manuel.** Aucun agent ne pousse sur `main` — un push déploie la production Vercel. Volontaire, mais cela veut dire que rien n'est en ligne tant qu'un humain n'a pas poussé.
- **Trois sections SIRENE (22/C, 22/G, 22/H) ont été interrompues** au dernier passage, soit ~860 PME non énumérées. Elles rentreront au passage suivant — mais rien ne surveille ce genre d'incident : il n'est visible que dans les journaux du workflow.
- ~~**Aucune alerte en cas d'échec des workflows.**~~ **Levé le 06/08/2026** : `.github/workflows/alerte.yml` ouvre une issue étiquetée `alerte-workflow` dès qu'un des quatre rendez-vous se termine en échec, en dépassement de temps ou annulé. Une seule issue par workflow, les récidives en commentaire. Le premier angle mort — *un workflow qui réussit en produisant un mauvais résultat* — a été refermé le même jour : au-delà de **10 % de boards injoignables**, `build-boards-offres.mjs` sort en code 1 après avoir écrit ce qu'il a pu ramener (l'étape de commit passe en `if: always()`), le job devient rouge et l'alerte part. Vérifié dans les deux sens : 4 boards injoignables sur 4 rendent 1, un sur douze rend 0.

⚠️ Ce garde-fou n'est pas cosmétique. Simulé le 06/08/2026 : les cinq API tombant le même matin, `reprendreIndetermines` republiait les 19 555 offres du dernier passage réussi, le fichier produit était **identique à l'octet**, `git diff` ne voyait rien et le job restait vert. L'index serait resté gelé indéfiniment sans que personne le sache. Contrepartie ajoutée : une offre qu'aucun passage n'a revue depuis **14 jours** sort de l'index au lieu d'être republiée à vie (`sansPerimees`, champ `vuLe`).

**Deux angles morts demeurent** :

1. Un cron qui ne se déclenche pas du tout ne produit aucun événement, donc aucune alerte.
2. **Une alerte que personne ne lit ne vaut pas mieux qu'une absence d'alerte.** Constaté le 22/08/2026 : la CI « Web Next.js CI » avait échoué à **chaque push depuis le 14/08**, soit huit jours et dix-neuf exécutions, avec toujours les mêmes 9 tests E2E. Le dispositif avait pourtant fonctionné — l'issue #45 était bien ouverte. Cause de la panne : la fixture de session E2E était soudée à un identifiant de projet Supabase en dur (voir `WORK_HISTORY.md`, 22/08/2026). Les tests passaient en local parce que la valeur en dur y coïncidait, et échouaient en CI où l'adresse est factice. **Rien ne rend une issue `alerte-workflow` ouverte visible ailleurs que dans l'onglet Issues.**

### 8.1 bis Ce que les tests ne verrouillent pas

Les 139 tests de `scripts/` injectent tous un `fetch` factice — aucun ne touche
le réseau réel. Si Workday renomme un champ, si la Base Adresse Nationale change
de format ou si Common Crawl modifie la structure de `cluster.idx`, **la CI reste
verte** ; la moisson rend « indéterminé » partout, et c'est le seuil des 10 %
ci-dessus qui prévient, pas les tests. Un test de bout en bout quotidien — un
board par ATS doit rendre au moins une offre avec titre, URL et lieu — reste à
écrire.

### 8.2 SmartRecruiters interdit explicitement l'accès automatisé

Vérifié le 06/08/2026 :

```
User-agent: LinkedInBot
Allow: /v1/companies/
User-agent: *
Disallow: /
```

Tout robot autre que celui de LinkedIn est interdit sur `api.smartrecruiters.com`.
C'est **36 % de l'index** (7 044 offres) et jusqu'à 34 requêtes à chaque recherche
d'un candidat, depuis une IP unique et sans cache. Ni le code ni la moisson ne
lisent ce fichier.

Ce n'est pas un défaut à corriger en codant : c'est une décision à prendre —
demander un accès partenaire (l'API existe et s'authentifie), basculer sur un
hôte qui l'autorise, ou retirer la source. Elle se posera le jour où l'app aura
des utilisateurs.

`data.commoncrawl.org` porte lui aussi « Disallow: / » alors que ses conditions
d'utilisation autorisent l'exploitation des données — contradiction non tranchée,
et c'est la seule source d'adresses des 361 boards Workday (44 % des offres).
Greenhouse et Ashby sont conformes ; Lever autorise explicitement mais demande
une seconde entre deux requêtes, que la moisson ne respecte pas encore
(80 boards, 12 de front).

À côté de ça, deux points sains vérifiés le même jour : les scripts ne se font
**pas** passer pour un navigateur (l'en-tête émis est le `user-agent: node` par
défaut), et l'index committé ne contient **aucune donnée personnelle**.

### 8.3 Talentsoft est sondé sans lire son `robots.txt` — décision assumée du 21/08/2026

La moisson Talentsoft (`scripts/boards/talentsoft.mjs`) frappe le flux RSS de
chaque hôte candidat **sans vérifier au préalable son `robots.txt`**. C'est un
choix explicite de l'auteur, pas un oubli : le contrôle coûterait une requête
supplémentaire par candidat sur un gisement d'environ 60 000 hôtes.

⚠️ Ce choix a un coût juridique connu, et il est chiffré. La **CNIL** exige
d'exclure de la collecte les sites qui s'opposent au moissonnage via `robots.txt`
ou CAPTCHA — c'est une condition explicite pour pouvoir invoquer l'intérêt
légitime comme base légale RGPD (fiche « Intérêt légitime : collecte par
moissonnage »). Par ailleurs, l'arrêt **CJUE C-30/14** (*Ryanair c. PR Aviation*,
15/01/2015) établit que même sur une base de données protégée ni par le droit
d'auteur ni par le droit *sui generis*, **les CGU du site restent pleinement
opposables** — donc celles de Cegid Talentsoft et de chaque entreprise hôte.

**Ce qu'il faudrait faire pour lever la limite** : lire `https://<hôte>/robots.txt`
avant le sondage et écarter les hôtes qui refusent, en mémorisant le refus dans
`memo.mjs` pour ne pas le redemander chaque semaine. Le point d'insertion est
unique — l'entrée de `listerTalentsoftFR` — précisément pour que ce revirement
reste bon marché.

Cette limite rejoint celle de SmartRecruiters (§8.2) : le projet moissonne
aujourd'hui **trois** sources dont le `robots.txt` n'est jamais consulté
(`api.smartrecruiters.com`, `data.commoncrawl.org`, et désormais les hôtes
Talentsoft). Le jour où l'app aura des utilisateurs, c'est une décision d'ensemble
à prendre, pas trois correctifs séparés.
