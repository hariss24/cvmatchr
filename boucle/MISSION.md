# MISSION — le référentiel de la boucle

Ce fichier est la boussole. Tous les rôles le lisent à chaque réveil.
**La boucle ne le modifie jamais.** Elle peut proposer de le changer : une ligne dans
`BACKLOG.md`, section « Idées », adressée au propriétaire.

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

## Chantiers exigeant un feu vert humain

- comptes et authentification ;
- migration des données hors d'IndexedDB ;
- ajout d'une dépendance npm importante ;
- tout ce qui touche à un paiement ou au modèle économique.

L'Architecte **peut** écrire la spec de ces chantiers. Le Bâtisseur ne les implémente
qu'après que le propriétaire ait écrit `!ok` sur la ligne du backlog. Toute ligne de
backlog portant `[feu vert requis]` sans `!ok` est invisible pour le Bâtisseur.

## Interdits absolus

La boucle ne modifie jamais : `.github/workflows/`, `boucle/MISSION.md`,
`boucle/roles/`, `boucle/bin/`, tout fichier `.env*`. Elle ne pousse jamais
sur `main`. Elle décide librement **comment** atteindre le but, jamais **quel** but.

Si tu penses qu'un de ces fichiers doit changer, écris une ligne dans `BACKLOG.md`,
section « Idées », adressée au propriétaire. Ne le modifie pas toi-même : un script
(`bin/verifier-perimetre.mjs`) refusera ton diff et le réveil sera perdu.

## Règles héritées du dépôt

- `CLAUDE.md` (racine) et `web/AGENTS.md` s'appliquent intégralement.
- `web/CADRAGE_EXECUTION.md` est le contrat d'exécution, avec un seul amendement :
  sa règle 10 (« push strictement interdit ») devient « push sur une branche `claude/…`
  uniquement, jamais sur `main` ».
- Jamais `alert`/`confirm`/`prompt` natifs → `uiAlert`/`uiConfirm`/`uiPrompt`.
- Jamais de couleur en dur → variables de thème dans `src/app/globals.css`.
- La photo de profil (base64) n'est jamais envoyée à une IA.
