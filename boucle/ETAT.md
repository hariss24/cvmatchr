# ÉTAT

*(fichier court, écrasé à chaque réveil — ce n'est pas un historique,
le journal est dans `boucle/journal/`)*

- **Dernier réveil :** 2026-08-05 (Éclaireur, deuxième réveil du jour)
- **Rôle joué :** Éclaireur
- **PR en cours :** aucune — l'Éclaireur n'écrit que dans `boucle/` et `docs/`.
- **Ce qui a été fait :** audité le domaine « accessibilité » (rotation de
  `roles/eclaireur.md`, premier passage sur ce domaine). Serveur `npm run dev`
  lancé en local, trois écrans scannés avec `pa11y`/axe (WCAG2AA) : `/` (éditeur,
  63 signalements), `/jobs` (4), `/candidatures` (15). Chaque signalement
  `color-contrast` (44 au total, tous marqués `needsFurtherReview` par axe faute de
  résoudre seul les dégradés CSS) vérifié à la main par un script Puppeteer dédié
  qui recalcule le ratio WCAG sur les couleurs réellement rendues : 13 échecs
  réels confirmés (31 faux positifs écartés), ramenés à deux causes uniques
  (`--faint` texte secondaire à 2,97-3,89:1 selon le thème ; texte blanc sur le
  dégradé `--cta-grad` à 2,97-3,50:1), toutes sous le seuil AA de 4,5:1. Repéré
  aussi : 36 champs du formulaire CV sans label associé (`FormEditor.tsx:400-425`,
  `htmlFor`/`id` absents), un indicateur de focus clavier explicitement supprimé
  sur le champ de recherche d'offres (`globals.css:1550`, confirmé en direct par
  focus programmatique), et un aperçu PDF non focusable au clavier
  (`scrollable-region-focusable`). Comparé aux 8 produits de référence sur leur
  page publique avec le même outil : 8/8 ont des défauts de contraste détectables
  (CVMatchr à parité de méthode sur ce point, pas en retard propre), mais aucun
  n'a un équivalent du défaut massif d'association label/input observé ici — sans
  pouvoir vérifier leur formulaire de CV réel, derrière connexion. Détail complet
  dans `boucle/constats/2026-08-05-accessibilite.md`. Quatre idées ajoutées non
  notées en fin de `## Classement` d'`IDEES.md` (section « À noter »), à noter par
  l'Arbitre au réveil suivant.
- **Vérifications :** relu `MISSION.md`, `ETAT.md`, `IDEES.md` (classement complet
  + Écartées) et `boucle/roles/eclaireur.md` avant de commencer. Vérifié
  qu'aucune des quatre idées ajoutées n'apparaît déjà dans le classement ni dans
  `## Écartées`. Chaque mesure de contraste recalculée sur les couleurs
  effectivement rendues par le navigateur (pas de tête, pas de confiance aveugle
  dans les signalements `needsFurtherReview` d'axe — 31 des 44 signalements
  `color-contrast` se sont révélés être des faux positifs après vérification).
  Focus clavier confirmé par un focus programmatique réel, pas une lecture de CSS
  seule, quand l'élément était présent sur la page testée. Comparaison concurrence
  faite avec le même outil (`pa11y`, mêmes options) sur les 8 produits de
  référence, URLs et date citées dans le constat. `git status --short` vérifié
  juste avant ce commit, confirmé qu'aucun fichier hors de `boucle/` n'a été
  touché (le serveur de dev et les scripts de mesure ont tourné hors du dépôt,
  dans `/tmp`, jamais committés).
- **Domaine audité en dernier (Éclaireur) :** accessibilité (05/08/2026, deuxième
  réveil). Rotation : coût des appels externes → hygiène du dépôt → manques
  fonctionnels → performance → briques externes → manques fonctionnels →
  accessibilité → **parcours d'un nouvel arrivant (prochain domaine pour
  l'Éclaireur)** → manques fonctionnels → cohérence visuelle → sécurité → manques
  fonctionnels → (retour au début).
- **Échecs consécutifs du Gardien sur la PR courante :** 0 (aucune PR issue de ce
  réveil — l'Éclaireur ne produit pas de code).
