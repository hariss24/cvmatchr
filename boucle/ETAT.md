# ÉTAT

*(fichier court, écrasé à chaque réveil — ce n'est pas un historique,
le journal est dans `boucle/journal/`)*

- **Dernier réveil :** 2026-08-08 (Éclaireur, deuxième réveil du jour)
- **Rôle joué :** Éclaireur
- **PR en cours :** aucune — l'Éclaireur n'écrit que dans `boucle/` et `docs/`.
- **Ce qui a été fait :** audité le domaine « manques fonctionnels » (5e passage,
  rotation `boucle/roles/eclaireur.md`). Deux manques trouvés, nouveaux, vérifiés par
  `grep` dans le code et par citation directe d'au moins deux produits de référence
  chacun : **export du CV/lettre au format Word (.docx)**, absent à 100 % du code
  (`web/src/lib/pdfgen/` ne génère que du PDF), présent chez Rezi/Kickresume/Huntr ;
  **génération IA de réponses aux questions ouvertes du formulaire de candidature**
  dans l'extension autofill, explicitement hors périmètre de la spec de conception
  actuelle (§8), présent chez Simplify/Teal. Constat détaillé :
  `boucle/constats/2026-08-08-manques-fonctionnels-5.md`. Les deux idées ajoutées, non
  notées, en fin de `## Classement` d'`IDEES.md` (nouvelle section « À noter »), pour
  notation par l'Arbitre au prochain réveil.
- **Vérifications :** relu `MISSION.md`, `ETAT.md`, `IDEES.md` (classement complet +
  « Écartées ») et `boucle/roles/eclaireur.md` avant de commencer. Relu en entier les
  quatre constats précédents de manques fonctionnels (02/08, 03/08, 05/08, 07/08) pour
  ne rien répéter — plusieurs pistes explorées puis abandonnées car déjà construites
  (tableau de bord de candidatures, diff de versions) ou déjà classées. Chaque citation
  concurrentielle vérifiée mot pour mot dans la réponse de l'outil avant d'être écrite ;
  une piste (Careerflow, génération IA de réponse aux questions ouvertes) écartée du
  décompte faute de confirmation directe sur la page consultée, malgré un résumé de
  recherche suggérant le contraire. Vérifié qu'aucune des deux idées ajoutées
  n'apparaît déjà dans le classement ni dans `## Écartées`. `git status --short`
  vérifié avant ce commit : uniquement des fichiers sous `boucle/` (le nouveau
  constat, `IDEES.md`, `ETAT.md`, le journal du jour) — rien hors de `boucle/`.
- **Domaine audité en dernier (Éclaireur) :** manques fonctionnels (08/08/2026, ce
  réveil). Prochain domaine pour l'Éclaireur : performance. Rotation : coût des appels
  externes → hygiène du dépôt → **manques fonctionnels** → performance → briques
  externes → **manques fonctionnels** → accessibilité → parcours d'un nouvel arrivant
  → **manques fonctionnels** → cohérence visuelle → sécurité → **manques fonctionnels**
  (ce réveil) → **performance (prochain domaine pour l'Éclaireur)** → (retour au
  début).
- **Échecs consécutifs du Gardien sur la PR courante :** 0 (aucune PR issue de ce
  réveil — l'Éclaireur ne produit pas de code).
