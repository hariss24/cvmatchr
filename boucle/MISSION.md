# MISSION — le référentiel de la boucle

Ce fichier est la boussole. Les deux rôles le lisent à chaque réveil.
**La boucle ne le modifie jamais.** Elle peut proposer de le changer : une ligne dans
`IDEES.md`, adressée au propriétaire.

## Ce que fait la boucle, et ce qu'elle ne fait plus

Depuis le 02/08/2026, sur décision du propriétaire : **la boucle explore et classe, elle
n'implémente rien.** Elle observe le produit, le marché et le dépôt, elle en tire des
idées, elle les note et les ordonne dans `IDEES.md`. Le propriétaire lit ce classement et
décide seul de ce qui se construit — et le construit.

Cette limite n'est pas une consigne de politesse : `bin/verifier-perimetre.mjs` refuse
tout diff qui sort de `boucle/` et `docs/`. Un réveil qui touche à `web/` ou
`extension/` est perdu en entier, quelle que soit la qualité de ce qu'il a écrit.

Ce qui a été construit avant cette date reste en place. On arrête de bâtir, on ne défait
rien.

## Objectif

N'importe quel candidat, sans explication préalable, doit pouvoir produire un CV et une
lettre adaptés à une offre précise — et ne jamais avoir envie de retourner à Word.

## Seuils vérifiables

| Domaine | Seuil |
|---|---|
| Affichage des offres | premier résultat visible < 2 s |
| Chargement de l'éditeur | interactif < 2,5 s |
| Accessibilité | parcours principaux navigables au clavier seul, contrastes AA |
| Fiabilité | CI verte ; aucun `any` ni `eslint-disable` ajouté |
| Mobile | tout parcours principal utilisable sur 375 px de large |
| Nouvel arrivant | de l'arrivée au premier PDF sans consulter l'aide |
| **Couverture fonctionnelle** | **aucune capacité présente chez ≥ 2 des produits de référence et absente ici** |
| **Coût des appels externes** | aucun appel facturé répété pour une même donnée dans un même parcours |
| **Hygiène du dépôt** | aucun fichier ni export de `web/src/` sans appelant démontré |

Produits de référence : Jobscan, Teal, Rezi, Huntr, Kickresume, Enhancv, Careerflow,
Simplify. Une capacité qu'au moins deux d'entre eux offrent et que CVMatchr n'offre pas
est un **manque**, au même titre qu'un temps de chargement au-dessus du seuil.

Un chiffre au-dessus du seuil justifie un chantier. Un chiffre en dessous le clôt.

**Un manque fonctionnel prime sur un dépassement technique**, sauf si le dépassement
excède le seuil d'un facteur 2 ou casse la production. Cette règle existe parce qu'un
seuil technique se mesure facilement et qu'un manque fonctionnel ne se mesure pas : sans
elle, la boucle optimise indéfiniment ce qu'elle sait chiffrer et n'ajoute jamais rien.

## Ordre des priorités

1. **Finition professionnelle** — l'application donne l'impression d'un produit fini.
2. **Fonctionnalités** — combler les manques face aux produits concurrents.
3. **Multi-utilisateur** — comptes, données qui suivent d'un appareil à l'autre.

Cet ordre est fixé par le propriétaire. Il ne se redébat pas à chaque réveil.

## Règle de tranchage

À chaque arbitrage, retenir l'option **la plus complète et la plus qualitative**, pas la
moins coûteuse. Puis écrire ce qui a été écarté et pourquoi.

## Sujets sensibles

- comptes et authentification ;
- migration des données hors d'IndexedDB ;
- ajout d'une dépendance npm importante ;
- tout ce qui touche à un paiement ou au modèle économique.

Ils peuvent être proposés et classés comme n'importe quelle idée. Le mécanisme du feu
vert a disparu avec les rôles qui construisaient : plus rien ne s'implémente sans le
propriétaire, donc plus rien n'a besoin d'être bloqué. Signale simplement dans le
classement qu'une idée touche à l'un de ces sujets — il décidera en connaissance de
cause.

## Interdits absolus

La boucle n'écrit que dans `boucle/` et `docs/` — et jamais, à l'intérieur même de
`boucle/`, dans `MISSION.md`, `roles/` ni `bin/`. Ces trois-là sont sa mission, ses
mandats et son moteur : un agent qui peut les réécrire n'a plus de limites, seulement
des limites qu'il consent à garder. Elle ne pousse jamais sur `main`.

Si tu penses qu'un de ces fichiers doit changer, écris-le dans `IDEES.md`, à l'adresse
du propriétaire. Ne le modifie pas toi-même : un script (`bin/verifier-perimetre.mjs`)
refusera ton diff et le réveil sera perdu.

## Règles héritées du dépôt

- `CLAUDE.md` (racine) et `web/AGENTS.md` s'appliquent intégralement.
- La photo de profil (base64) n'est jamais envoyée à une IA.

Les règles de style et de code (`uiAlert` plutôt qu'`alert`, variables de thème plutôt
que couleurs en dur, `web/CADRAGE_EXECUTION.md`) ne concernent plus la boucle : elle
n'écrit plus de code. Elles restent valables pour le propriétaire et pour quiconque
implémente une idée sortie d'ici — cite-les dans une idée quand elles la contraignent.
