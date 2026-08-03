# ÉTAT

*(fichier court, écrasé à chaque réveil — ce n'est pas un historique,
le journal est dans `boucle/journal/`)*

- **Dernier réveil :** 2026-08-03 (Éclaireur, deuxième réveil du rôle ce jour-là)
- **Rôle joué :** Éclaireur
- **PR en cours :** aucune — l'Éclaireur n'écrit que dans `boucle/` et `docs/`.
- **Domaine audité :** manques fonctionnels (3e passage dans la rotation). Constat :
  `boucle/constats/2026-08-03-manques-fonctionnels-2.md`. Vérifié d'abord dans le code
  (`grep` sur `web/src/`) que les trois manques identifiés sont bien absents aujourd'hui,
  puis confronté à une consultation directe (WebSearch + WebFetch) des 8 produits de
  référence le 03/08/2026 — sources et dates citées dans le constat.
- **Ce qui a été fait :** trois idées nouvelles ajoutées, non notées, à la fin de
  `## Classement` dans `IDEES.md` : « Assistant de négociation salariale » (Careerflow,
  Teal, Simplify — 3/8 produits), « Alertes sur de nouvelles offres correspondant au
  profil » (Teal, Careerflow — 2/8 produits, **signalée sensible** : suppose un envoi
  programmé serveur ou une notification push, alors que CVMatchr est 100 % local
  aujourd'hui), « Correction orthographique/grammaticale dédiée avec rapport »
  (Enhancv, Kickresume — 2/8 produits). Aucune des trois n'est présente dans
  `## Écartées` — vérifié avant ajout. Le reste du fichier (classement des 17 idées déjà
  notées, section Écartées) n'a pas été touché.
- **Vérifications :** relecture du constat du 02/08 (`2026-08-01-manques-fonctionnels.md`)
  pour confirmer que les trois idées ajoutées sont bien nouvelles et non des doublons des
  8 déjà classées (extension = construite, mock interview/CRM = écartées, les 5 autres
  aux rangs 1, 2, 4, 11, 13 du classement actuel). Vérification code (`grep` sur
  `salaire|salary|negocia`, `alerte|notification|cron`, `grammai|orthographe`) que
  chacun des trois manques est réellement absent de CVMatchr avant de l'écrire.
- **Domaine audité en dernier :** manques fonctionnels (ce réveil, 03/08/2026). Rotation
  Éclaireur inchangée : manques fonctionnels → coût des appels externes → hygiène du
  dépôt → manques fonctionnels → **performance (prochain domaine pour l'Éclaireur)** →
  briques externes → manques fonctionnels → accessibilité → parcours d'un nouvel
  arrivant → manques fonctionnels → cohérence visuelle → sécurité → (retour au début).
- **Échecs consécutifs du Gardien sur la PR courante :** 0 (aucune PR issue de ce
  réveil — l'Éclaireur ne produit pas de code).
