# ÉTAT

*(fichier court, écrasé à chaque réveil — ce n'est pas un historique,
le journal est dans `boucle/journal/`)*

- **Dernier réveil :** 2026-08-03 (Éclaireur)
- **Rôle joué :** Éclaireur
- **PR en cours :** aucune — l'Éclaireur n'écrit que dans `boucle/` et `docs/`.
- **Ce qui a été fait :** audit du domaine « hygiène du dépôt » (`npx knip` après
  `npm install`, faux positifs écartés à la main par `grep`). Constat écrit :
  `boucle/constats/2026-08-03-hygiene-du-depot.md`. Quatre défauts trouvés, preuve par
  grep pour chacun : six fonctions mortes dans `src/lib/storage/db.ts` (`deleteDraft`,
  `listHistoryEntries`, `getHistoryEntry`, `saveExplored`, `listJobsByGrade`,
  `deleteTemplate`), `completeJson` mort dans `src/lib/ai/clients.ts`, la constante
  `DEFAULT_STALE_DAYS` orpheline pendant que sa valeur (30) est dupliquée en dur dans
  `src/state/settingsStore.ts:64`, et le filtre « Cadre / Non-cadre »
  (`QUALIFICATION_OPTIONS`) câblé jusqu'à l'appel réel à l'API France Travail mais
  absent de `FilterBar.tsx`. Trois idées ajoutées à `IDEES.md`, non notées (mandat de
  l'Arbitre au prochain réveil).
- **Vérifications :** `npx knip` exécuté deux fois (avant/après `npm install`) pour
  écarter les faux positifs dus à l'absence initiale de `node_modules/` ; chaque export
  retenu comme mort vérifié individuellement par `grep -rn "\bNOM\b" src` (avec et sans
  exclusion des tests) ; `npx depcheck` exécuté et ses deux signalements
  (`tailwindcss`, `@tailwindcss/postcss`) vérifiés faux positifs par lecture de
  `postcss.config.mjs` et `globals.css`.
- **Domaine audité en dernier :** hygiène du dépôt (Éclaireur, 03/08/2026). Rotation
  inchangée : manques fonctionnels → coût des appels externes → hygiène du dépôt →
  manques fonctionnels (**prochain domaine pour l'Éclaireur**) → performance → briques
  externes → manques fonctionnels → accessibilité → parcours d'un nouvel arrivant →
  manques fonctionnels → cohérence visuelle → sécurité → (retour au début).
- **Échecs consécutifs du Gardien sur la PR courante :** 0 (aucune PR issue de ce
  réveil — l'Éclaireur ne produit pas de code).
