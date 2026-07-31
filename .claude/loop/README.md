# La boucle autonome — mode d'emploi

Un agent Claude se réveille toutes les 6 heures, joue **un** rôle, et s'arrête.
Conception : `docs/superpowers/specs/2026-07-31-boucle-autonome-design.md`.

## Piloter la boucle

| Je veux… | Je fais… |
|---|---|
| Tout arrêter | Créer `.claude/loop/PAUSE.md` (le contenu sert de mot d'explication) |
| Geler un seul rôle | Créer `PAUSE.md` en y écrivant le nom du rôle, ex. `Gel du Bâtisseur` |
| Reprendre | Supprimer `PAUSE.md` |
| Proposer une idée | Ajouter une ligne sous `## Idées` de `BACKLOG.md` |
| Faire passer une idée devant | La préfixer de `!` |
| Refuser une proposition | Barrer la ligne : `- ~~mon refus~~` |
| Débloquer un chantier sensible | Écrire `!ok` sur sa ligne dans `## En attente de feu vert` |
| Changer le comportement d'un rôle | Éditer `.claude/loop/roles/<role>.md` |
| Changer les objectifs | Éditer `.claude/loop/MISSION.md` |
| Déclencher un réveil tout de suite | Onglet Actions → « Boucle autonome » → Run workflow |

La boucle ne peut modifier ni `MISSION.md`, ni `roles/`, ni les workflows, ni aucun
`.env*` : un script (`bin/verifier-perimetre.mjs`) refuse le diff avant le push.

## Savoir ce qu'elle a fait

- `.claude/loop/ETAT.md` — où elle en est, en cinq lignes.
- `.claude/loop/journal/` — une entrée par réveil.
- `.claude/loop/constats/` — les audits, chiffrés.
- `git log --author="Boucle CVMatchr"` — tous ses commits.
