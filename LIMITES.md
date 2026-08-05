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

**Dernière mise à jour : 5 août 2026.**

---

## 1. Le verrou principal : tout vit dans le navigateur

`PROJECT_INDEX.md` §1 : CVMatchr est **mono-utilisateur**. Toutes les données —
CV, lettres, historique, profil, offres, candidatures, compteurs — sont dans
IndexedDB via Dexie (`src/lib/storage/db.ts`). Il n'y a **aucune base serveur**.

L'authentification existante (`src/middleware.ts`, §9) n'est pas un système de
comptes : c'est **un seul mot de passe partagé** pour fermer l'accès à
l'instance. Sans variable d'environnement, l'app est ouverte.

C'est ce choix qui bloque tout ce qui suit. Il était délibéré — décision
post-audit du 17/07/2026, l'auth était différée jusqu'au multi-utilisateur —
mais son coût s'accumule.

### 1.1 Conséquences subies aujourd'hui

| Limite | Ce qui se passe concrètement |
|---|---|
| **Perte totale des données** | Vider le cache du navigateur efface tous les CV, lettres et candidatures. Aucune sauvegarde, aucune corbeille, aucune restauration. |
| **Aucune synchronisation** | Un CV commencé sur l'ordinateur n'existe pas sur le téléphone. Deux navigateurs = deux applications sans lien. |
| **Compteur de quota contournable** | Le compteur d'appels API (table Dexie `apiUsage`) est **local et indicatif** (`PROJECT_INDEX.md` §8). Vider le cache le remet à zéro. Faille identifiée dans `TODO.md`, non corrigeable sans compteur serveur. |
| **Clé API en clair côté navigateur** | La clé IA de l'utilisateur est en `localStorage` (`src/lib/settings.ts`), envoyée en en-tête `X-Api-Key`. Acceptable pour un usage personnel, intenable dès qu'un tiers utilise l'instance. |
| **Aucune trace d'usage** | Impossible de savoir ce qui sert, ce qui échoue, ce qui fait abandonner. Toutes les décisions produit se prennent à l'aveugle ou sur mesure manuelle. |

### 1.2 Fonctionnalités en attente de cette brique

Aucune de celles-ci n'est difficile en soi ; toutes attendent le même socle.

- **Comptes et connexion** (email, mot de passe ou lien magique, réinitialisation).
- **Sauvegarde et synchronisation multi-appareils** des CV et candidatures.
- **Quotas réels et facturation** — donc *toute* offre payante. Le compteur local ne peut pas servir de base à un paiement.
- **Clés API côté serveur uniquement**, pour ne plus exposer celle de l'utilisateur.
- **Partage d'un CV par lien** (envoyer un lien plutôt qu'un fichier).
- **Historique et statistiques de candidatures dans la durée** — taux de réponse par entreprise, par secteur, par modèle de CV. Les données existent déjà localement mais meurent avec le navigateur.
- **Alertes par email** sur les offres du marché caché (« 3 nouvelles offres correspondant à ton profil ce matin »). Le scan quotidien produit déjà la donnée, il n'y a personne à qui l'envoyer.
- **Reprise d'une session sur un autre appareil** (commencer sur mobile, finir sur ordinateur).

**Ce qu'il faudrait décider avant de commencer :** l'hébergeur de base (Vercel
Postgres, Supabase, Neon…), le modèle d'authentification, et surtout la
migration des données déjà présentes dans IndexedDB chez l'utilisateur actuel.

---

## 2. Sources d'offres — ce qui reste hors de portée

### 2.1 LinkedIn et Indeed

Inscrit dans `TODO.md` en priorité haute et toujours ouvert : **les deux
bloquent les robots**. Aucune solution retenue à ce jour. C'est une des raisons
d'être du marché caché — contourner le problème plutôt que l'affronter.

### 2.2 ATS hors de portée

`docs/superpowers/specs/2026-08-04-marche-cache-index-design.md`, « Hors scope » :

