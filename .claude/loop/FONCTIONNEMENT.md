# Comment fonctionne la boucle autonome

Document d'explication, écrit pour être lu par quelqu'un qui ne code pas.
Pour piloter la boucle au quotidien, la fiche courte est `README.md`.
Pour les raisons de chaque choix de conception,
`docs/superpowers/specs/2026-07-31-boucle-autonome-design.md`.

---

## 1. En une phrase

Toutes les 6 heures, un agent Claude se réveille chez GitHub, fait **une seule chose**
pour améliorer CVMatchr, la propose, et ne peut la mettre en ligne que si toutes les
vérifications automatiques sont vertes.

---

## 2. Le vocabulaire, une fois pour toutes

**Dépôt** — l'atelier où sont rangés tous les plans de l'app, avec l'historique complet
de chaque modification.

**Branche** — un établi. On y bricole sans toucher à ce qui est en ligne.

**`main`** — l'établi officiel. Tout ce qui y entre est automatiquement construit et
déployé sur cvmatchr.fr. C'est la vitrine.

**Pull request (PR)** — une proposition : « voici ce que j'ai fait sur mon établi, je
demande à le verser dans `main` ». Elle reste ouverte tant qu'elle n'est ni acceptée ni
refusée.

**CI / `test-web`** — la batterie de vérifications qui se lance toute seule sur chaque
proposition : 583 contrôles de cohérence du code, 38 parcours utilisateur joués dans un
vrai navigateur, et la construction complète de l'app.

**Réveil** — une exécution de la boucle. Quatre par jour.

---

## 3. Pourquoi quatre rôles et non un seul agent

Un agent qui ferait tout en une fois — auditer, concevoir, coder — arriverait au moment
de coder avec une mémoire déjà saturée par son propre audit. C'est le pire moment pour
saturer.

La boucle joue donc **un seul rôle par réveil** :

| Rôle | Ce qu'il fait | Ce qu'il ne fait pas |
|---|---|---|
| 🛡️ **Gardien** | Répare ce qui est cassé | Rien d'autre |
| 🔨 **Bâtisseur** | Écrit le code d'un plan existant | Ne conçoit pas |
| 📐 **Architecte** | Transforme un constat en plan détaillé | N'écrit aucun code |
| 🔭 **Éclaireur** | Audite, mesure, compare à la concurrence | N'écrit aucun code |

La séparation entre l'Architecte et le Bâtisseur n'est pas de la bureaucratie : un agent
qui conçoit et code dans le même souffle taille sa conception à la mesure de ce qu'il a
envie de coder.

---

## 4. Comment le rôle est choisi

Pas au feeling. Une règle fixe, appliquée par un petit programme testé
(`bin/choisir-role.mjs`, 17 vérifications automatiques) :

```
1. Une proposition est cassée, ou traîne depuis plus de 24 h ?   → Gardien
2. Une proposition est inachevée ?                                → Bâtisseur (il la reprend)
3. Aucune proposition en cours et un plan est prêt ?              → Bâtisseur (il en démarre un)
4. Un constat attend d'être transformé en plan ?                  → Architecte
5. Sinon                                                          → Éclaireur
```

L'ordre est **réparer > livrer > planifier > explorer**.

Explorer arrive en dernier volontairement : c'est la tâche la plus agréable, donc celle
qui monopoliserait tout si on la laissait libre. Une boucle « créative » accumule les
audits brillants et ne livre jamais.

---

## 5. Le déroulé d'un réveil, étape par étape

1. **Y a-t-il un fichier `PAUSE.md` ?** Si oui, arrêt immédiat. Aucun jeton dépensé.
2. **Lecture de l'état** — `ETAT.md` et `MISSION.md`, une centaine de lignes.
3. **Choix du rôle** selon la règle ci-dessus.
4. **Travail** — l'agent applique son mandat, et lui seul.
5. **Contrôle du périmètre** — un programme vérifie qu'il n'a touché à rien d'interdit.
6. **Dépôt sur un établi** — le travail est poussé sur une branche `claude/…`.
7. **Proposition** — une pull request est ouverte.
8. **Demande de fusion** — la boucle demande à GitHub de fusionner *quand tout sera vert*.
9. **Compte rendu** — une entrée dans `journal/`, `ETAT.md` mis à jour.

Un réveil dure de quelques minutes à une demi-heure. Au-delà de 60 minutes, il est
interrompu d'office.

---

## 6. Pourquoi la mémoire n'explose jamais

C'était l'inquiétude de départ : une session qui tourne en continu finirait par accumuler
un million de mots de contexte.

Elle ne peut pas, parce que **chaque réveil démarre une session neuve et vide**. Rien
n'est hérité du réveil précédent.

La continuité passe par des **fichiers** rangés dans le dépôt : la mission, la file
d'attente, l'état, le journal. Un fichier relu à froid ne perd rien — alors qu'un résumé,
lui, perd de l'information sans dire laquelle. C'est pour ça qu'on n'utilise pas de
compactage.

Chaque rôle a aussi l'ordre explicite de **ne jamais lire tout le dépôt** : son mandat,
l'état, et les fichiers de son domaine. Rien de plus.

---

## 7. Ce que la boucle ne peut pas faire

Ce ne sont pas des consignes qu'elle est priée de respecter. Ce sont des **verrous
appliqués par un programme** (`bin/verifier-perimetre.mjs`, 10 vérifications
automatiques) qui inspecte son travail avant qu'il ne quitte la machine.

