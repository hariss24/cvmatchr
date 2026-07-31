# Boucle autonome CVMatchr — conception

**Date :** 2026-07-31
**Statut :** validé par le propriétaire, prêt pour la rédaction du plan
**Objet :** un agent Claude qui, toutes les 6 heures et sans intervention humaine,
audite CVMatchr, surveille le marché, conçoit des plans et les implémente, avec pour
seul but d'amener l'application aux standards de l'industrie.

---

## 1. Le problème

CVMatchr fonctionne, mais son propriétaire n'en est pas satisfait : l'application
n'atteint pas le niveau de finition qui la rendrait utilisable — et désirable — par
n'importe quel candidat. Le progrès dépend aujourd'hui entièrement de sessions
déclenchées à la main, donc de la disponibilité d'une personne.

L'objectif est de rendre ce progrès continu et autonome, **sans** que l'autonomie se
paie en dérive : ni code non vérifié en production, ni agent qui s'emballe, ni travail
dont personne ne peut reconstituer la raison six semaines plus tard.

## 2. Ce qui est conçu ici

Deux choses inséparables :

1. **La mission** — un référentiel écrit qui dit ce que « standard de l'industrie »
   veut dire pour cette application, en critères vérifiables. Sans lui, une boucle
   produit du volume, pas de la qualité.
2. **La machine** — le mécanisme qui exécute cette mission toutes les 6 heures.

## 3. Décisions structurantes

### 3.1 Un réveil = un rôle

Chaque exécution joue **un seul** des quatre rôles, choisi par une règle fixe et non
par le jugement de l'agent :

1. une PR de la boucle est rouge, ou ouverte depuis plus de 24 h → **Gardien** ;
2. le backlog contient un chantier prêt à coder (plan écrit) → **Bâtisseur** ;
3. le backlog contient un constat sans plan → **Architecte** ;
4. sinon → **Éclaireur**.

L'ordre est *réparer > livrer > planifier > explorer*. Explorer arrive en dernier
parce que c'est la tâche la plus agréable et donc celle qui, laissée libre, monopolise
tout : une boucle « créative » accumule les audits brillants et ne livre jamais.

**Alternative écartée — le réveil monolithique** (audit + veille + spec + plan + code
dans la même exécution). Elle échoue exactement là où ça compte : l'agent arrive à
l'implémentation avec un contexte déjà saturé par son propre audit. Le résultat n'est
pas une session trop longue, c'est du code écrit par un agent qui ne se souvient plus
de ce qu'il a constaté.

**Alternative écartée — un orchestrateur lançant une flotte de sous-agents par
réveil.** Plus puissante sur le papier ; en pratique coût multiplié, diagnostic des
échecs difficile, et surtout aucune trace lisible du raisonnement pour le
propriétaire.

### 3.2 La continuité passe par des fichiers, jamais par la mémoire

Chaque réveil démarre une **session neuve et vide**. Aucun token n'est hérité de
l'exécution précédente. L'état commun vit dans des fichiers versionnés du dépôt.

C'est la réponse au risque d'explosion du contexte, et elle est meilleure qu'un
compactage : un résumé perd de l'information, et il en perd sans dire laquelle. Un
fichier relu à froid ne perd rien.

Corollaire imposé à tous les rôles : **ne jamais lire tout le dépôt.** Chaque rôle lit
son mandat, l'état, et uniquement les fichiers de son domaine.

### 3.3 La production reste derrière une porte verte

`main` déploie Vercel à chaque push. La boucle ne pousse donc jamais sur `main` : elle
travaille sur une branche `claude/<chantier>`, ouvre une PR, et la fusion n'a lieu que
si la CI est **explicitement verte** — pas « non rouge ».

Cette nuance n'est pas cosmétique. Une PR ouverte par un robot avec le jeton GitHub
par défaut **ne déclenche aucun workflow** (protection anti-récursion imposée par
GitHub). Une règle naïve « fusionner si rien n'est rouge » enverrait alors du code
jamais testé en production, silencieusement. Deux parades, toutes deux retenues :

- la PR est ouverte avec un jeton personnel dédié (`LOOP_GITHUB_TOKEN`), ce qui
  déclenche `web.yml` normalement ;
- le réveil rejoue `tsc`, lint, Vitest et build dans sa propre exécution **avant**
  d'ouvrir la PR. Un plan qui ne compile pas ne devient jamais une PR.

