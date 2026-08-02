# La boucle autonome — mode d'emploi

Un agent Claude se réveille toutes les 6 heures, joue **un** rôle, et s'arrête.
Il alterne : il explore, puis il classe ce qu'il a rapporté.

**Elle n'implémente rien.** Elle propose ; le propriétaire décide et construit.
Le livrable est `boucle/IDEES.md` — c'est le fichier à lire.

Explication complète pour non-développeur : `FONCTIONNEMENT.md`.
Conception d'origine : `docs/superpowers/specs/2026-07-31-boucle-autonome-design.md`.

## Piloter la boucle

| Je veux… | Je fais… |
|---|---|
| Tout arrêter | Créer `boucle/PAUSE.md` (le contenu sert de mot d'explication) |
| Geler un seul rôle | Créer `PAUSE.md` en y écrivant son nom, ex. `Gel de l'Arbitre` |
| Reprendre | Supprimer `PAUSE.md` |
| Proposer une idée | Ajouter une ligne dans `IDEES.md`, en français courant |
| Dire « je veux celle-là » | La préfixer de `!` |
| Refuser une idée définitivement | Barrer la ligne : `- ~~mon refus~~` — elle ne remontera plus |
| Corriger une note | L'écrire à la main : l'Arbitre la recopie sans la rediscuter |
| Changer le comportement d'un rôle | Éditer `boucle/roles/<role>.md` |
| Changer les objectifs ou le barème | Éditer `boucle/MISSION.md` |
| Déclencher un réveil tout de suite | Onglet Actions → « Boucle autonome » → Run workflow |

La boucle n'écrit que dans `boucle/` et `docs/` — jamais dans `web/` ni `extension/`,
jamais dans `MISSION.md`, `roles/`, `bin/` ou les workflows. Ce n'est pas une consigne :
`bin/verifier-perimetre.mjs` refuse le diff avant le push, et le réveil est perdu.

## Savoir ce qu'elle a fait

- `boucle/IDEES.md` — **le classement, le livrable.**
- `boucle/ETAT.md` — où elle en est, en cinq lignes.
- `boucle/journal/` — une entrée par réveil.
- `boucle/constats/` — les audits, chiffrés, avec la comparaison à la concurrence.
- `git log --author="Boucle CVMatchr"` — tous ses commits.
