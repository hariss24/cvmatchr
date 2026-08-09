# ÉTAT

*(fichier court, écrasé à chaque réveil — ce n'est pas un historique,
le journal est dans `boucle/journal/`)*

- **Dernier réveil :** 2026-08-09 (Éclaireur)
- **Rôle joué :** Éclaireur
- **PR en cours :** aucune — l'Éclaireur n'écrit que dans `boucle/` et `docs/`.
- **Ce qui a été fait :** audit du domaine **performance** (rotation), constat
  `boucle/constats/2026-08-09-performance-2.md`. Remesuré l'idée n°11 (aperçu PDF de
  `/`) sous Slow 4G + CPU x4 : **~8977 ms en moyenne, inchangé** depuis le 04/08/2026
  (aucun commit sur les fichiers concernés) — toujours un dépassement de facteur ~3,6
  du seuil de 2,5 s. Ajouté deux mesures neuves : le formulaire de `/` est en fait
  saisissable en ~1078 ms (sous le seuil, le blocage vient bien de l'aperçu PDF
  automatique et non du formulaire), et l'événement `load` complet de `/` est à
  ~2774 ms (poids 1 336 006 o, facteur ~1,11) — répond à la question ouverte de l'idée
  n°21. Remesuré `/pack` (idée n°24) avec la bonne prémisse : son titre mentionnait
  Monaco/react-pdf, une confusion déjà corrigée par le constat du 04/08 lui-même —
  `/pack` n'utilise ni l'un ni l'autre. Interactif mesuré à ~2618 ms (facteur ~1,05,
  poids 770 985 o). Section « À noter » ajoutée en fin d'`IDEES.md` : correction de
  titre à faire sur l'idée n°24 par l'Arbitre, une nouvelle idée proposée (identifier
  le contenu des trois chunks les plus lourds de `/pack` avant tout chantier de
  réduction), et deux précisions rattachées aux idées n°11/n°21 sans créer de nouvelle
  entrée. Aucune idée retirée du classement (contrairement au 04/08, rien n'est résolu
  cette fois).
- **Vérifications :** lu `MISSION.md`, `ETAT.md`, `IDEES.md` (classement complet +
  « Écartées ») et `boucle/roles/eclaireur.md` avant de commencer. Vérifié qu'aucune
  idée nouvelle proposée n'apparaît déjà dans `## Écartées`. Build de production réel
  (`rm -rf .next && npm install && npm run build && npm run start`), serveur vérifié up
  par code HTTP avant toute mesure (`/`, `/pack`, `/jobs` → 200). Chronométrage
  Playwright/CDP, 3 relevés par mesure, mêmes profils réseau/CPU que l'audit du 04/08
  pour rester comparable. Confirmé par `grep` que `/pack` ne contient ni `monaco` ni
  `react-pdf`. Recherches web datées (09/08/2026) pour la comparaison concurrentielle,
  aucune affirmation sur un concurrent faite de mémoire. Scripts Playwright temporaires
  (`tmp-perf-measure.mjs`) écrits dans `web/`, utilisés puis supprimés avant de
  terminer — jamais commis. `web/package-lock.json`, modifié par le `npm install`
  nécessaire dans cet environnement, restauré (`git checkout --`). `git status --short`
  vérifié vide dans `web/` avant ce commit — uniquement `boucle/IDEES.md`,
  `boucle/ETAT.md`, `boucle/constats/2026-08-09-performance-2.md` et le journal du jour
  modifiés/créés, rien hors de `boucle/`.
- **Domaine audité en dernier (Éclaireur) :** performance (09/08/2026). Prochain
  domaine pour l'Éclaireur : briques externes. Rotation : coût des appels externes →
  hygiène du dépôt → manques fonctionnels → performance → briques externes →
  **manques fonctionnels** → accessibilité → parcours d'un nouvel arrivant → manques
  fonctionnels → cohérence visuelle → sécurité → manques fonctionnels →
  **performance** → **briques externes (prochain domaine pour l'Éclaireur)** → (retour
  au début).
- **Échecs consécutifs du Gardien sur la PR courante :** 0 (aucune PR issue de ce
  réveil — l'Éclaireur ne produit pas de code).