### 3.4 L'agent ne modifie ni son moteur ni son but

Interdits en écriture : `.github/workflows/`, `MISSION.md`, `.claude/loop/roles/`,
`.env*`, et `main`.

La distinction est volontaire et centrale : la boucle décide librement **comment**
atteindre le but, jamais **quel** but. Un agent autorisé à réécrire sa propre mission
ou sa propre planification n'a plus de limites — seulement des limites qu'il consent à
conserver. Elle peut proposer de changer ces fichiers : une ligne dans le backlog,
adressée au propriétaire.

## 4. Architecture

### 4.1 Arborescence

```
.claude/loop/
  MISSION.md          # le référentiel — lu par TOUS les rôles (lecture seule pour l'agent)
  BACKLOG.md          # file d'attente priorisée, une ligne par chantier
  ETAT.md             # dernier réveil, rôle joué, PR en cours — premier fichier lu
  PAUSE.md            # s'il existe : arrêt immédiat (absent par défaut)
  roles/
    eclaireur.md      # instructions du rôle (lecture seule pour l'agent)
    architecte.md
    batisseur.md
    gardien.md
  constats/           # audits et veille, datés — écrits par l'Éclaireur
  journal/            # une entrée par réveil — traçabilité
.github/workflows/
  boucle.yml          # le moteur (cron 6 h) — la boucle n'y touche jamais
docs/superpowers/
  specs/              # existant — l'Architecte y écrit
  plans/              # existant — l'Architecte y écrit
```

Les specs et plans réutilisent les répertoires existants : le dépôt en compte déjà une
trentaine à ce format. La boucle s'insère dans la convention du projet au lieu d'en
créer une.

### 4.2 Déroulé d'un réveil

1. `PAUSE.md` existe et ne nomme aucun rôle → arrêt immédiat, aucun token dépensé.
2. Lecture de `ETAT.md` et `MISSION.md` (≈ 100 lignes au total).
3. Sélection du rôle par la règle de 3.1. Si `PAUSE.md` existe et nomme des rôles, ceux
   qu'il nomme sont sautés : la règle passe au suivant dans l'ordre de priorité. Si tous
   les rôles éligibles sont gelés → arrêt.
4. Exécution du mandat du rôle, et de lui seul.
5. Écriture de l'entrée de journal, mise à jour de `ETAT.md`, commit.

Durée visée : quelques minutes à trente minutes. Délai maximal du job : 60 minutes.

### 4.3 Les quatre rôles

#### Éclaireur — il observe, il ne touche à rien

Choisit **un** domaine par réveil, en rotation : performance, accessibilité, parcours
d'un nouvel arrivant, cohérence visuelle, sécurité, veille concurrentielle. Un seul —
un audit qui balaie tout ne mesure rien.

Règle qui le gouverne : **aucun constat sans chiffre ni reproduction.** « L'interface
pourrait être plus moderne » est refusé ; « sur `/jobs`, le premier résultat s'affiche
en 11,8 s, mesuré trois fois, commande ci-jointe » est accepté. C'est ce qui empêche la
boucle de se raconter des histoires.

Pour la veille, il consulte réellement les produits concurrents (Jobscan, Teal, Rezi,
Huntr…) et cite ses sources.

Sortie : un fichier daté dans `constats/`, et des lignes ajoutées au backlog. **Aucun
code.**

#### Architecte — il transforme un constat en plan exécutable

Prend le chantier le mieux classé, invoque `superpowers:brainstorming` puis
`superpowers:writing-plans`. Sortie : une spec dans `docs/superpowers/specs/`, un plan
tâche par tâche dans `docs/superpowers/plans/`.