| Interdit | Pourquoi |
|---|---|
| `.github/workflows/` | Elle ne modifie pas son propre moteur : un agent qui peut réécrire sa planification n'a plus de limites, seulement des limites qu'il consent à garder. |
| `MISSION.md` | Elle ne réécrit pas son propre but. Elle décide **comment** l'atteindre, jamais **quel** but. |
| `roles/` | Elle ne réécrit pas ses propres consignes. |
| `bin/` | Elle ne désarme pas son propre garde-fou — sans quoi la version désarmée validerait le diff qui l'a désarmée. |
| Fichiers `.env` | Aucun accès aux secrets. |
| `main` en écriture directe | Tout passe par une proposition vérifiée. |

Elle peut *proposer* de changer n'importe lequel de ces points : une ligne dans le
backlog, adressée au propriétaire. Elle ne peut pas se l'accorder.

**Elle n'a par ailleurs aucune clé applicative** — ni France Travail, ni Adzuna, ni
Gemini, ni Google Maps, ni Brandfetch. Elle n'en a pas besoin : les tests tournent sur
des données factices. Une clé qu'un agent autonome ne détient pas est une clé qu'il ne
peut ni dépenser, ni recopier par accident dans un journal.

---

## 8. Ce qui protège la production

Trois barrières successives, dont deux seraient inutiles sans la troisième.

**Première barrière — l'agent ne pousse rien lui-même.** Il enregistre son travail en
local. C'est le moteur, et lui seul, qui pousse et ouvre la proposition. L'agent n'a
jamais la commande de fusion entre les mains.

**Deuxième barrière — le contrôle du périmètre.** Il tourne après le travail de l'agent
et avant l'envoi. Une violation ne quitte jamais la machine.

**Troisième barrière — la protection de `main`.** C'est la seule qui compte vraiment.
GitHub refuse toute fusion tant que `test-web` n'est pas vert.

Un piège a été désamorcé au passage : la commande de fusion automatique ne diffère
réellement la fusion que s'il existe une vérification *exigée*. Sans protection de
branche, elle fusionnerait **immédiatement**, avant même que la CI ait répondu. Le moteur
vérifie donc lui-même, à chaque réveil, que la protection est bien en place — et refuse
de s'armer sinon.

---

## 9. Comment reprendre la main

| Je veux… | Je fais… |
|---|---|
| Tout arrêter | Créer `.claude/loop/PAUSE.md` |
| Geler un seul rôle | Créer `PAUSE.md` en y écrivant son nom, ex. `Gel du Bâtisseur` |
| Reprendre | Supprimer `PAUSE.md` |
| Proposer une idée | Une ligne sous `## Idées` de `BACKLOG.md`, en français courant |
| Faire passer une idée devant | La préfixer de `!` |
| Refuser une proposition | Barrer la ligne : `- ~~non merci~~` |
| Débloquer un chantier sensible | Écrire `!ok` sur sa ligne |
| Changer le comportement d'un rôle | Éditer `roles/<rôle>.md` |
| Changer les objectifs ou les seuils | Éditer `MISSION.md` |
| Réveiller la boucle tout de suite | Onglet Actions → « Boucle autonome » → Run workflow |
| Espacer les réveils | Changer la ligne `cron` de `.github/workflows/boucle.yml` |

Aucun de ces gestes ne demande de toucher à du code.

---

## 10. Les quatre chantiers qui exigent ton feu vert

L'Architecte a le droit de les **concevoir** — c'est du terrain préparé, c'est utile.
Le Bâtisseur ne peut pas les **implémenter** tant que tu n'as pas écrit `!ok` sur la
ligne correspondante du backlog :

- comptes et authentification ;
- sortie des données hors du navigateur ;
- ajout d'une dépendance importante ;
- tout ce qui touche à un paiement.

Ce sont les changements qu'on ne peut pas annuler d'un bouton. C'est la seule limite
posée à l'autonomie de la boucle, et elle tient en un mot à taper.

---

## 11. Savoir ce qu'elle a fait

| Où regarder | Ce qu'on y trouve |
|---|---|
| `ETAT.md` | Où elle en est, en cinq lignes |
| `journal/` | Une entrée par réveil |
| `constats/` | Les audits, chiffrés, avec la comparaison à la concurrence |
| `BACKLOG.md` | Ce qui est prévu, dans quel ordre |
| Onglet **Pull requests** de GitHub | Ce qu'elle propose en ce moment |
| `git log --author="Boucle CVMatchr"` | Tout ce qu'elle a écrit, depuis le début |

---

## 12. Ce qu'elle vise

Le référentiel complet est dans `MISSION.md`. En résumé :

> N'importe quel candidat, sans explication préalable, doit pouvoir produire un CV et une
> lettre adaptés à une offre précise — et ne jamais avoir envie de retourner à Word.

Avec des seuils chiffrés (les offres s'affichent en moins de 2 secondes, l'app est
utilisable au clavier seul, elle fonctionne sur un écran de 375 pixels…), un ordre de
priorité fixé par le propriétaire (finition, puis fonctionnalités, puis multi-utilisateur),
et une règle de tranchage : **à chaque arbitrage, l'option la plus complète et la plus
qualitative, pas la moins coûteuse.**

L'Éclaireur ne juge jamais CVMatchr contre lui-même : il compare systématiquement à au
moins deux produits concurrents réellement consultés, sources et dates à l'appui.