- ~~**ATS exigeant l'URL du locataire** : Workday, SuccessFactors, Talentsoft.~~ **Levé pour Workday le 06/08/2026** (commit de la brique 3) : les adresses ne se devinent toujours pas, elles se **lisent** dans l'index public de Common Crawl (`scripts/boards/crawl.mjs`). 2 467 vitrines énumérées, **361 boards français, 8 538 offres**. La contrainte reste entière pour **SuccessFactors et Talentsoft**, dont l'API n'a pas été mesurée — les traiter d'un bloc aurait empilé trois inconnues au lieu d'en lever une.
- **ATS à authentification** : Taleez, Flatchr, Digitalrecruiters, Welcome to the Jungle. Aucune piste.

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
- **Le rayon géographique n'est vrai que pour une partie des offres** — SmartRecruiters est le seul ATS à fournir des coordonnées (53 % de l'index avant Workday, 36 % après). Pour les autres, c'est une correspondance de ville stricte : une offre à Boulogne sort d'une recherche « Paris ».
- **Une offre sans lieu exploitable n'entre pas dans l'index** (`build-boards-offres.mjs`, décision du 06/08/2026). Sans ville, elle serait absente des recherches par rayon tout en s'affichant ailleurs — incohérence invisible pour le candidat. Le filtre vit à l'écriture du fichier et pas seulement chez chaque ATS, parce que les offres reprises d'un board injoignable viennent du fichier précédent, donc d'un code plus ancien. 56 offres écartées au dernier passage, toutes de `lever:ippon`.
- **Plafond de 60 offres par recherche** dont on récupère le texte complet. Nombre choisi, jamais mesuré sur un usage réel.

### 2.5 La date de publication n'est pas fiable chez Greenhouse

Le champ exposé est `updated_at` : une correction de faute de frappe rajeunit
une annonce de trois mois. Contourné pour le filtre d'ancienneté (on retient la
plus ancienne de `publieLe` et `decouverteLe`), **mais l'âge affiché sur la
carte reste celui annoncé par l'ATS**. Concerne 1 578 offres de l'index.

### 2.6 Licence des listes publiques — bloquant pour une exploitation commerciale

Les listes de slugs de la source A (`scripts/boards/sources.mjs`) sont sous
**CC BY-NC 4.0 : usage non commercial**. Elles fournissent 399 des 503 boards
de l'index. **Le jour où CVMatchr devient payant, cette source doit être
remplacée** par une régénération maison depuis Common Crawl. Tout est isolé
dans `slugsDesListes` pour que le remplacement ne touche rien d'autre, mais le
travail reste à faire.

### 2.7 Google for Jobs n'est pas un avantage caché

Les sites carrière exposent leur balisage `JobPosting` **pour** Google for Jobs.
Ces offres sont donc déjà chez Google, et l'app a déjà cette source (`jsearch`,
désactivée par défaut, plafonnée à 200 appels/mois). L'avantage de la moisson
directe est l'exhaustivité, l'absence de quota et la fraîcheur — **pas**
l'invisibilité. À ne pas se raconter autrement.

---

## 3. Poids des données dans le dépôt

Trois fichiers de données sont commités et régénérés automatiquement :

| Fichier | Taille | Rythme de réécriture |
|---|---|---|
| `boards-fr-testes.json` | **20,6 Mo** | hebdomadaire |
| `boards-offres.json` | **7,9 Mo** | **quotidien** |
| `boards-fr.json` | 105 Ko | hebdomadaire |

Git compresse bien des fichiers presque identiques, mais la trajectoire est à
surveiller : le mémo a doublé en ouvrant l'index aux PME, et l'index d'offres a
presque doublé avec Workday (4,2 → 7,9 Mo), **réécrit chaque jour**. Descendre
encore le seuil SIRENE, ou ajouter SuccessFactors, aggraverait les deux.
**Si l'historique gonfle trop, la bonne réponse est de sortir ces fichiers du
dépôt** (artefact de build ou stockage externe), pas d'espacer les scans — qui
sont justement toute la valeur.

---

## 4. Qualité et exactitude

### 4.1 Notation des offres

`docs/superpowers/specs/2026-07-28-notation-lettres-design.md` §9 :

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
- **Aucune alerte en cas d'échec des workflows.** Si le scan quotidien casse, l'index vieillit en silence.