**Adaptation assumée de `brainstorming` :** ce skill exige l'approbation d'un humain
avant toute implémentation, et il n'y a pas d'humain à 4 h du matin. La porte est
*déplacée*, pas supprimée : l'Architecte pose ses options, tranche lui-même selon la
règle de priorisation de `MISSION.md`, puis consigne par écrit ce qu'il a écarté et
pourquoi. L'approbation du propriétaire s'exerce en amont (il peut barrer une ligne du
backlog avant qu'elle ne coûte un réveil) et en aval (la PR). Il lit un raisonnement
au lieu de découvrir un fait accompli.

**Aucun code non plus.** La séparation conception/exécution est délibérée : un agent
qui conçoit et code dans le même souffle taille sa conception à la mesure de ce qu'il
a envie de coder.

#### Bâtisseur — il exécute, sous le contrat du dépôt

Applique un plan sous `web/CADRAGE_EXECUTION.md` : une tâche = un lot, TDD rouge puis
vert, preuves obligatoires, aucun refactor voisin, aucun `any`, aucun `eslint-disable`
ajouté, journal dans `WORK_HISTORY.md`. Invoque
`superpowers:test-driven-development` et clôt par
`superpowers:verification-before-completion`.

Deux ajustements au contrat pour ce contexte :

- la règle 10 (« push strictement interdit ») devient **push sur une branche
  `claude/…` uniquement, jamais sur `main`** ;
- si le plan n'est pas terminé à la fin du réveil, il pousse ce qui est vert et laisse
  la PR en brouillon. Le réveil suivant reprend. **Un plan à moitié fait n'est jamais
  fusionné.**

#### Gardien — il passe avant tout le monde

PR rouge, régression, dette. Diagnostique avec `superpowers:systematic-debugging` :
cause racine avant correctif, jamais l'inverse.

Il a le droit de **fermer une PR** que trois réveils n'ont pas réussi à rendre verte,
en consignant ce qui a été tenté. Une boucle qui n'abandonne jamais s'enlise ; savoir
renoncer proprement fait partie du métier.

## 5. `MISSION.md` — la définition du standard

### 5.1 Objectif

> N'importe quel candidat, sans explication préalable, doit pouvoir produire un CV et
> une lettre adaptés à une offre précise — et ne jamais avoir envie de retourner à
> Word.

### 5.2 Seuils vérifiables

| Domaine | Seuil |
|---|---|
| Affichage des offres | premier résultat visible **< 2 s** |
| Chargement de l'éditeur | interactif **< 2,5 s** |
| Accessibilité | parcours principaux navigables au clavier seul, contrastes AA |
| Fiabilité | CI verte ; aucun `any` ni `eslint-disable` ajouté |
| Mobile | tout parcours principal utilisable sur 375 px de large |
| Nouvel arrivant | de l'arrivée au premier PDF sans consulter l'aide |

Ces seuils rendent un constat opposable : un chiffre au-dessus du seuil justifie un
chantier, un chiffre en dessous le clôt.

### 5.3 Ordre des priorités

1. **Finition professionnelle** — l'application donne l'impression d'un produit fini.
2. **Fonctionnalités** — combler les manques face aux produits concurrents.
3. **Multi-utilisateur** — comptes, données qui suivent d'un appareil à l'autre.

Ordre fixé par le propriétaire. Il est appliqué à chaque réveil sans être redébattu.

### 5.4 Règle de tranchage

À chaque arbitrage, la boucle retient l'option **la plus complète et la plus
qualitative**, pas la moins coûteuse. Décision explicite du propriétaire, écrite ici
pour qu'aucun réveil n'ait à la deviner.

### 5.5 Ce qui exige un feu vert humain

Certains chantiers sont trop irréversibles pour un agent sans surveillance :

- comptes et authentification ;
- migration des données hors d'IndexedDB ;
- ajout d'une dépendance importante ;
- tout ce qui touche à un paiement ou au modèle économique.

Pour ceux-là, l'Architecte **peut** écrire la spec — c'est du terrain préparé — mais le
Bâtisseur n'implémente qu'après que le propriétaire ait écrit `!ok` sur la ligne
correspondante du backlog. Ce n'est pas une entorse à l'autonomie : c'est ce qui
garantit qu'une boucle emballée ne réécrive pas le modèle de données un dimanche soir.

## 6. Contrôle par le propriétaire

Trois leviers, tous en Markdown, aucun ne demande de toucher au workflow.

**Mettre en pause** — créer `.claude/loop/PAUSE.md`. Vide, il arrête tout : le réveil
s'interrompt à la première ligne, sans dépenser un token. S'il nomme des rôles
(`Bâtisseur`, `Architecte`…), seuls ceux-là sont gelés et les autres continuent — de
quoi laisser l'Éclaireur auditer pendant qu'on refait l'interface à la main. Le reste
du contenu sert de mot d'explication, relu à la reprise. L'interrupteur natif de
l'onglet Actions de GitHub reste disponible en secours, mais il coupe tout.

**Orienter** — `BACKLOG.md` est un fichier de lignes en langage courant. Le
propriétaire en ajoute une, la préfixe de `!` pour la faire passer devant, ou barre
une ligne proposée par la boucle (qui ne la reproposera pas). Aucune syntaxe à
apprendre : « la barre de filtres devrait se souvenir de mes derniers critères » suffit,
l'Architecte en fera une spec.

**Ajuster les prompts** — `.claude/loop/roles/*.md` contient les instructions de chaque
rôle, en français, en clair. Le workflow ne contient aucune instruction métier : il
choisit un rôle et lui passe son fichier. Changer un comportement n'oblige donc jamais
à ouvrir du YAML.

## 7. Garde-fous

**Secrets.** Deux seulement : `CLAUDE_CODE_OAUTH_TOKEN` (le jeton d'abonnement) et
`LOOP_GITHUB_TOKEN` (jeton restreint au dépôt, pour ouvrir la PR et déclencher la CI).
**Aucune clé applicative** — ni France Travail, ni Adzuna, ni Gemini, ni Google Maps,
ni Brandfetch. Les tests tournent sur des bouchons et, sans clés, l'onglet Offres
affiche son message de configuration. Une clé qu'un agent autonome ne détient pas est
une clé qu'il ne peut pas divulguer dans un log.

**Un seul chantier à la fois.** Jamais plus d'une PR ouverte par la boucle. Quatre
réveils quotidiens ouvrant chacun une branche donneraient vingt-huit PR par semaine en
conflit permanent. Tant que la PR courante n'est ni fusionnée ni fermée, les réveils
suivants la font avancer.

**Droit de renoncer.** Trois interventions du Gardien sur le même échec → PR fermée
avec compte rendu, chantier remis au backlog marqué « échoué ». Sans cette règle, un
seul test rétif consomme indéfiniment les quatre réveils quotidiens.

**Le propriétaire gagne toujours.** La boucle se rebase sur `main`. En cas de conflit,
elle abandonne sa branche et repart de l'état du propriétaire. Jamais de `--force`.
Ses commits portent une identité distincte, lisible dans `git log`.

**Retour en arrière.** Chaque changement est une PR, donc révocable d'un bouton. Vercel
conserve par ailleurs les déploiements précédents.

**Budget.** Quatre réveils par jour, 60 minutes maximum chacun, un groupe de
concurrence qui empêche deux exécutions simultanées. Un réveil interrompu ne laisse
jamais de commit partiel sur une branche fusionnable.

## 8. Prérequis vérifiable avant armement

Toute la fusion automatique repose sur « la CI est verte ». Or `WORK_HISTORY.md`
(28/07) indique : *« Playwright test ignoré (bloqué) »*. Si les tests end-to-end
échouent ou ne s'exécutent pas, la CI n'est jamais verte et la boucle produira des PR
que rien ne fusionnera — en tournant à vide plusieurs jours avant que le propriétaire
ne s'en aperçoive.

**Tâche zéro du plan :** constater l'état réel de `web.yml` sur une PR témoin et
remettre la CI au vert. Ce constat est mesuré, jamais supposé.

## 9. Critères de succès

La boucle est considérée comme réussie quand, sans intervention :

1. un réveil en pause ne consomme rien et le journal l'indique ;
2. un réveil d'Éclaireur produit un constat chiffré et reproductible ;
3. un réveil d'Architecte produit une spec et un plan au format du dépôt ;
4. un réveil de Bâtisseur produit une PR dont la CI passe au vert et qui fusionne
   seule ;
5. une PR délibérément cassée n'est **jamais** fusionnée ;
6. une ligne ajoutée au backlog par le propriétaire est traitée au réveil suivant ;
7. `git log` permet de reconstituer qui a fait quoi et pourquoi.

## 10. Écarté explicitement

- **Compactage du contexte en cours de session** — remplacé par des sessions neuves et
  un état sur fichiers. Un résumé perd de l'information sans dire laquelle.
- **Exécution sur le poste Windows du propriétaire** — ne tourne ni PC éteint ni en
  veille : boucle intermittente, pas autonome.
- **Fusion sans revue ni CI (push direct sur `main`)** — un bug franchit alors le
  filet et part en production sans trace.
- **Fusion manuelle par le propriétaire** — le rend goulot d'étranglement dès la
  première semaine et vide la boucle de son intérêt.
- **Facturation à l'usage par clé API** — coût imprévisible pour 120 réveils par mois ;
  le jeton d'abonnement est retenu.
